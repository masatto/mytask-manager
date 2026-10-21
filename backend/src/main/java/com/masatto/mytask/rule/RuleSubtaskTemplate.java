package com.masatto.mytask.rule;

import com.masatto.mytask.task.Priority;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 繰り返しルールのサブタスクのひな形（db-design 3.3） */
@Entity
@Table(name = "rule_subtask_templates")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RuleSubtaskTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rule_id", nullable = false)
    private RecurrenceRule rule;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Priority priority;

    /** 目安時間（分。null は未設定） */
    private Integer estimateMinutes;

    RuleSubtaskTemplate(RecurrenceRule rule, int position, String title, Priority priority, Integer estimateMinutes) {
        this.rule = rule;
        this.position = position;
        this.title = title;
        this.priority = priority;
        this.estimateMinutes = estimateMinutes;
    }

    void update(String title, Priority priority, Integer estimateMinutes) {
        this.title = title;
        this.priority = priority;
        this.estimateMinutes = estimateMinutes;
    }
}
