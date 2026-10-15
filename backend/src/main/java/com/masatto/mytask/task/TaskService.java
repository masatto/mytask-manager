package com.masatto.mytask.task;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.masatto.mytask.common.ApiException;
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

    /**
     * 完了済み以外のビューの並び順（api-design 3.2）。
     * 期限日（なしは最後）→ 期限時刻（なしはその日の最後）→ 優先度 → 作成日時。
     */
    private static final Comparator<TaskListItem> OPEN_ORDER = Comparator
            .comparing(TaskListItem::viewDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(TaskListItem::viewTime, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing((TaskListItem i) -> i.task().priority())
            .thenComparing(i -> i.task().createdAt())
            .thenComparing(i -> i.task().id());

    private final TaskRepository taskRepository;
    private final Clock clock;

    public TaskListResponse list(TaskView view, int offset, int limit) {
        if (view == TaskView.DONE) {
            return listDone(offset, limit);
        }
        LocalDateTime now = LocalDateTime.now(clock);
        List<TaskListItem> items = findOpen(view, now.toLocalDate()).stream()
                .map(task -> toListItem(task, now))
                .sorted(OPEN_ORDER)
                .toList();
        return new TaskListResponse(items, false);
    }

    private List<Task> findOpen(TaskView view, LocalDate today) {
        return switch (view) {
            case TODAY -> taskRepository.findOpenDueOnOrBefore(today);
            case UPCOMING -> taskRepository.findOpenDueAfter(today);
            case NO_DUE -> taskRepository.findOpenWithoutDue();
            case DONE -> throw new IllegalArgumentException("DONE is not an open view");
        };
    }

    private TaskListResponse listDone(int offset, int limit) {
        if (offset < 0 || limit < 1 || limit > DONE_PAGE_MAX) {
            throw ApiException.validation("limit", "offset/limit の値が不正です");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        // 1件多く取得して、続きがあるかを判定する
        List<Task> tasks = taskRepository.findDone(new OffsetPageRequest(offset, limit + 1));
        boolean hasMore = tasks.size() > limit;
        List<TaskListItem> items = tasks.stream()
                .limit(limit)
                .map(task -> toListItem(task, now))
                .toList();
        return new TaskListResponse(items, hasMore);
    }

    private TaskListItem toListItem(Task task, LocalDateTime now) {
        TaskResponse response = TaskResponse.of(task, now, clock.getZone());
        // Phase 1 は親タスクのみ。サブタスクのまとめは Phase 2 で実装する
        return new TaskListItem(response, false, List.of(), new TaskListItem.Progress(0, 0),
                task.getDueDate(), task.getDueTime(), response.overdue());
    }

    public TaskCountsResponse counts() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        List<Task> todayTasks = taskRepository.findOpenDueOnOrBefore(today);
        int overdue = (int) todayTasks.stream().filter(t -> t.isOverdue(now)).count();
        return new TaskCountsResponse(
                todayTasks.size(),
                overdue,
                taskRepository.findOpenDueAfter(today).size(),
                taskRepository.findOpenWithoutDue().size());
    }

    public TaskResponse get(Long id) {
        Task task = findTask(id);
        return TaskResponse.of(task, LocalDateTime.now(clock), clock.getZone()).withDetail(null, List.of());
    }

    @Transactional
    public TaskResponse create(TaskCreateRequest request) {
        validateDue(request.dueDate(), request.dueTime());
        Task task = Task.create(
                request.title().strip(),
                blankToNull(request.memo()),
                request.dueDate(),
                request.dueTime(),
                request.priority() == null ? Priority.MEDIUM : request.priority(),
                Instant.now(clock));
        taskRepository.save(task);
        return TaskResponse.of(task, LocalDateTime.now(clock), clock.getZone());
    }

    @Transactional
    public TaskResponse update(Long id, TaskUpdateRequest request) {
        validateDue(request.dueDate(), request.dueTime());
        Task task = findTask(id);
        Instant now = Instant.now(clock);
        task.setTitle(request.title().strip());
        task.setMemo(blankToNull(request.memo()));
        task.setDue(request.dueDate(), request.dueTime());
        task.setPriority(request.priority());
        task.changeStatus(request.status(), now);
        task.touch(now);
        return TaskResponse.of(task, LocalDateTime.now(clock), clock.getZone());
    }

    @Transactional
    public StatusChangeResponse changeStatus(Long id, StatusChangeRequest request) {
        Task task = findTask(id);
        TaskStatus previous = task.getStatus();
        if (previous == request.status()) {
            return new StatusChangeResponse(List.of());
        }
        Instant now = Instant.now(clock);
        task.changeStatus(request.status(), now);
        task.touch(now);
        return new StatusChangeResponse(
                List.of(new StatusChangeResponse.Changed(task.getId(), previous, task.getStatus())));
    }

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

    @Transactional
    public void delete(Long id) {
        taskRepository.delete(findTask(id));
    }

    private Task findTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> ApiException.notFound("タスクが見つかりません"));
    }

    private static void validateDue(LocalDate dueDate, LocalTime dueTime) {
        if (dueDate == null && dueTime != null) {
            throw ApiException.validation("dueTime", "時刻だけの期限は設定できません。日付も入力してください");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /** offset 指定でページングするための PageRequest（Spring Data はページ番号指定のため） */
    private static final class OffsetPageRequest extends PageRequest {
        private final long offset;

        OffsetPageRequest(int offset, int limit) {
            super(0, limit, Sort.unsorted());
            this.offset = offset;
        }

        @Override
        public long getOffset() {
            return offset;
        }
    }
}
