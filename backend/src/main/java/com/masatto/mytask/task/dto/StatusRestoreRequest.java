package com.masatto.mytask.task.dto;

import java.util.List;

import com.masatto.mytask.task.TaskStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/** PATCH /api/tasks/statuses（api-design 3.8） */
public record StatusRestoreRequest(@NotEmpty List<@Valid Change> changes) {

    public record Change(@NotNull Long id, @NotNull TaskStatus status) {
    }
}
