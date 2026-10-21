package com.masatto.mytask.rule.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.masatto.mytask.rule.RecurrenceRule;
import com.masatto.mytask.task.Priority;

/** api-design 4.1 の RuleResponse */
public record RuleResponse(
        Long id,
        String title,
        String memo,
        Priority priority,
        @JsonFormat(pattern = "HH:mm") LocalTime dueTime,
        PatternDto pattern,
        LocalDate startDate,
        LocalDate endDate,
        boolean active,
        Long areaId,
        Integer estimateMinutes,
        List<RuleRequest.Template> subtaskTemplates,
        LocalDate nextOccurrence,
        LocalDate lastGeneratedDate,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static RuleResponse of(RecurrenceRule rule, LocalDate today, ZoneId zone) {
        return new RuleResponse(
                rule.getId(),
                rule.getTitle(),
                rule.getMemo(),
                rule.getPriority(),
                rule.getDueTime(),
                new PatternDto(rule.getPatternType(), rule.getDaysOfWeek(), rule.getDayOfMonth()),
                rule.getStartDate(),
                rule.getEndDate(),
                rule.isActive(),
                rule.getAreaId(),
                rule.getEstimateMinutes(),
                rule.getSubtaskTemplates().stream()
                        .map(t -> new RuleRequest.Template(t.getTitle(), t.getPriority(), t.getEstimateMinutes()))
                        .toList(),
                rule.nextOccurrence(today).orElse(null),
                rule.getLastGeneratedDate(),
                rule.getCreatedAt().atZone(zone).toOffsetDateTime(),
                rule.getUpdatedAt().atZone(zone).toOffsetDateTime());
    }
}
