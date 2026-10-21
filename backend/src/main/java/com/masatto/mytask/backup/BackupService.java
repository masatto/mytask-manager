package com.masatto.mytask.backup;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.masatto.mytask.area.Area;
import com.masatto.mytask.area.AreaColor;
import com.masatto.mytask.area.AreaRepository;
import com.masatto.mytask.rule.RecurrenceGenerator;
import com.masatto.mytask.rule.RecurrenceRule;
import com.masatto.mytask.rule.RecurrenceRuleRepository;
import com.masatto.mytask.rule.WeekdaySetConverter;
import com.masatto.mytask.rule.dto.PatternDto;
import com.masatto.mytask.rule.dto.RuleRequest;
import com.masatto.mytask.task.Task;
import com.masatto.mytask.task.TaskRepository;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** JSON バックアップのエクスポートとインポート（requirements F5 / api-design 6章） */
@Service
@RequiredArgsConstructor
public class BackupService {

    private final TaskRepository taskRepository;
    private final RecurrenceRuleRepository ruleRepository;
    private final AreaRepository areaRepository;
    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;
    private final TransactionTemplate transactionTemplate;
    private final RecurrenceGenerator generator;
    private final JsonMapper jsonMapper;
    private final Clock clock;

    public record Counts(long tasks, long rules) {
    }

    public record ImportSummary(Counts current, Counts incoming) {
    }

    // ---- エクスポート ---------------------------------------------------------

    public BackupDocument export() {
        return transactionTemplate.execute(status -> new BackupDocument(
                BackupDocument.FORMAT,
                BackupDocument.VERSION,
                OffsetDateTime.now(clock),
                taskRepository.findAll().stream()
                        .sorted(Comparator.comparing(Task::getId))
                        .map(this::toData)
                        .toList(),
                ruleRepository.findAllByOrderByIdAsc().stream().map(this::toData).toList(),
                areaRepository.findAllByOrderByPositionAscIdAsc().stream().map(this::toData).toList()));
    }

    private BackupDocument.TaskData toData(Task t) {
        return new BackupDocument.TaskData(t.getId(), t.getTitle(), t.getMemo(), t.getDueDate(), t.getDueTime(),
                t.getPriority(), t.getStatus(), offset(t.getCompletedAt()), t.getParentId(), t.getRecurrenceRuleId(),
                t.getOccurrenceDate(), t.getAreaId(), t.getEstimateMinutes(), offset(t.getCreatedAt()),
                offset(t.getUpdatedAt()));
    }

    private BackupDocument.RuleData toData(RecurrenceRule r) {
        return new BackupDocument.RuleData(r.getId(), r.getTitle(), r.getMemo(), r.getPriority(), r.getDueTime(),
                new PatternDto(r.getPatternType(), r.getDaysOfWeek(), r.getDayOfMonth()), r.getStartDate(),
                r.getEndDate(), r.isActive(), r.getLastGeneratedDate(),
                r.getSubtaskTemplates().stream()
                        .map(t -> new RuleRequest.Template(t.getTitle(), t.getPriority(), t.getEstimateMinutes()))
                        .toList(),
                r.getAreaId(), r.getEstimateMinutes(), offset(r.getCreatedAt()), offset(r.getUpdatedAt()));
    }

    private BackupDocument.AreaData toData(Area a) {
        return new BackupDocument.AreaData(a.getId(), a.getName(), AreaColor.of(a.getColor()), offset(a.getCreatedAt()),
                offset(a.getUpdatedAt()));
    }

    private OffsetDateTime offset(Instant instant) {
        return instant == null ? null : instant.atZone(clock.getZone()).toOffsetDateTime();
    }

    // ---- インポート -----------------------------------------------------------

    /**
     * 全データを置き換える。dryRun なら同じ処理を実行してからロールバックするので、
     * DB の制約違反まで含めて検証でき、何も保存されない。
     */
    public ImportSummary importJson(String json, boolean dryRun) {
        BackupDocument doc = parse(json);
        BackupValidator.validate(doc);
        ImportSummary summary;
        try {
            summary = transactionTemplate.execute(status -> {
                Counts current = new Counts(taskRepository.count(), ruleRepository.count());
                replaceAll(doc);
                if (dryRun) {
                    status.setRollbackOnly();
                } else {
                    // H2 では DDL がトランザクションを確定させるので、ロールバックしない本番の取り込みで、最後にだけ行う
                    restartIdentities();
                }
                return new ImportSummary(current, new Counts(doc.tasks().size(), doc.rules().size()));
            });
        } catch (DataIntegrityViolationException e) {
            throw BackupValidator.invalid("データの内容が制約に違反しています（例：完了なのに完了日時がない、時刻だけの期限がある、目安時間が1〜9999分でない）");
        }
        if (!dryRun) {
            // 起動時と同じく、今日までに生成すべき回があれば生成する
            generator.generateAll();
        }
        return summary;
    }

