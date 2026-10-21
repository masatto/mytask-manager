package com.masatto.mytask.plan;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.masatto.mytask.plan.dto.PlanProgressResponse;
import com.masatto.mytask.plan.dto.PlanProgressResponse.Plan;
import com.masatto.mytask.plan.dto.PlanProgressResponse.PlanState;
import com.masatto.mytask.plan.dto.PlanProgressResponse.Step;
import com.masatto.mytask.task.Estimates;
import com.masatto.mytask.task.Task;
import com.masatto.mytask.task.TaskRepository;
import com.masatto.mytask.task.TaskStatus;

import lombok.RequiredArgsConstructor;

/**
 * 計画の進み具合（api-design 11章）。計画の取り込みで作る「<計画名> <番号>: <内容>」の親タスクを、計画名でまとめて集計する。
 * 計画という入れ物は持たず、タイトルの決まりだけで判定する（取り込み以外で作ったタスクも、同じ形のタイトルなら入る）。
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlanProgressService {

    /** 「韓国語学習 Step3: …」「expense-flow Step10：…」「読書 第2回: …」。番号の前後の語は問わない */
    static final Pattern STEP_TITLE = Pattern.compile("^(.+?)\\s+\\S*?(\\d+)\\S*?\\s*[:：]");
    /** 1ステップだけのものは計画とみなさない（たまたま形が合っただけのタスクを出さないため） */
    static final int MIN_STEPS = 2;

    private final TaskRepository taskRepository;
    private final Clock clock;

    private record Parsed(Task task, String name, int number) {
    }

    /** @param areaId 指定すると、そのエリアのステップだけで集計する（null ならすべて） */
    public PlanProgressResponse list(Long areaId) {
        LocalDate today = LocalDate.now(clock);
        Map<String, List<Parsed>> byName = new LinkedHashMap<>();
        for (Task task : taskRepository.findByParentIdIsNull()) {
            if (areaId != null && !areaId.equals(task.getAreaId())) {
                continue;
            }
            Matcher m = STEP_TITLE.matcher(task.getTitle());
            if (m.find()) {
                byName.computeIfAbsent(m.group(1).strip(), k -> new ArrayList<>())
                        .add(new Parsed(task, m.group(1).strip(), Integer.parseInt(m.group(2))));
            }
        }
        List<Long> parentIds = byName.values().stream().flatMap(List::stream).map(p -> p.task().getId()).toList();
        Map<Long, List<Task>> subtasks = taskRepository.findByParentIdInOrderByIdAsc(parentIds).stream()
                .collect(Collectors.groupingBy(Task::getParentId));

        List<Plan> plans = byName.values().stream()
                .filter(steps -> steps.size() >= MIN_STEPS)
                .map(steps -> toPlan(steps, subtasks, today))
                // 進行中の計画を上に、その中では最終期限の近い順
                .sorted(Comparator.comparing((Plan p) -> p.state() == PlanState.DONE)
                        .thenComparing(Plan::finalDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Plan::name))
                .toList();
        return new PlanProgressResponse(plans);
    }

    private static Plan toPlan(List<Parsed> parsed, Map<Long, List<Task>> subtasksByParent, LocalDate today) {
        List<Step> steps = parsed.stream()
                .sorted(Comparator.comparingInt(Parsed::number).thenComparing(p -> p.task().getId()))
                .map(p -> toStep(p, subtasksByParent.getOrDefault(p.task().getId(), List.of()), today))
                .toList();
        int doneSteps = (int) steps.stream().filter(PlanProgressService::isDone).count();
        int overdue = (int) steps.stream().filter(Step::overdue).count();
        Integer total = sumOrNull(steps.stream().map(Step::estimateMinutes).toList());
        // 完了のステップは残り 0 を返すので、目安が1つもない計画で「残り 0」にならないよう total に合わせる
        Integer remaining = total == null ? null : sumOrNull(steps.stream().map(Step::remainingMinutes).toList());
        LocalDate finalDue = steps.stream().map(Step::dueDate).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(null);
        Integer daysLeft = finalDue == null ? null : (int) ChronoUnit.DAYS.between(today, finalDue) + 1;

        PlanState state = doneSteps == steps.size() ? PlanState.DONE
                : overdue > 0 ? PlanState.BEHIND : PlanState.ON_TRACK;
        Integer weekly = state == PlanState.DONE || remaining == null || remaining == 0 || daysLeft == null
                || daysLeft <= 0 ? null : (int) Math.ceil(remaining * 7.0 / daysLeft);
        Long next = steps.stream().filter(s -> !isDone(s)).map(Step::id).findFirst().orElse(null);
        return new Plan(parsed.getFirst().name(), parsed.getFirst().task().getAreaId(), state, steps.size(), doneSteps,
                overdue, total, remaining, finalDue, daysLeft, weekly, next, steps);
    }

    private static boolean isDone(Step step) {
        return step.status() == TaskStatus.DONE;
    }

    private static Step toStep(Parsed p, List<Task> subtasks, LocalDate today) {
        Task t = p.task();
        boolean overdue = !t.isDone() && t.getDueDate() != null && t.getDueDate().isBefore(today);
        return new Step(t.getId(), t.getTitle(), p.number(), t.getStatus(), t.getDueDate(), overdue,
                Estimates.total(t, subtasks), Estimates.remaining(t, subtasks),
                (int) subtasks.stream().filter(Task::isDone).count(), subtasks.size());
    }

    private static Integer sumOrNull(List<Integer> values) {
        List<Integer> present = values.stream().filter(Objects::nonNull).toList();
        return present.isEmpty() ? null : present.stream().mapToInt(Integer::intValue).sum();
    }
}
