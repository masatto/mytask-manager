package com.masatto.mytask.plan.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * POST /api/plan-import（api-design 9章）。AI が出力した作業分割をまとめて登録する。
 * 日付・時刻・優先度は、どの項目が誤っているかを返せるように文字列で受けてサービスで解釈する。
 *
 * @param scheduleSubtasks 期限のないサブタスクに、ステップの期間の中で期限を割り振るか（省略時は割り振る。api-design 11.2）
 */
public record PlanImportRequest(
        Long areaId,
        Boolean scheduleSubtasks,
        @NotEmpty(message = "タスクが1件もありません")
        @Size(max = 100, message = "親タスクは100件までです") List<@Valid PlanTask> tasks) {

    public record PlanTask(
            @NotBlank(message = "タイトルは必須です") @Size(max = 200, message = "タイトルは200文字以内にしてください") String title,
            @Size(max = 10000, message = "メモは10000文字以内にしてください") String memo,
            String dueDate,
            String dueTime,
            String priority,
            Boolean done,
            @Min(value = 1, message = "目安時間は1〜9999分にしてください") @Max(value = 9999, message = "目安時間は1〜9999分にしてください") Integer estimateMinutes,
            @Size(max = 50, message = "サブタスクは50件までです") List<@Valid PlanSubtask> subtasks) {
    }

    public record PlanSubtask(
            @NotBlank(message = "タイトルは必須です") @Size(max = 200, message = "タイトルは200文字以内にしてください") String title,
            @Size(max = 10000, message = "メモは10000文字以内にしてください") String memo,
            String dueDate,
            String dueTime,
            String priority,
            Boolean done,
            @Min(value = 1, message = "目安時間は1〜9999分にしてください") @Max(value = 9999, message = "目安時間は1〜9999分にしてください") Integer estimateMinutes) {
    }
}
