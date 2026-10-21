package com.masatto.mytask.plan.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * サブタスクの期限の割り振り（api-design 11.2）。dryRun でも同じ形で返す。
 *
 * @param count 期限を割り振った（dryRun では割り振る）サブタスクの数
 */
public record SubtaskScheduleResponse(int count, List<Item> subtasks) {

    /** @param stepId サブタスクが属するステップ（親タスク） */
    public record Item(Long id, String title, Long stepId, LocalDate dueDate) {
    }
}
