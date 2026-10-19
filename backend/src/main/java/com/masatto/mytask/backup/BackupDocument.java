package com.masatto.mytask.backup;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.masatto.mytask.area.AreaColor;
import com.masatto.mytask.rule.dto.PatternDto;
import com.masatto.mytask.rule.dto.RuleRequest;
import com.masatto.mytask.task.Priority;
import com.masatto.mytask.task.TaskStatus;

/**
 * バックアップファイルの形式（api-design 6.1）。タスクとルールを ID も含めてそのまま持つ。
 * 形式を変えるときは VERSION を上げ、古い形式の読み込みを考えること。
 * <ul>
 * <li>1：タスクとルール</li>
 * <li>2：エリアを追加（areas と、タスク・ルールの areaId）。1 を取り込むときはエリアを変えず、すべて未分類にする</li>
 * </ul>
 */
public record BackupDocument(
        String format,
        Integer version,
        OffsetDateTime exportedAt,
        List<TaskData> tasks,
        List<RuleData> rules,
        List<AreaData> areas) {

    public static final String FORMAT = "mytask-manager-backup";
    public static final int VERSION = 2;

    public record TaskData(
            Long id,
            String title,
            String memo,
            LocalDate dueDate,
            @JsonFormat(pattern = "HH:mm") LocalTime dueTime,
            Priority priority,
            TaskStatus status,
            OffsetDateTime completedAt,
            Long parentId,
            Long recurrenceRuleId,
            LocalDate occurrenceDate,
            Long areaId,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {
    }

    public record RuleData(
            Long id,
            String title,
            String memo,
            Priority priority,
            @JsonFormat(pattern = "HH:mm") LocalTime dueTime,
            PatternDto pattern,
            LocalDate startDate,
            LocalDate endDate,
            Boolean active,
            LocalDate lastGeneratedDate,
            List<RuleRequest.Template> subtaskTemplates,
            Long areaId,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {
    }

    /** エリア。並び順は配列の順 */
    public record AreaData(
            Long id,
            String name,
            AreaColor color,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {
    }
}
