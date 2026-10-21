package com.masatto.mytask.task;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.masatto.mytask.area.AreaService;
import com.masatto.mytask.common.ApiException;
import com.masatto.mytask.rule.RecurrenceRule;
import com.masatto.mytask.rule.RecurrenceRuleRepository;
import com.masatto.mytask.task.dto.StatusChangeRequest;
import com.masatto.mytask.task.dto.StatusChangeResponse;
import com.masatto.mytask.task.dto.StatusRestoreRequest;
import com.masatto.mytask.task.dto.TaskCountsResponse;
import com.masatto.mytask.task.dto.TaskCreateRequest;
import com.masatto.mytask.task.dto.TaskListItem;
import com.masatto.mytask.task.dto.TaskListResponse;
import com.masatto.mytask.task.dto.TaskResponse;
import com.masatto.mytask.task.dto.TaskUpdateRequest;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TaskService {

    static final int DONE_PAGE_MAX = 100;

    private final TaskRepository taskRepository;
    private final RecurrenceRuleRepository ruleRepository;
    private final AreaService areaService;
    private final Clock clock;

    // ---- 一覧・件数 ----------------------------------------------------------

    /**
     * @param areaId 指定するとそのエリアのタスクだけにする（null ならすべて）。
     *               サブタスクは親と同じエリアを持つので、タスク1件ずつの判定で親子がそろう
     */
    public TaskListResponse list(TaskView view, int offset, int limit, Long areaId) {
        LocalDateTime now = LocalDateTime.now(clock);
        if (view == TaskView.DONE_TODAY) {
            List<Task> matched = inArea(doneToday(now), areaId);
            return new TaskListResponse(builderFor(matched, now).buildDone(matched), false);
        }
        if (view == TaskView.DONE) {
            return listDone(offset, limit, now, areaId);
        }
        return new TaskListResponse(
                openItems(view, inArea(taskRepository.findByStatusNot(TaskStatus.DONE), areaId), now), false);
    }

    public TaskCountsResponse counts(Long areaId) {
        LocalDateTime now = LocalDateTime.now(clock);
        List<Task> open = inArea(taskRepository.findByStatusNot(TaskStatus.DONE), areaId);
        List<TaskListItem> today = openItems(TaskView.TODAY, open, now);
        return new TaskCountsResponse(
                today.size(),
                (int) today.stream().filter(TaskListItem::viewOverdue).count(),
                openItems(TaskView.UPCOMING, open, now).size(),
                openItems(TaskView.NO_DUE, open, now).size(),
                inArea(doneToday(now), areaId).size());
    }

    /** 今日完了にした親タスク（完了日時の新しい順） */
    private List<Task> doneToday(LocalDateTime now) {
        return taskRepository.findDoneBetween(startOfDay(now.toLocalDate()), startOfDay(now.toLocalDate().plusDays(1)));
    }

    private static List<Task> inArea(List<Task> tasks, Long areaId) {
        return areaId == null ? tasks : tasks.stream().filter(t -> areaId.equals(t.getAreaId())).toList();
    }

    private Instant startOfDay(LocalDate date) {
        return date.atStartOfDay(clock.getZone()).toInstant();
    }

    /** 未完了ビューの行。件数はこの行数と一致させる（api-design 3.3） */
    private List<TaskListItem> openItems(TaskView view, List<Task> openTasks, LocalDateTime now) {
        Map<Long, Task> openById = openTasks.stream().collect(Collectors.toMap(Task::getId, Function.identity()));
        Predicate<LocalDate> condition = openViewCondition(view, now.toLocalDate());
        List<Task> matched = openTasks.stream()
                .filter(t -> condition.test(effectiveDueDate(t, openById)))
                .toList();
        return builderFor(matched, now).buildOpen(matched);
    }

    /**
     * ビューの判定に使う期限日（api-design 3.2）。親・サブタスクを問わずタスク1件ごとに判定するが、
     * 期限のないサブタスクは親の期限に従う（期限ありの親の下にある期限なしのサブタスクで、
     * 親が「期限なし」ビューにまで出てしまわないようにするため。繰り返しのひな形から作るサブタスクは期限を持たない）。
     */
    private static LocalDate effectiveDueDate(Task task, Map<Long, Task> openById) {
        if (task.getDueDate() != null || !task.isSubtask()) {
            return task.getDueDate();
        }
        Task parent = openById.get(task.getParentId());
        return parent == null ? null : parent.getDueDate();
    }

    private static Predicate<LocalDate> openViewCondition(TaskView view, LocalDate today) {
        return switch (view) {
            case TODAY -> due -> due != null && !due.isAfter(today);
            case UPCOMING -> due -> due != null && due.isAfter(today);
            case NO_DUE -> due -> due == null;
            case DONE, DONE_TODAY -> throw new IllegalArgumentException(view + " is not an open view");
        };
    }

    private TaskListResponse listDone(int offset, int limit, LocalDateTime now, Long areaId) {
        if (offset < 0 || limit < 1 || limit > DONE_PAGE_MAX) {
            throw ApiException.validation("limit", "offset/limit の値が不正です");
        }
        // ページングは「行（親単位）」で行う。完了日時の新しい順にまとめてから切り出す
        Map<Long, List<Task>> groups = TaskListBuilder
                .group(inArea(taskRepository.findByStatusOrderByCompletedAtDescIdDesc(TaskStatus.DONE), areaId));
        List<Task> matched = groups.values().stream()
                .skip(offset)
                .limit(limit)
                .flatMap(List::stream)
                .toList();
        boolean hasMore = groups.size() > offset + limit;
        return new TaskListResponse(builderFor(matched, now).buildDone(matched), hasMore);
    }

    /** 行の組み立てに必要な親とサブタスクをまとめて取得する（N+1 を避ける） */
    private TaskListBuilder builderFor(Collection<Task> matched, LocalDateTime now) {
        Set<Long> rootIds = matched.stream().map(Task::rootId).collect(Collectors.toSet());
        Map<Long, Task> parents = taskRepository.findAllById(rootIds).stream()
                .collect(Collectors.toMap(Task::getId, Function.identity()));
        Map<Long, List<Task>> subtasks = taskRepository.findByParentIdInOrderByIdAsc(rootIds).stream()
                .collect(Collectors.groupingBy(Task::getParentId));
        // 繰り返しから生成されるのは親タスクだけなので、親のルール名だけ引けばよい
        return new TaskListBuilder(parents, subtasks, ruleTitles(parents.values()), now, clock.getZone());
    }

    /** 生成元ルールのID → タイトル */
    private Map<Long, String> ruleTitles(Collection<Task> tasks) {
        Set<Long> ruleIds = tasks.stream()
                .map(Task::getRecurrenceRuleId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ruleIds.isEmpty()) {
            return Map.of();
        }
        return ruleRepository.findAllById(ruleIds).stream()
                .collect(Collectors.toMap(RecurrenceRule::getId, RecurrenceRule::getTitle));
    }

    // ---- 検索 ---------------------------------------------------------------

    static final int SEARCH_MAX_ROWS = 100;
    static final int SEARCH_MAX_LENGTH = 100;

    /**
     * タイトル・メモの部分一致検索。結果は一覧と同じく親単位の行で返す。
     * 未完了の行を一覧と同じ並び順で先に、完了済みの行を完了日時の新しい順で後に並べる。
     */
    public TaskListResponse search(String q, Long areaId) {
        String query = q == null ? "" : q.strip();
        if (query.isEmpty() || query.length() > SEARCH_MAX_LENGTH) {
            throw ApiException.validation("q", "検索語は1〜" + SEARCH_MAX_LENGTH + "文字で入力してください");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        List<Task> matched = inArea(taskRepository.search(escapeLike(query)), areaId);

        List<Task> open = matched.stream().filter(t -> !t.isDone()).toList();
        List<Task> done = matched.stream()
                .filter(Task::isDone)
                .sorted(Comparator.comparing(Task::getCompletedAt).reversed())
                .toList();
        List<TaskListItem> openRows = builderFor(open, now).buildOpen(open);
        // 同じ親の行が未完了側にあれば、完了済み側には出さない（行の重複を避ける）
        Set<Long> openRoots = openRows.stream().map(i -> i.task().id()).collect(Collectors.toSet());
        List<Task> doneOnly = done.stream().filter(t -> !openRoots.contains(t.rootId())).toList();
        List<TaskListItem> rows = new ArrayList<>(openRows);
        rows.addAll(builderFor(doneOnly, now).buildDone(doneOnly));

        return new TaskListResponse(rows.stream().limit(SEARCH_MAX_ROWS).toList(), rows.size() > SEARCH_MAX_ROWS);
    }

    /** LIKE の特殊文字をエスケープする（ESCAPE '\'） */
    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    // ---- 詳細 ---------------------------------------------------------------

    public TaskResponse get(Long id) {
        Task task = findTask(id);
        LocalDateTime now = LocalDateTime.now(clock);
        if (task.isSubtask()) {
            Task parent = findTask(task.getParentId());
            return toResponse(task, now).withDetail(new TaskResponse.ParentSummary(parent.getId(), parent.getTitle()),
                    null);
        }
        List<TaskResponse> subtasks = taskRepository.findByParentIdOrderByIdAsc(id).stream()
                .map(t -> toResponse(t, now))
                .toList();
        return toResponse(task, now).withDetail(null, subtasks);
    }

    // ---- 作成・更新・削除 ------------------------------------------------------

    @Transactional
    public TaskResponse create(TaskCreateRequest request) {
        validateDue(request.dueDate(), request.dueTime());
        Instant now = Instant.now(clock);
        Task parent = request.parentId() == null ? null : findParentForNewSubtask(request.parentId());
        if (parent == null) {
            areaService.checkExists(request.areaId(), "areaId");
        }

        Task task = Task.create(
                request.title().strip(),
                blankToNull(request.memo()),
                request.dueDate(),
                request.dueTime(),
                request.priority() == null ? Priority.MEDIUM : request.priority(),
                request.parentId(),
                now);
        // サブタスクは親のエリアに入る
        task.setAreaId(parent == null ? request.areaId() : parent.getAreaId());
        task.setEstimateMinutes(request.estimateMinutes());
        taskRepository.save(task);

        // 完了済みの親に未完了のサブタスクが加わったら、親を進行中に戻す
        if (parent != null && parent.isDone()) {
            parent.changeStatus(TaskStatus.IN_PROGRESS, now);
            parent.touch(now);
        }
        return toResponse(task, LocalDateTime.now(clock));
    }

    private Task findParentForNewSubtask(Long parentId) {
        Task parent = taskRepository.findById(parentId)
                .orElseThrow(() -> ApiException.validation("parentId", "親タスクが見つかりません"));
        if (parent.isSubtask()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NESTED_SUBTASK", "サブタスクの下にサブタスクは作れません");
        }
        return parent;
    }

    @Transactional
    public TaskResponse update(Long id, TaskUpdateRequest request) {
        validateDue(request.dueDate(), request.dueTime());
        Task task = findTask(id);
        Instant now = Instant.now(clock);
        // 一括完了の指定はできないので、未完了のサブタスクが残る親を完了にすると 409 になる
        applyStatus(task, request.status(), false, now, new ArrayList<>());
        task.setTitle(request.title().strip());
        task.setMemo(blankToNull(request.memo()));
        task.setDue(request.dueDate(), request.dueTime());
        task.setPriority(request.priority());
        task.setEstimateMinutes(request.estimateMinutes());
        if (!task.isSubtask() && !Objects.equals(task.getAreaId(), request.areaId())) {
            areaService.checkExists(request.areaId(), "areaId");
            task.setAreaId(request.areaId());
            task.touch(now);
            // サブタスクも親と一緒に移す（一括更新は永続化コンテキストを空にするので、親を先に書き込んでおく）
            taskRepository.saveAndFlush(task);
            taskRepository.updateSubtaskArea(task.getId(), request.areaId());
            return toResponse(findTask(id), LocalDateTime.now(clock));
        }
        task.touch(now);
        return toResponse(task, LocalDateTime.now(clock));
    }

    @Transactional
    public void delete(Long id) {
        // サブタスクは DB の ON DELETE CASCADE で一緒に削除される
        taskRepository.delete(findTask(id));
    }

    // ---- ステータス -----------------------------------------------------------

    @Transactional
    public StatusChangeResponse changeStatus(Long id, StatusChangeRequest request) {
        Task task = findTask(id);
        List<StatusChangeResponse.Changed> changed = new ArrayList<>();
        applyStatus(task, request.status(), Boolean.TRUE.equals(request.completeSubtasks()), Instant.now(clock),
                changed);
        return new StatusChangeResponse(changed);
    }

    /**
     * ステータスを変更し、親子の連動を行う（api-design 3.7）。
     * <ul>
     * <li>親を完了にするとき、未完了のサブタスクがあれば 409。completeSubtasks なら一緒に完了にする</li>
     * <li>完了済みの親の下でサブタスクを未完了に戻したら、親を進行中に戻す</li>
     * </ul>
     * 状態が変わったタスクを changed に追加する。
     */
    private void applyStatus(Task task, TaskStatus newStatus, boolean completeSubtasks, Instant now,
            List<StatusChangeResponse.Changed> changed) {
        if (task.getStatus() == newStatus) {
            return;
        }
        if (!task.isSubtask() && newStatus == TaskStatus.DONE) {
            List<Task> incomplete = taskRepository.findByParentIdOrderByIdAsc(task.getId()).stream()
                    .filter(t -> !t.isDone())
                    .toList();
            if (!incomplete.isEmpty() && !completeSubtasks) {
                throw ApiException.subtasksIncomplete(incomplete.size());
            }
            incomplete.forEach(sub -> setStatus(sub, TaskStatus.DONE, now, changed));
        }
        setStatus(task, newStatus, now, changed);

        if (task.isSubtask() && newStatus != TaskStatus.DONE) {
            Task parent = findTask(task.getParentId());
            if (parent.isDone()) {
                setStatus(parent, TaskStatus.IN_PROGRESS, now, changed);
            }
        }
    }

    private static void setStatus(Task task, TaskStatus status, Instant now,
            List<StatusChangeResponse.Changed> changed) {
        changed.add(new StatusChangeResponse.Changed(task.getId(), task.getStatus(), status));
        task.changeStatus(status, now);
        task.touch(now);
    }

    /** 「元に戻す」用。連動は行わず、指定どおりに設定する（api-design 3.8） */
    @Transactional
    public void restoreStatuses(StatusRestoreRequest request) {
        List<Long> ids = request.changes().stream().map(StatusRestoreRequest.Change::id).distinct().toList();
        Map<Long, Task> tasks = taskRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Task::getId, Function.identity()));
        if (tasks.size() != ids.size()) {
            throw ApiException.notFound("タスクが見つかりません");
        }
        Instant now = Instant.now(clock);
        for (StatusRestoreRequest.Change change : request.changes()) {
            Task task = tasks.get(change.id());
            task.changeStatus(change.status(), now);
            task.touch(now);
        }
    }

    // ---- 共通 ---------------------------------------------------------------

    private Task findTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> ApiException.notFound("タスクが見つかりません"));
    }

    private TaskResponse toResponse(Task task, LocalDateTime now) {
        return TaskResponse.of(task, now, clock.getZone(), ruleTitles(List.of(task)));
    }

    private static void validateDue(LocalDate dueDate, LocalTime dueTime) {
        if (dueDate == null && dueTime != null) {
            throw ApiException.validation("dueTime", "時刻だけの期限は設定できません。日付も入力してください");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