    private BackupDocument parse(String json) {
        try {
            BackupDocument doc = jsonMapper.readValue(json, BackupDocument.class);
            if (doc == null) {
                throw BackupValidator.invalid("ファイルが空です");
            }
            return doc;
        } catch (JacksonException e) {
            throw BackupValidator.invalid("JSON として読み込めません");
        }
    }

    /** 全削除してから、ID をそのまま使って入れ直す（IDENTITY 列は GENERATED BY DEFAULT なので指定できる） */
    private void replaceAll(BackupDocument doc) {
        entityManager.flush();
        jdbc.update("DELETE FROM tasks");
        jdbc.update("DELETE FROM rule_subtask_templates");
        jdbc.update("DELETE FROM recurrence_rules");
        boolean withAreas = BackupValidator.hasAreas(doc);
        if (withAreas) {
            jdbc.update("DELETE FROM areas");
            insertAreas(doc.areas());
        }
        // 参照される側から入れる：エリア → ルール → タスク（親 → サブタスク）
        insertRules(doc.rules(), withAreas);
        insertTasks(doc.tasks(), withAreas);
    }

    private void insertAreas(List<BackupDocument.AreaData> areas) {
        for (int i = 0; i < areas.size(); i++) {
            BackupDocument.AreaData a = areas.get(i);
            jdbc.update("INSERT INTO areas (id, name, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    a.id(), a.name().strip(), a.color().value(), i, a.createdAt(), a.updatedAt());
        }
    }

    /** @param withAreas false（形式バージョン 1）ならエリアは入れず未分類にする */
    private void insertRules(List<BackupDocument.RuleData> rules, boolean withAreas) {
        WeekdaySetConverter weekdays = new WeekdaySetConverter();
        for (BackupDocument.RuleData r : rules) {
            jdbc.update("""
                    INSERT INTO recurrence_rules (id, title, memo, priority, due_time, pattern_type, days_of_week,
                        day_of_month, start_date, end_date, active, last_generated_date, area_id, estimate_minutes,
                        created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, r.id(), r.title(), r.memo(), r.priority().name(), r.dueTime(), r.pattern().type().name(),
                    weekdays.convertToDatabaseColumn(r.pattern().daysOfWeek()), r.pattern().dayOfMonth(),
                    r.startDate(), r.endDate(), r.active(), r.lastGeneratedDate(), withAreas ? r.areaId() : null,
                    r.estimateMinutes(), r.createdAt(), r.updatedAt());
            List<RuleRequest.Template> templates = Objects.requireNonNullElse(r.subtaskTemplates(), List.of());
            for (int i = 0; i < templates.size(); i++) {
                RuleRequest.Template t = templates.get(i);
                jdbc.update("""
                        INSERT INTO rule_subtask_templates (rule_id, position, title, priority, estimate_minutes)
                        VALUES (?, ?, ?, ?, ?)
                        """, r.id(), i, t.title(), t.priority().name(), t.estimateMinutes());
            }
        }
    }

    /**
     * 親を先に入れる（サブタスクの外部キーが親を参照するため）。
     * サブタスクのエリアは親に合わせる（ファイル側で食い違っていても、一覧の絞り込みで親子が分かれないように）。
     */
    private void insertTasks(List<BackupDocument.TaskData> tasks, boolean withAreas) {
        Map<Long, Long> areaByTask = tasks.stream()
                .filter(t -> withAreas && t.areaId() != null)
                .collect(Collectors.toMap(BackupDocument.TaskData::id, BackupDocument.TaskData::areaId));
        List<BackupDocument.TaskData> parentsFirst = tasks.stream()
                .sorted(Comparator.comparing((BackupDocument.TaskData t) -> t.parentId() != null)
                        .thenComparing(BackupDocument.TaskData::id))
                .toList();
        for (BackupDocument.TaskData t : parentsFirst) {
            boolean subtask = t.parentId() != null;
            jdbc.update("""
                    INSERT INTO tasks (id, title, memo, due_date, due_time, priority, status, completed_at, parent_id,
                        level, parent_level, recurrence_rule_id, occurrence_date, area_id, estimate_minutes,
                        created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, t.id(), t.title(), t.memo(), t.dueDate(), t.dueTime(), t.priority().name(), t.status().name(),
                    t.completedAt(), t.parentId(), subtask ? 1 : 0, subtask ? 0 : null,
                    t.recurrenceRuleId(), t.occurrenceDate(), areaByTask.get(subtask ? t.parentId() : t.id()),
                    t.estimateMinutes(), t.createdAt(), t.updatedAt());
        }
    }

    /** 次に作るタスク・ルールの ID が、取り込んだ ID と重ならないようにする */
    private void restartIdentities() {
        for (String table : List.of("tasks", "recurrence_rules", "rule_subtask_templates", "areas")) {
            Long max = jdbc.queryForObject("SELECT COALESCE(MAX(id), 0) FROM " + table, Long.class);
            jdbc.execute("ALTER TABLE " + table + " ALTER COLUMN id RESTART WITH " + (max + 1));
        }
    }
}
