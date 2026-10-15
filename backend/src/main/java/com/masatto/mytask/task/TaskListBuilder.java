package com.masatto.mytask.task;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.masatto.mytask.task.dto.TaskListItem;
import com.masatto.mytask.task.dto.TaskResponse;

/**
 * ビューの条件を満たしたタスクを、親単位の一覧の行（TaskListItem）にまとめる（api-design 3.2）。
 *
 * <ul>
 * <li>親自身が条件を満たす → 通常表示。サブタスクはすべて表示する</li>
 * <li>サブタスクだけが条件を満たす → 親をコンテキスト表示（contextOnly）にし、条件を満たすサブタスクだけを表示する</li>
 * <li>グループ分け・並び順に使う viewDate/viewTime は、条件を満たしたタスクの中で最も早い期限（完了済みビューは最新の完了日）</li>
 * </ul>
 */
final class TaskListBuilder {

    /** 期限の早い順（日付なしは最後、同日の時刻なしはその日の最後） */
    private static final Comparator<Task> BY_DUE = Comparator
            .comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Task::getDueTime, Comparator.nullsLast(Comparator.naturalOrder()));

    /** 完了済み以外のビューの並び順：期限日 → 期限時刻 → 優先度 → 作成日時 */
    static final Comparator<TaskListItem> OPEN_ORDER = Comparator
            .comparing(TaskListItem::viewDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(TaskListItem::viewTime, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing((TaskListItem i) -> i.task().priority())
            .thenComparing(i -> i.task().createdAt())
            .thenComparing(i -> i.task().id());

    private final Map<Long, Task> parentsById;
    private final Map<Long, List<Task>> subtasksByParent;
    private final Map<Long, String> ruleTitles;
    private final LocalDateTime now;
    private final ZoneId zone;

    /**
     * @param parentsById      matched に含まれるタスクの親（ルート）すべて
     * @param subtasksByParent 親IDごとの全サブタスク（作成順）
     * @param ruleTitles       生成元ルールのID → タイトル
     */
    TaskListBuilder(Map<Long, Task> parentsById, Map<Long, List<Task>> subtasksByParent,
            Map<Long, String> ruleTitles, LocalDateTime now, ZoneId zone) {
        this.parentsById = parentsById;
        this.subtasksByParent = subtasksByParent;
        this.ruleTitles = ruleTitles;
        this.now = now;
        this.zone = zone;
    }

    /** 未完了ビュー用。並び順を確定させて返す */
    List<TaskListItem> buildOpen(Collection<Task> matched) {
        return group(matched).entrySet().stream()
                .map(e -> toOpenItem(e.getKey(), e.getValue()))
                .sorted(OPEN_ORDER)
                .toList();
    }

    /** 完了済みビュー用。matched は完了日時の新しい順であること（その順を保つ） */
    List<TaskListItem> buildDone(Collection<Task> matched) {
        return group(matched).entrySet().stream()
                .map(e -> toDoneItem(e.getKey(), e.getValue()))
                .toList();
    }

    /** 親IDごとにまとめる（入力の順序を保つ） */
    static Map<Long, List<Task>> group(Collection<Task> matched) {
        Map<Long, List<Task>> groups = new LinkedHashMap<>();
        for (Task task : matched) {
            groups.computeIfAbsent(task.rootId(), k -> new ArrayList<>()).add(task);
        }
        return groups;
    }

    private TaskListItem toOpenItem(Long rootId, List<Task> matched) {
        Task first = matched.stream().min(BY_DUE).orElseThrow();
        boolean overdue = matched.stream().anyMatch(t -> t.isOverdue(now));
        return toItem(rootId, matched, first.getDueDate(), first.getDueTime(), overdue);
    }

    private TaskListItem toDoneItem(Long rootId, List<Task> matched) {
        Instant latest = matched.stream().map(Task::getCompletedAt).max(Comparator.naturalOrder()).orElseThrow();
        return toItem(rootId, matched, latest.atZone(zone).toLocalDate(), null, false);
    }

    private TaskListItem toItem(Long rootId, List<Task> matched, LocalDate viewDate, LocalTime viewTime,
            boolean viewOverdue) {
        Task parent = parentsById.get(rootId);
        List<Task> allSubtasks = subtasksByParent.getOrDefault(rootId, List.of());
        boolean parentMatched = matched.stream().anyMatch(t -> !t.isSubtask());

        Set<Long> matchedIds = new HashSet<>();
        matched.forEach(t -> matchedIds.add(t.getId()));
        List<Task> shown = parentMatched
                ? allSubtasks
                : allSubtasks.stream().filter(t -> matchedIds.contains(t.getId())).toList();

        int done = (int) allSubtasks.stream().filter(Task::isDone).count();
        return new TaskListItem(
                toResponse(parent),
                !parentMatched,
                shown.stream().map(this::toResponse).toList(),
                new TaskListItem.Progress(done, allSubtasks.size()),
                viewDate,
                viewTime,
                viewOverdue);
    }

    private TaskResponse toResponse(Task task) {
        return TaskResponse.of(task, now, zone, ruleTitles);
    }
}
