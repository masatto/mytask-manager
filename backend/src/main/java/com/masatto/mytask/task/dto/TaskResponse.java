package com.masatto.mytask.task.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.masatto.mytask.task.Priority;
import com.masatto.mytask.task.Task;
import com.masatto.mytask.task.TaskStatus;

/**
 * api-design 3.1 の TaskResponse。
 * parent / subtasks は詳細取得（GET /tasks/{id}）のときだけ値を持つ。
 */
public record TaskResponse(
        Long id,
        String title,
        String memo,
        LocalDate dueDate,
        @JsonFormat(pattern = "HH:mm") LocalTime dueTime,
        Priority priority,
        TaskStatus status,
        OffsetDateTime completedAt,
        boolean overdue,
        Long parentId,
        Recurrence recurrence,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        @JsonInclude(JsonInclude.Include.NON_NULL) ParentSummary parent,
        @JsonInclude(JsonInclude.Include.NON_NULL) List<TaskResponse> subtasks) {

    public record Recurrence(Long ruleId, String ruleTitle, LocalDate occurrenceDate) {
    }

    public record ParentSummary(Long id, String title) {
    }

    /**
     * @param ruleTitles 生成元ルールのID → タイトル。ルールが削除済みなら ruleId も ruleTitle も null になる
     */
    public static TaskResponse of(Task task, LocalDateTime now, ZoneId zone, Map<Long, String> ruleTitles) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getMemo(),
                task.getDueDate(),
                task.getDueTime(),
                task.getPriority(),
                task.getStatus(),
                task.getCompletedAt() == null ? null : task.getCompletedAt().atZone(zone).toOffsetDateTime(),
                task.isOverdue(now),
                task.getParentId(),
                task.getOccurrenceDate() == null ? null
                        : new Recurrence(task.getRecurrenceRuleId(),
                                task.getRecurrenceRuleId() == null ? null : ruleTitles.get(task.getRecurrenceRuleId()),
                                task.getOccurrenceDate()),
                task.getCreatedAt().atZone(zone).toOffsetDateTime(),
                task.getUpdatedAt().atZone(zone).toOffsetDateTime(),
                null,
                null);
    }

    public TaskResponse withDetail(ParentSummary parent, List<TaskResponse> subtasks) {
        return new TaskResponse(id, title, memo, dueDate, dueTime, priority, status, completedAt, overdue,
                parentId, recurrence, createdAt, updatedAt, parent, subtasks);
    }
}
