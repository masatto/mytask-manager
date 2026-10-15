package com.masatto.mytask.rule.dto;

import java.time.LocalDate;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/** POST /api/rules/preview。RuleRequest のうちパターンと期間だけを使う（api-design 4.2） */
public record RulePreviewRequest(
        @NotNull(message = "パターンは必須です") @Valid PatternDto pattern,
        @NotNull(message = "開始日は必須です") LocalDate startDate,
        LocalDate endDate) {
}
