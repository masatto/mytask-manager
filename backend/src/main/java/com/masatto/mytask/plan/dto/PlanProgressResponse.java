package com.masatto.mytask.plan.dto;

import java.time.LocalDate;
import java.util.List;

import com.masatto.mytask.task.TaskStatus;

/**
 * 計画ごとの進み具合（api-design 11章）。
 * タイトルが「<計画名> <番号>: <内容>」の親タスクを計画名でまとめる（例：「韓国語学習 Step3: …」）。
 */
public record PlanProgressResponse(List<Plan> items) {

    public enum PlanState {
        /** すべてのステップが完了 */
        DONE,
        /** 期限を過ぎた未完了のステップ（またはその中のサブタスク）がある */
        BEHIND,
        /** 期限を過ぎた未完了のステップがない */
        ON_TRACK
    }

    /**
     * @param totalMinutes 全ステップの目安の合計（目安が1つもなければ null）
     * @param remainingMinutes 未完了のステップの残りの目安の合計
     * @param finalDueDate 最後のステップの期限（期限のあるステップがなければ null）
     * @param daysLeft 今日から最終期限までの日数（今日を含む。過ぎていれば 0 以下）
     * @param weeklyMinutesNeeded 残りの目安を最終期限までに終えるのに必要な1週間あたりの時間（分）。
     *                            最終期限が過ぎている・目安がない・完了済みなら null
     * @param nextStepId 次にやるステップ（未完了で番号が一番小さいもの）
     * @param unscheduledSubtasks 期限を割り振れる（期限のある未完了のステップの下で、期限のない未完了の）サブタスクの数
     */
    public record Plan(
            String name,
            Long areaId,
            PlanState state,
            int totalSteps,
            int doneSteps,
            int overdueSteps,
            Integer totalMinutes,
            Integer remainingMinutes,
            LocalDate finalDueDate,
            Integer daysLeft,
            Integer weeklyMinutesNeeded,
            Long nextStepId,
            int unscheduledSubtasks,
            List<Step> steps) {
    }

    /**
     * @param estimateMinutes ステップ全体の目安（サブタスクに目安があればその合計、なければ親の目安）
     * @param remainingMinutes 残りの目安（完了なら 0）
     * @param overdue 親の期限を過ぎているか、期限を過ぎた未完了のサブタスクがある（未完了のステップのみ）
     * @param overdueSubtasks 期限を過ぎた未完了のサブタスクの数
     */
    public record Step(
            Long id,
            String title,
            int number,
            TaskStatus status,
            LocalDate dueDate,
            boolean overdue,
            Integer estimateMinutes,
            Integer remainingMinutes,
            int subtasksDone,
            int subtasksTotal,
            int overdueSubtasks) {
    }
}
