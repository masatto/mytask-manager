package com.masatto.mytask.rule.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.masatto.mytask.task.Priority;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** POST / PUT /api/rules（api-design 4.1） */
public record RuleRequest(
        @NotBlank(message = "タイトルは必須です") @Size(max = 200, message = "タイトルは200文字以内で入力してください") String title,
        @Size(max = 10000, message = "メモは10000文字以内で入力してください") String memo,
        @NotNull(message = "優先度は必須です") Priority priority,
        LocalTime dueTime,
        @NotNull(message = "パターンは必須です") @Valid PatternDto pattern,
        @NotNull(message = "開始日は必須です") LocalDate startDate,
        LocalDate endDate,
        Boolean active,
        Long areaId,
        @Min(value = 1, message = "目安時間は1〜9999分で入力してください") @Max(value = 9999, message = "目安時間は1〜9999分で入力してください") Integer estimateMinutes,
        @Size(max = 20, message = "サブタスクのひな形は20件までです") List<@Valid Template> subtaskTemplates) {

    public record Template(
            @NotBlank(message = "サブタスクのタイトルは必須です") @Size(max = 200, message = "タイトルは200文字以内で入力してください") String title,
            @NotNull(message = "優先度は必須です") Priority priority,
            @Min(value = 1, message = "目安時間は1〜9999分で入力してください") @Max(value = 9999, message = "目安時間は1〜9999分で入力してください") Integer estimateMinutes) {
    }
}
