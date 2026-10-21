package com.masatto.mytask.task.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import com.masatto.mytask.task.Priority;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** POST /api/tasks（api-design 3.5）。parentId を指定するとサブタスクになる（エリアは親に合わせ、areaId は使わない） */
public record TaskCreateRequest(
        @NotBlank(message = "タイトルは必須です") @Size(max = 200, message = "タイトルは200文字以内で入力してください") String title,
        @Size(max = 10000, message = "メモは10000文字以内で入力してください") String memo,
        LocalDate dueDate,
        LocalTime dueTime,
        Priority priority,
        Long parentId,
        Long areaId,
        @Min(value = 1, message = "目安時間は1〜9999分で入力してください") @Max(value = 9999, message = "目安時間は1〜9999分で入力してください") Integer estimateMinutes) {
}
