package com.masatto.mytask.plan;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.masatto.mytask.area.AreaService;
import com.masatto.mytask.common.ApiError;
import com.masatto.mytask.common.ApiException;
import com.masatto.mytask.plan.dto.PlanImportRequest;
import com.masatto.mytask.plan.dto.PlanImportResponse;
import com.masatto.mytask.plan.dto.PlanImportResponse.Action;
import com.masatto.mytask.task.Priority;
import com.masatto.mytask.task.Task;
import com.masatto.mytask.task.TaskRepository;
import com.masatto.mytask.task.TaskStatus;

import lombok.RequiredArgsConstructor;

/**
 * 計画の取り込み（api-design 9章）。親タスクとサブタスクをまとめて1つのトランザクションで登録する。
 * 同じタイトルの親タスクが既にあるものは飛ばす（同じ計画を2回取り込んでも二重にならない）。
 */
@Service
@RequiredArgsConstructor
public class PlanImportService {

    private final TaskRepository taskRepository;
    private final AreaService areaService;
    private final Clock clock;

    /** 入力を解釈した結果。親1件とそのサブタスク */
    private record ParsedTask(String title, String memo, LocalDate dueDate, LocalTime dueTime, Priority priority,
            boolean done, Integer estimateMinutes, List<ParsedTask> subtasks) {
    }

    @Transactional
    public PlanImportResponse importPlan(PlanImportRequest request, boolean dryRun) {
        areaService.checkExists(request.areaId(), "areaId");
        List<ParsedTask> parsed = parse(request);

        Instant now = Instant.now(clock);
        Set<String> seen = new HashSet<>();
        List<PlanImportResponse.Row> rows = new ArrayList<>();
        int created = 0;
        for (ParsedTask p : parsed) {
            boolean duplicate = !seen.add(p.title()) || taskRepository.existsByParentIdIsNullAndTitle(p.title());
            Long id = null;
            if (!duplicate) {
                created++;
                if (!dryRun) {
                    id = save(p, request.areaId(), now);
                }
            }
            rows.add(new PlanImportResponse.Row(
                    duplicate ? Action.SKIP_DUPLICATE : Action.CREATE,
                    id, p.title(), p.dueDate(), p.dueTime(), p.priority(), p.done(), p.estimateMinutes(),
                    p.subtasks().stream()
                            .map(s -> new PlanImportResponse.SubRow(s.title(), s.done(), s.estimateMinutes()))
                            .toList()));
        }
        return new PlanImportResponse(created, rows.size() - created, rows);
    }

    private Long save(ParsedTask p, Long areaId, Instant now) {
        Task parent = newTask(p, null, areaId, now);
        taskRepository.save(parent);
        boolean anyDone = false;
        for (ParsedTask s : p.subtasks()) {
            Task sub = newTask(s, parent.getId(), areaId, now);
            // 親を完了にするなら、サブタスクもすべて完了にする（未完了のサブタスクが残る完了の親は作れない）
            if (p.done() || s.done()) {
                sub.changeStatus(TaskStatus.DONE, now);
                anyDone = true;
            }
            taskRepository.save(sub);
        }
        if (p.done()) {
            parent.changeStatus(TaskStatus.DONE, now);
        } else if (anyDone) {
            parent.changeStatus(TaskStatus.IN_PROGRESS, now);
        }
        return parent.getId();
    }

    private static Task newTask(ParsedTask p, Long parentId, Long areaId, Instant now) {
        Task task = Task.create(p.title(), p.memo(), p.dueDate(), p.dueTime(), p.priority(), parentId, now);
        task.setAreaId(areaId);
        task.setEstimateMinutes(p.estimateMinutes());
        return task;
    }

    // ---- 入力の解釈 -----------------------------------------------------------

    /** 日付・時刻・優先度を解釈する。誤りはすべての項目について集めてから返す */
    private static List<ParsedTask> parse(PlanImportRequest request) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        List<ParsedTask> result = new ArrayList<>();
        for (int i = 0; i < request.tasks().size(); i++) {
            PlanImportRequest.PlanTask t = request.tasks().get(i);
            String path = "tasks[" + i + "]";
            List<ParsedTask> subtasks = new ArrayList<>();
            List<PlanImportRequest.PlanSubtask> subs = t.subtasks() == null ? List.of() : t.subtasks();
            for (int j = 0; j < subs.size(); j++) {
                PlanImportRequest.PlanSubtask s = subs.get(j);
                subtasks.add(parseOne(path + ".subtasks[" + j + "]", s.title(), s.memo(), s.dueDate(), s.dueTime(),
                        s.priority(), s.done(), s.estimateMinutes(), List.of(), errors));
            }
            result.add(parseOne(path, t.title(), t.memo(), t.dueDate(), t.dueTime(), t.priority(), t.done(),
                    t.estimateMinutes(), subtasks, errors));
        }
        if (!errors.isEmpty()) {
            throw ApiException.validation(errors);
        }
        return result;
    }

    private static ParsedTask parseOne(String path, String title, String memo, String dueDate, String dueTime,
            String priority, Boolean done, Integer estimateMinutes, List<ParsedTask> subtasks,
            List<ApiError.FieldError> errors) {
        LocalDate date = null;
        if (dueDate != null) {
            try {
                date = LocalDate.parse(dueDate);
            } catch (DateTimeParseException e) {
                errors.add(new ApiError.FieldError(path + ".dueDate", "日付は YYYY-MM-DD で指定してください"));
            }
        }
        LocalTime time = null;
        if (dueTime != null) {
            try {
                time = LocalTime.parse(dueTime);
            } catch (DateTimeParseException e) {
                errors.add(new ApiError.FieldError(path + ".dueTime", "時刻は HH:mm で指定してください"));
            }
            if (dueDate == null) {
                errors.add(new ApiError.FieldError(path + ".dueTime", "時刻だけの期限は設定できません。日付も指定してください"));
            }
        }
        Priority prio = Priority.MEDIUM;
        if (priority != null) {
            try {
                prio = Priority.valueOf(priority.strip().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                errors.add(new ApiError.FieldError(path + ".priority", "優先度は HIGH / MEDIUM / LOW のどれかです"));
            }
        }
        String cleanMemo = memo == null || memo.isBlank() ? null : memo;
        return new ParsedTask(title.strip(), cleanMemo, date, time, prio, Boolean.TRUE.equals(done), estimateMinutes,
                subtasks);
    }
}
