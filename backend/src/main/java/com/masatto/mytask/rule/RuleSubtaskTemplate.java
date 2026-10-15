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

    RuleSubtaskTemplate(RecurrenceRule rule, int position, String title, Priority priority) {
        this.rule = rule;
        this.position = position;
        this.title = title;
        this.priority = priority;
    }

    void update(String title, Priority priority) {
        this.title = title;
        this.priority = priority;
    }
}
