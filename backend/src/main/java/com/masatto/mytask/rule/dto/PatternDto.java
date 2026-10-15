package com.masatto.mytask.rule.dto;

import java.util.Set;

import com.masatto.mytask.rule.PatternType;
import com.masatto.mytask.rule.Weekday;

import jakarta.validation.constraints.NotNull;

/**
 * 繰り返しパターン（api-design 4.1）。
 * daysOfWeek は WEEKLY、dayOfMonth は MONTHLY のときだけ使う（それ以外のときに送られた値は無視する）。
 */
public record PatternDto(
        @NotNull(message = "パターンは必須です") PatternType type,
        Set<Weekday> daysOfWeek,
        Integer dayOfMonth) {
}
