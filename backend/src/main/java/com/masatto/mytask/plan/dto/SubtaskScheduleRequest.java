package com.masatto.mytask.plan.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /api/plans/schedule-subtasks（api-design 11.2）。name は GET /api/plans の計画名 */
public record SubtaskScheduleRequest(@NotBlank(message = "計画名は必須です") String name) {
}
