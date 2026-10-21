package com.masatto.mytask.task;

import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * 目安時間の集計（api-design 10章）。
 *
 * サブタスクに目安があるときは、サブタスクの目安がその作業の内訳なので親の目安は数えない
 * （親とサブタスクの両方を足すと同じ作業を二重に数えてしまうため）。サブタスクに目安がなければ親の目安を使う。
 */
public final class Estimates {

    private Estimates() {
    }

    /** 目安のあるものだけの合計。1件もなければ null */
    public static Integer sum(Collection<Task> tasks) {
        List<Integer> values = tasks.stream().map(Task::getEstimateMinutes).filter(Objects::nonNull).toList();
        return values.isEmpty() ? null : values.stream().mapToInt(Integer::intValue).sum();
    }

    public static boolean hasSubtaskEstimates(Collection<Task> subtasks) {
        return subtasks.stream().anyMatch(s -> s.getEstimateMinutes() != null);
    }

    /** 親タスク1件の作業全体の目安。サブタスクに目安があればその合計、なければ親の目安 */
    public static Integer total(Task parent, Collection<Task> subtasks) {
        return hasSubtaskEstimates(subtasks) ? sum(subtasks) : parent.getEstimateMinutes();
    }

    /** 親タスク1件の残りの目安。完了なら 0。サブタスクに目安があれば未完了のサブタスクの合計 */
    public static Integer remaining(Task parent, Collection<Task> subtasks) {
        if (parent.isDone()) {
            return 0;
        }
        if (hasSubtaskEstimates(subtasks)) {
            Integer open = sum(subtasks.stream().filter(s -> !s.isDone()).toList());
            return open == null ? 0 : open;
        }
        return parent.getEstimateMinutes();
    }
}
