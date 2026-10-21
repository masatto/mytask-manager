package com.masatto.mytask.task;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.masatto.mytask.area.AreaService;
import com.masatto.mytask.common.ApiException;
import com.masatto.mytask.task.dto.StatusChangeRequest;
import com.masatto.mytask.task.dto.StatusChangeResponse;
import com.masatto.mytask.task.dto.StatusRestoreRequest;
import com.masatto.mytask.task.dto.TaskCreateRequest;
import com.masatto.mytask.task.dto.TaskResponse;
import com.masatto.mytask.task.dto.TaskUpdateRequest;

import lombok.RequiredArgsConstructor;

/**
 * タスクの作成・更新・削除とステータスの変更（api-design 3.5〜3.9）。
 * 読み取り（一覧・件数・検索・詳細）は {@link TaskQueryService}。
 */
@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final AreaService areaService;
    private final TaskResponseMapper mapper;
    private final Clock clock;

    // ---- 作成・更新・削除 ------------------------------------------------------

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
        return mapper.toResponse(task, LocalDateTime.now(clock));
    }

    private Task findParentForNewSubtask(Long parentId) {
        Task parent = taskRepository.findById(parentId)
                .orElseThrow(() -> ApiException.validation("parentId", "親タスクが見つかりません"));
        if (parent.isSubtask()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NESTED_SUBTASK", "サブタスクの下にサブタスクは作れません");
        }
        return parent;
    }

    /** 全項目を置き換える（送られなかった項目は null になる。api-design 3.6） */
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
        task.touch(now);

        // サブタスクのエリアは親に合わせるので、親から受け取った areaId だけを使う
        boolean areaChanged = !task.isSubtask() && !Objects.equals(task.getAreaId(), request.areaId());
        if (areaChanged) {
            moveToArea(task, request.areaId());
            // 一括更新で永続化コンテキストが空になるので、読み直してから返す
            task = findTask(id);
        }
        return mapper.toResponse(task, LocalDateTime.now(clock));
    }

    /** 親とサブタスクをまとめて別のエリアに移す */
    private void moveToArea(Task parent, Long areaId) {
        areaService.checkExists(areaId, "areaId");
        parent.setAreaId(areaId);
        // サブタスクの一括更新は永続化コンテキストを空にするので、親の変更を先に書き込んでおく
        taskRepository.saveAndFlush(parent);
        taskRepository.updateSubtaskArea(parent.getId(), areaId);
    }

    public void delete(Long id) {
        // サブタスクは DB の ON DELETE CASCADE で一緒に削除される
        taskRepository.delete(findTask(id));
    }

    // ---- ステータス -----------------------------------------------------------

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
     * 状態が変わったタスクを changed に追加する（「元に戻す」で使う）。
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

    private static void validateDue(LocalDate dueDate, LocalTime dueTime) {
        if (dueDate == null && dueTime != null) {
            throw ApiException.validation("dueTime", "時刻だけの期限は設定できません。日付も入力してください");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
