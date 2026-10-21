package com.masatto.mytask.plan.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.masatto.mytask.task.Priority;

/**
 * 計画の取り込みの結果（api-design 9章）。dryRun でも同じ形で返し、id だけが null になる。
 *
 * @param created 登録した（dryRun では登録する）親タスクの数
 * @param skipped 同じタイトルの親タスクがあるため飛ばした数
 */
public record PlanImportResponse(int created, int skipped, List<Row> tasks) {

    public enum Action {
        CREATE, SKIP_DUPLICATE
    }

    public record Row(
            Action action,
            Long id,
            String title,
            LocalDate dueDate,
            @JsonFormat(pattern = "HH:mm") LocalTime dueTime,
            Priority priority,
            boolean done,
            Integer estimateMinutes,
            List<SubRow> subtasks) {
    }

    public record SubRow(String title, boolean done, Integer estimateMinutes) {
    }
}
