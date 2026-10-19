package com.masatto.mytask.backup;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.masatto.mytask.area.Area;
import com.masatto.mytask.area.AreaColor;
import com.masatto.mytask.area.AreaRepository;
import com.masatto.mytask.area.AreaService;
import com.masatto.mytask.common.ApiException;
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
                t.getOccurrenceDate(), t.getAreaId(), offset(t.getCreatedAt()), offset(t.getUpdatedAt()));
    }

    private BackupDocument.RuleData toData(RecurrenceRule r) {
        return new BackupDocument.RuleData(r.getId(), r.getTitle(), r.getMemo(), r.getPriority(), r.getDueTime(),
                new PatternDto(r.getPatternType(), r.getDaysOfWeek(), r.getDayOfMonth()), r.getStartDate(),
                r.getEndDate(), r.isActive(), r.getLastGeneratedDate(),
                r.getSubtaskTemplates().stream()
                        .map(t -> new RuleRequest.Template(t.getTitle(), t.getPriority()))
                        .toList(),
                r.getAreaId(), offset(r.getCreatedAt()), offset(r.getUpdatedAt()));
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
        validate(doc);
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
            throw invalid("データの内容が制約に違反しています（例：完了なのに完了日時がない、時刻だけの期限がある）");
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
                throw invalid("ファイルが空です");
            }
            return doc;
        } catch (JacksonException e) {
            throw invalid("JSON として読み込めません");
        }
    }

    /** 参照関係など、DB の制約だけでは分かりやすいエラーにならないものを先に確かめる */
    private static void validate(BackupDocument doc) {
        if (!BackupDocument.FORMAT.equals(doc.format()) || doc.version() == null || doc.version() < 1
                || doc.version() > BackupDocument.VERSION) {
            throw invalid("Orbit のバックアップファイル（形式バージョン 1〜" + BackupDocument.VERSION + "）ではありません");
        }
        if (doc.tasks() == null || doc.rules() == null) {
            throw invalid("tasks または rules がありません");
        }
        Set<Long> areaIds = Set.of();
        if (hasAreas(doc)) {
            if (doc.areas() == null) {
                throw invalid("areas がありません");
            }
            if (doc.areas().size() > AreaService.MAX_AREAS) {
                throw invalid("エリアが多すぎます（" + AreaService.MAX_AREAS + "個まで）");
            }
            for (BackupDocument.AreaData a : doc.areas()) {
                if (a == null || a.id() == null || isBlank(a.name()) || a.name().strip().length() > 20
                        || a.color() == null || a.createdAt() == null || a.updatedAt() == null) {
                    throw invalid("エリアに必須の項目がありません（id=" + (a == null ? null : a.id()) + "）");
                }
            }
            areaIds = uniqueIds(doc.areas(), BackupDocument.AreaData::id, "エリア").keySet();
        }
        for (BackupDocument.TaskData t : doc.tasks()) {
            if (t.id() == null || isBlank(t.title()) || t.priority() == null || t.status() == null
                    || t.createdAt() == null || t.updatedAt() == null) {
                throw invalid("タスクに必須の項目がありません（id=" + t.id() + "）");
            }
        }
        for (BackupDocument.RuleData r : doc.rules()) {
            if (r.id() == null || isBlank(r.title()) || r.priority() == null || r.pattern() == null
                    || r.pattern().type() == null || r.startDate() == null || r.active() == null
                    || r.createdAt() == null || r.updatedAt() == null) {
                throw invalid("ルールに必須の項目がありません（id=" + r.id() + "）");
            }
            if (r.subtaskTemplates() != null && r.subtaskTemplates().stream()
                    .anyMatch(tt -> tt == null || isBlank(tt.title()) || tt.priority() == null)) {
                throw invalid("ルールのサブタスクのひな形に不正な項目があります（id=" + r.id() + "）");
            }
        }
        Map<Long, BackupDocument.TaskData> tasksById = uniqueIds(doc.tasks(), BackupDocument.TaskData::id, "タスク");
        Set<Long> ruleIds = uniqueIds(doc.rules(), BackupDocument.RuleData::id, "ルール").keySet();
        for (BackupDocument.RuleData r : doc.rules()) {
            if (hasAreas(doc) && r.areaId() != null && !areaIds.contains(r.areaId())) {
                throw invalid("エリアが見つかりません（ルール id=" + r.id() + " の areaId=" + r.areaId() + "）");
            }
        }
        for (BackupDocument.TaskData t : doc.tasks()) {
            if (t.parentId() != null) {
                BackupDocument.TaskData parent = tasksById.get(t.parentId());
                if (parent == null) {
                    throw invalid("親タスクが見つかりません（id=" + t.id() + " の parentId=" + t.parentId() + "）");
                }
                if (parent.parentId() != null) {
                    throw invalid("サブタスクが入れ子になっています（id=" + t.id() + "）");
                }
            }
            if (hasAreas(doc) && t.areaId() != null && !areaIds.contains(t.areaId())) {
                throw invalid("エリアが見つかりません（id=" + t.id() + " の areaId=" + t.areaId() + "）");
            }
            if (t.recurrenceRuleId() != null && !ruleIds.contains(t.recurrenceRuleId())) {
                throw invalid("生成元のルールが見つかりません（id=" + t.id() + " の recurrenceRuleId=" + t.recurrenceRuleId() + "）");
            }
        }
    }

    /** 形式バージョン 2 以降はエリアを持つ。1 ならエリアは今のまま残し、取り込むタスクとルールは未分類にする */
    private static boolean hasAreas(BackupDocument doc) {
        return doc.version() >= 2;
    }

    private static <T> Map<Long, T> uniqueIds(List<T> items, Function<T, Long> id, String label) {
        Set<Long> seen = new HashSet<>();
        for (T item : items) {
            if (!seen.add(id.apply(item))) {
                throw invalid(label + "の id が重複しています（id=" + id.apply(item) + "）");
            }
        }
        return items.stream().collect(Collectors.toMap(id, Function.identity()));
    }

    /** 全削除してから、ID をそのまま使って入れ直す（IDENTITY 列は GENERATED BY DEFAULT なので指定できる） */
    private void replaceAll(BackupDocument doc) {
        entityManager.flush();
        jdbc.update("DELETE FROM tasks");
        jdbc.update("DELETE FROM rule_subtask_templates");
        jdbc.update("DELETE FROM recurrence_rules");
        boolean areas = hasAreas(doc);
        if (areas) {
            jdbc.update("DELETE FROM areas");
            for (int i = 0; i < doc.areas().size(); i++) {
                BackupDocument.AreaData a = doc.areas().get(i);
                jdbc.update("INSERT INTO areas (id, name, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                        a.id(), a.name().strip(), a.color().value(), i, a.createdAt(), a.updatedAt());
            }
        }

        WeekdaySetConverter weekdays = new WeekdaySetConverter();
        for (BackupDocument.RuleData r : doc.rules()) {
            jdbc.update("""
                    INSERT INTO recurrence_rules (id, title, memo, priority, due_time, pattern_type, days_of_week,
                        day_of_month, start_date, end_date, active, last_generated_date, area_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, r.id(), r.title(), r.memo(), r.priority().name(), r.dueTime(), r.pattern().type().name(),
                    weekdays.convertToDatabaseColumn(r.pattern().daysOfWeek()), r.pattern().dayOfMonth(),
                    r.startDate(), r.endDate(), r.active(), r.lastGeneratedDate(), areas ? r.areaId() : null, r.createdAt(),
                    r.updatedAt());
            List<RuleRequest.Template> templates = Objects.requireNonNullElse(r.subtaskTemplates(), List.of());
            for (int i = 0; i < templates.size(); i++) {
                jdbc.update("INSERT INTO rule_subtask_templates (rule_id, position, title, priority) VALUES (?, ?, ?, ?)",
                        r.id(), i, templates.get(i).title(), templates.get(i).priority().name());
            }
        }

        // 親を先に入れる（サブタスクの外部キーが親を参照するため）
        // サブタスクのエリアは親に合わせる（ファイル側で食い違っていても、一覧の絞り込みで親子が分かれないように）
        Map<Long, Long> areaByTask = doc.tasks().stream()
                .filter(t -> areas && t.areaId() != null)
                .collect(Collectors.toMap(BackupDocument.TaskData::id, BackupDocument.TaskData::areaId));
        List<BackupDocument.TaskData> ordered = doc.tasks().stream()
                .sorted(Comparator.comparing((BackupDocument.TaskData t) -> t.parentId() != null)
                        .thenComparing(BackupDocument.TaskData::id))
                .toList();
        for (BackupDocument.TaskData t : ordered) {
            boolean subtask = t.parentId() != null;
            jdbc.update("""
                    INSERT INTO tasks (id, title, memo, due_date, due_time, priority, status, completed_at, parent_id,
                        level, parent_level, recurrence_rule_id, occurrence_date, area_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, t.id(), t.title(), t.memo(), t.dueDate(), t.dueTime(), t.priority().name(), t.status().name(),
                    t.completedAt(), t.parentId(), subtask ? 1 : 0, subtask ? 0 : null,
                    t.recurrenceRuleId(), t.occurrenceDate(), areaByTask.get(subtask ? t.parentId() : t.id()),
                    t.createdAt(), t.updatedAt());
        }
    }

    /** 次に作るタスク・ルールの ID が、取り込んだ ID と重ならないようにする */
    private void restartIdentities() {
        for (String table : List.of("tasks", "recurrence_rules", "rule_subtask_templates", "areas")) {
            Long max = jdbc.queryForObject("SELECT COALESCE(MAX(id), 0) FROM " + table, Long.class);
            jdbc.execute("ALTER TABLE " + table + " ALTER COLUMN id RESTART WITH " + (max + 1));
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BACKUP", "バックアップファイルが不正です：" + message);
    }
}
