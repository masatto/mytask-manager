package com.masatto.mytask.task;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.masatto.mytask.common.ApiException;
import com.masatto.mytask.task.dto.TaskCountsResponse;
import com.masatto.mytask.task.dto.TaskListItem;
import com.masatto.mytask.task.dto.TaskListResponse;
import com.masatto.mytask.task.dto.TaskResponse;

import lombok.RequiredArgsConstructor;

/**
 * タスクの読み取り：ビューごとの一覧・件数・検索・詳細（api-design 3.1〜3.4、3.10）。
 * 作成・更新・ステータスの変更は {@link TaskService}。
 *
 * 一覧は「親単位の行」で返す。ビューの条件はタスク1件ずつで判定し（{@link #matchedOpen}）、
 * 条件を満たしたタスクの親とサブタスクを {@link TaskListBuilder} で行にまとめる。
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TaskQueryService {

    static final int DONE_PAGE_MAX = 100;
    static final int SEARCH_MAX_ROWS = 100;
    static final int SEARCH_MAX_LENGTH = 100;

    private final TaskRepository taskRepository;
    private final TaskResponseMapper mapper;
    private final Clock clock;

    // ---- 一覧・件数 ----------------------------------------------------------

    /**
     * @param areaId 指定するとそのエリアのタスクだけにする（null ならすべて）。
     *               サブタスクは親と同じエリアを持つので、タスク1件ずつの判定で親子がそろう
     */
    public TaskListResponse list(TaskView view, int offset, int limit, Long areaId) {
        LocalDateTime now = LocalDateTime.now(clock);
        return switch (view) {
            case DONE_TODAY -> {
                List<Task> matched = inArea(doneToday(now), areaId);
                yield new TaskListResponse(builderFor(matched, now).buildDone(matched), false);
            }
            case DONE -> listDone(offset, limit, now, areaId);
            case TODAY, UPCOMING, NO_DUE -> new TaskListResponse(openItems(view, openTasks(areaId), now), false);
        };
    }

    public TaskCountsResponse counts(Long areaId) {
        LocalDateTime now = LocalDateTime.now(clock);
        List<Task> open = openTasks(areaId);
        List<Task> todayTasks = matchedOpen(TaskView.TODAY, open, now);
        List<TaskListItem> today = builderFor(todayTasks, now).buildOpen(todayTasks);
        return new TaskCountsResponse(
                today.size(),
                (int) today.stream().filter(TaskListItem::viewOverdue).count(),
                openItems(TaskView.UPCOMING, open, now).size(),
                openItems(TaskView.NO_DUE, open, now).size(),
                inArea(doneToday(now), areaId).size(),
                remainingEstimate(todayTasks));
    }

    /**
     * 今日ビューに出ている作業の残りの目安（分。目安が1つもなければ null）。
     * サブタスクに目安がある親は、親の目安を数えずサブタスクの目安を数える（Estimates と同じ考え方）。
     * サブタスクは今日ビューに出ているもの（期限が今日以前）だけを数える。
     */
    private Integer remainingEstimate(List<Task> todayTasks) {
        List<Long> parentIds = todayTasks.stream().filter(t -> !t.isSubtask()).map(Task::getId).toList();
        Set<Long> estimatedBySubtasks = taskRepository.findByParentIdInOrderByIdAsc(parentIds).stream()
                .filter(s -> s.getEstimateMinutes() != null)
                .map(Task::getParentId)
                .collect(Collectors.toSet());
        return Estimates.sum(todayTasks.stream()
                .filter(t -> t.isSubtask() || !estimatedBySubtasks.contains(t.getId()))
                .toList());
    }

    private List<Task> openTasks(Long areaId) {
        return inArea(taskRepository.findByStatusNot(TaskStatus.DONE), areaId);
    }

    /** 今日完了にした親タスク（完了日時の新しい順） */
    private List<Task> doneToday(LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        return taskRepository.findDoneBetween(startOfDay(today), startOfDay(today.plusDays(1)));
    }

    private static List<Task> inArea(List<Task> tasks, Long areaId) {
        return areaId == null ? tasks : tasks.stream().filter(t -> areaId.equals(t.getAreaId())).toList();
    }

    private Instant startOfDay(LocalDate date) {
        return date.atStartOfDay(clock.getZone()).toInstant();
    }

    /** 未完了ビューの行。件数はこの行数と一致させる（api-design 3.3） */
    private List<TaskListItem> openItems(TaskView view, List<Task> openTasks, LocalDateTime now) {
        List<Task> matched = matchedOpen(view, openTasks, now);
        return builderFor(matched, now).buildOpen(matched);
    }

    /** 未完了ビューの条件を満たすタスク（親・サブタスクを問わず1件ずつ判定する） */
    private static List<Task> matchedOpen(TaskView view, List<Task> openTasks, LocalDateTime now) {
        Map<Long, Task> openById = openTasks.stream().collect(Collectors.toMap(Task::getId, Function.identity()));
        Predicate<LocalDate> condition = openViewCondition(view, now.toLocalDate());
        return openTasks.stream()
                .filter(t -> condition.test(effectiveDueDate(t, openById)))
                .toList();
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
        return new TaskListBuilder(parents, subtasks, mapper.ruleTitles(parents.values()), now, clock.getZone());
    }

    // ---- 検索 ---------------------------------------------------------------

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

    /** 親なら全サブタスクを、サブタスクなら親のIDとタイトルを付けて返す */
    public TaskResponse get(Long id) {
        Task task = findTask(id);
        LocalDateTime now = LocalDateTime.now(clock);
        if (task.isSubtask()) {
            Task parent = findTask(task.getParentId());
            return mapper.toResponse(task, now)
                    .withDetail(new TaskResponse.ParentSummary(parent.getId(), parent.getTitle()), null);
        }
        List<TaskResponse> subtasks = taskRepository.findByParentIdOrderByIdAsc(id).stream()
                .map(t -> mapper.toResponse(t, now))
                .toList();
        return mapper.toResponse(task, now).withDetail(null, subtasks);
    }

    private Task findTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> ApiException.notFound("タスクが見つかりません"));
    }
}
