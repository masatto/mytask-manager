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
import java.util.Optional;
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
 *
 * <ol>
 * <li>親タスクのタイトルを読み、計画名と番号に分ける（{@link #parseTitle}）</li>
 * <li>計画名ごとにまとめ、2ステップ以上あるものだけを計画にする</li>
 * <li>計画ごとに、ステップの目安・期限から残りと必要なペースを計算する（{@link #toPlan}）</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlanProgressService {

    /**
     * 「韓国語学習 Step3: …」「expense-flow Step10：…」「読書 第2回: …」。
     * 1つ目のグループが計画名、2つ目が番号。番号の前後の語（Step・第・回）は問わない。
     */
    static final Pattern STEP_TITLE = Pattern.compile("^(.+?)\\s+\\S*?(\\d+)\\S*?\\s*[:：]");

    /** 1ステップだけのものは計画とみなさない（たまたま形が合っただけのタスクを出さないため） */
    static final int MIN_STEPS = 2;

    /** 進行中の計画を上に、その中では最終期限の近い順（期限なしは後ろ） */
    private static final Comparator<Plan> PLAN_ORDER = Comparator
            .comparing((Plan p) -> p.state() == PlanState.DONE)
            .thenComparing(Plan::finalDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Plan::name);

    private final TaskRepository taskRepository;
    private final Clock clock;

    /** タイトルから読み取った計画名と番号 */
    record StepTitle(String planName, int number) {
    }

    /** 計画のステップになる親タスク */
    private record StepTask(Task task, StepTitle title) {
    }

    /** @param areaId 指定すると、そのエリアのステップだけで集計する（null ならすべて） */
    public PlanProgressResponse list(Long areaId) {
        Map<String, List<StepTask>> stepsByPlan = stepsByPlanName(areaId);
        Map<Long, List<Task>> subtasksByParent = subtasksOf(stepsByPlan);
        LocalDate today = LocalDate.now(clock);

        List<Plan> plans = stepsByPlan.values().stream()
                .filter(steps -> steps.size() >= MIN_STEPS)
                .map(steps -> toPlan(steps, subtasksByParent, today))
                .sorted(PLAN_ORDER)
                .toList();
        return new PlanProgressResponse(plans);
    }

    /** 「<計画名> <番号>: …」の形なら計画名と番号を返す */
    static Optional<StepTitle> parseTitle(String title) {
        Matcher m = STEP_TITLE.matcher(title);
        if (!m.find()) {
            return Optional.empty();
        }
        return Optional.of(new StepTitle(m.group(1).strip(), Integer.parseInt(m.group(2))));
    }

    private Map<String, List<StepTask>> stepsByPlanName(Long areaId) {
        Map<String, List<StepTask>> byName = new LinkedHashMap<>();
        for (Task task : taskRepository.findByParentIdIsNull()) {
            if (areaId != null && !areaId.equals(task.getAreaId())) {
                continue;
            }
            parseTitle(task.getTitle()).ifPresent(title -> byName
                    .computeIfAbsent(title.planName(), k -> new ArrayList<>())
                    .add(new StepTask(task, title)));
        }
        return byName;
    }

    /** ステップのサブタスクを親IDでまとめて取得する（ステップごとに取得すると N+1 になるため） */
    private Map<Long, List<Task>> subtasksOf(Map<String, List<StepTask>> stepsByPlan) {
        List<Long> parentIds = stepsByPlan.values().stream()
                .flatMap(List::stream)
                .map(s -> s.task().getId())
                .toList();
        return taskRepository.findByParentIdInOrderByIdAsc(parentIds).stream()
                .collect(Collectors.groupingBy(Task::getParentId));
    }

    private static Plan toPlan(List<StepTask> stepTasks, Map<Long, List<Task>> subtasksByParent, LocalDate today) {
        List<Step> steps = stepTasks.stream()
                .sorted(Comparator.comparingInt((StepTask s) -> s.title().number()).thenComparing(s -> s.task().getId()))
                .map(s -> toStep(s, subtasksByParent.getOrDefault(s.task().getId(), List.of()), today))
                .toList();

        int doneSteps = (int) steps.stream().filter(PlanProgressService::isDone).count();
        int overdueSteps = (int) steps.stream().filter(Step::overdue).count();
        PlanState state = stateOf(steps.size(), doneSteps, overdueSteps);

        Integer totalMinutes = Estimates.sumMinutes(steps.stream().map(Step::estimateMinutes).toList());
        // 完了のステップは残り 0 を返すので、目安が1つもない計画で「残り 0」にならないよう全体に合わせて null にする
        Integer remainingMinutes = totalMinutes == null ? null
                : Estimates.sumMinutes(steps.stream().map(Step::remainingMinutes).toList());

        LocalDate finalDueDate = steps.stream()
                .map(Step::dueDate)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        Integer daysLeft = finalDueDate == null ? null : daysLeft(today, finalDueDate);
        Long nextStepId = steps.stream().filter(s -> !isDone(s)).map(Step::id).findFirst().orElse(null);

        return new Plan(stepTasks.getFirst().title().planName(), stepTasks.getFirst().task().getAreaId(), state,
                steps.size(), doneSteps, overdueSteps, totalMinutes, remainingMinutes, finalDueDate, daysLeft,
                weeklyMinutesNeeded(state, remainingMinutes, daysLeft), nextStepId, steps);
    }

    private static Step toStep(StepTask stepTask, List<Task> subtasks, LocalDate today) {
        Task task = stepTask.task();
        boolean overdue = !task.isDone() && task.getDueDate() != null && task.getDueDate().isBefore(today);
        int subtasksDone = (int) subtasks.stream().filter(Task::isDone).count();
        return new Step(task.getId(), task.getTitle(), stepTask.title().number(), task.getStatus(), task.getDueDate(),
                overdue, Estimates.total(task, subtasks), Estimates.remaining(task, subtasks), subtasksDone,
                subtasks.size());
    }

    private static PlanState stateOf(int totalSteps, int doneSteps, int overdueSteps) {
        if (doneSteps == totalSteps) {
            return PlanState.DONE;
        }
        return overdueSteps > 0 ? PlanState.BEHIND : PlanState.ON_TRACK;
    }

    /** 今日から最終期限までの日数（今日を含む）。最終期限が今日なら 1、過ぎていれば 0 以下 */
    private static int daysLeft(LocalDate today, LocalDate finalDueDate) {
        return (int) ChronoUnit.DAYS.between(today, finalDueDate) + 1;
    }

    /** 残りの目安を最終期限までに終えるのに必要な1週間あたりの分。計算できない・意味がないときは null */
    private static Integer weeklyMinutesNeeded(PlanState state, Integer remainingMinutes, Integer daysLeft) {
        if (state == PlanState.DONE || remainingMinutes == null || remainingMinutes == 0
                || daysLeft == null || daysLeft <= 0) {
            return null;
        }
        return (int) Math.ceil(remainingMinutes * 7.0 / daysLeft);
    }

    private static boolean isDone(Step step) {
        return step.status() == TaskStatus.DONE;
    }
}
