package com.masatto.mytask.plan;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 期限のないサブタスクに、ステップ（親タスク）の期間の中で期限を割り振る（api-design 11.2）。
 * 親の期限だけだと、サブタスクが遅れていても親の期限を過ぎるまで気づけないため。
 *
 * <p>期間は「前のステップの期限の翌日（それが過ぎていれば今日）」から「親の期限」まで。
 * 目安時間の割合で日付を進め、最後のサブタスクが親の期限に来るようにする。
 * 目安のないサブタスクは、目安のあるサブタスクの平均（1つもなければ同じ重さ）として扱う。
 */
final class SubtaskScheduler {

    private SubtaskScheduler() {
    }

    /** 期間の始まり。前のステップの期限の翌日。期限がない・それが過ぎているなら今日 */
    static LocalDate windowStart(LocalDate previousDue, LocalDate today) {
        if (previousDue == null) {
            return today;
        }
        LocalDate next = previousDue.plusDays(1);
        return next.isBefore(today) ? today : next;
    }

    /**
     * @param start 期間の始まり（{@link #windowStart}）
     * @param due 親の期限
     * @param estimates 割り振るサブタスクの目安（並び順どおり。null は目安なし）
     * @return 各サブタスクの期限（estimates と同じ順）。期間が無い（始まりが期限より後）ならすべて親の期限
     */
    static List<LocalDate> spread(LocalDate start, LocalDate due, List<Integer> estimates) {
        if (estimates.isEmpty()) {
            return List.of();
        }
        long days = ChronoUnit.DAYS.between(start, due) + 1;
        if (days <= 1) {
            return estimates.stream().map(e -> due).toList();
        }
        List<Double> weights = weights(estimates);
        double total = weights.stream().mapToDouble(Double::doubleValue).sum();
        List<LocalDate> dates = new ArrayList<>();
        double cumulative = 0;
        for (double weight : weights) {
            cumulative += weight;
            // 累積の割合だけ期間を進めた日。端数は切り上げ、最後は必ず親の期限になる
            // （割り算の誤差で 2.0000001 のような値を 3 に切り上げないよう、わずかに引いてから切り上げる）
            long index = (long) Math.ceil(cumulative / total * days - 1e-9) - 1;
            dates.add(start.plusDays(Math.clamp(index, 0, days - 1)));
        }
        return dates;
    }

    private static List<Double> weights(List<Integer> estimates) {
        List<Integer> present = estimates.stream().filter(Objects::nonNull).filter(e -> e > 0).toList();
        double fallback = present.isEmpty() ? 1 : present.stream().mapToInt(Integer::intValue).average().orElse(1);
        return estimates.stream().map(e -> e == null || e <= 0 ? fallback : e.doubleValue()).toList();
    }
}
