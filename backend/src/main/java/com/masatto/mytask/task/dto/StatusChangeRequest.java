package com.masatto.mytask.task.dto;

import com.masatto.mytask.task.TaskStatus;

import jakarta.validation.constraints.NotNull;

/** PATCH /api/tasks/{id}/status（api-design 3.7） */
public record StatusChangeRequest(
        @NotNull(message = "ステータスは必須です") TaskStatus status,
        Boolean completeSubtasks) {
}
