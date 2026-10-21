package com.masatto.mytask.task.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import com.masatto.mytask.task.Priority;
import com.masatto.mytask.task.TaskStatus;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** PUT /api/tasks/{id}（api-design 3.6）。全項目を送る。areaId はサブタスクでは使わない（親に合わせる） */
public record TaskUpdateRequest(
        @NotBlank(message = "タイトルは必須です") @Size(max = 200, message = "タイトルは200文字以内で入力してください") String title,
        @Size(max = 10000, message = "メモは10000文字以内で入力してください") String memo,
        LocalDate dueDate,
        LocalTime dueTime,
        @NotNull(message = "優先度は必須です") Priority priority,
        @NotNull(message = "ステータスは必須です") TaskStatus status,
        Long areaId,
        @Min(value = 1, message = "目安時間は1〜9999分で入力してください") @Max(value = 9999, message = "目安時間は1〜9999分で入力してください") Integer estimateMinutes) {
}
