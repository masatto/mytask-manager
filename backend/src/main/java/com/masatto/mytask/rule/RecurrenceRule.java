package com.masatto.mytask.rule;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.masatto.mytask.task.Priority;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 繰り返しルール（db-design 3.2） */
@Entity
@Table(name = "recurrence_rules")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecurrenceRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 10000)
    private String memo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Priority priority;

    private LocalTime dueTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PatternType patternType;

    @Convert(converter = WeekdaySetConverter.class)
    @Column(length = 27)
    private Set<Weekday> daysOfWeek;

    private Integer dayOfMonth;

    @Column(nullable = false)
    private LocalDate startDate;

    private LocalDate endDate;

    @Column(nullable = false)
    private boolean active;

    /** 最後に生成した発生日。これ以前の回は（タスクが削除されていても）再生成しない */
    private LocalDate lastGeneratedDate;

    /** 生成するタスクのエリア（null は未分類） */
    private Long areaId;

    /** 生成するタスクの目安時間（分。null は未設定） */
    private Integer estimateMinutes;

    @OneToMany(mappedBy = "rule", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<RuleSubtaskTemplate> subtaskTemplates = new ArrayList<>();

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    /** ひな形のサブタスク（タイトル・優先度・目安時間） */
    public record TemplateSpec(String title, Priority priority, Integer estimateMinutes) {
    }

    public static RecurrenceRule create(Instant now) {
        RecurrenceRule rule = new RecurrenceRule();
        rule.createdAt = now;
        return rule;
    }

    public void update(String title, String memo, Priority priority, LocalTime dueTime, RecurrencePattern pattern,
            boolean active, List<TemplateSpec> templates, Long areaId, Integer estimateMinutes, Instant now) {
        this.areaId = areaId;
        this.estimateMinutes = estimateMinutes;
        this.title = title;
        this.memo = memo;
        this.priority = priority;
        this.dueTime = dueTime;
        this.patternType = pattern.type();
        this.daysOfWeek = pattern.type() == PatternType.WEEKLY ? pattern.daysOfWeek() : null;
        this.dayOfMonth = pattern.type() == PatternType.MONTHLY ? pattern.dayOfMonth() : null;
        this.startDate = pattern.startDate();
        this.endDate = pattern.endDate();
        this.active = active;
        replaceTemplates(templates);
        this.updatedAt = now;
    }

    /**
     * ひな形を入れ替える。(rule_id, position) に一意制約があり、Hibernate は削除より先に追加を実行するため、
     * 全削除→再作成ではなく、同じ位置の行を更新して再利用する。
     */
    private void replaceTemplates(List<TemplateSpec> templates) {
        for (int i = 0; i < templates.size(); i++) {
            TemplateSpec spec = templates.get(i);
            if (i < subtaskTemplates.size()) {
                subtaskTemplates.get(i).update(spec.title(), spec.priority(), spec.estimateMinutes());
            } else {
                subtaskTemplates.add(new RuleSubtaskTemplate(this, i, spec.title(), spec.priority(), spec.estimateMinutes()));
            }
        }
        while (subtaskTemplates.size() > templates.size()) {
            subtaskTemplates.removeLast();
        }
    }

    public void setActive(boolean active, Instant now) {
        this.active = active;
        this.updatedAt = now;
    }

    public void markGenerated(LocalDate occurrenceDate) {
        this.lastGeneratedDate = occurrenceDate;
    }

    public RecurrencePattern pattern() {
        return new RecurrencePattern(patternType, daysOfWeek, dayOfMonth, startDate, endDate);
    }

    /** 今日以降で次に生成する日付。停止中・終了済みなら空 */
    public Optional<LocalDate> nextOccurrence(LocalDate today) {
        if (!active) {
            return Optional.empty();
        }
        LocalDate from = lastGeneratedDate != null && !lastGeneratedDate.isBefore(today)
                ? lastGeneratedDate.plusDays(1)
                : today;
        return pattern().nextOnOrAfter(from);
    }
}
