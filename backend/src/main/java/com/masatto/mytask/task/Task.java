package com.masatto.mytask.task;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tasks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter
    @Column(nullable = false, length = 200)
    private String title;

    @Setter
    @Column(length = 10000)
    private String memo;

    private LocalDate dueDate;

    private LocalTime dueTime;

    @Setter
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Priority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private TaskStatus status;

    private Instant completedAt;

    // サブタスク関連（Phase 2 で関連付けに置き換える）
    private Long parentId;

    @Column(nullable = false)
    private byte level;

    private Byte parentLevel;

    // 繰り返し関連（Phase 3 で使う）
    private Long recurrenceRuleId;

    private LocalDate occurrenceDate;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public static Task create(String title, String memo, LocalDate dueDate, LocalTime dueTime,
            Priority priority, Instant now) {
        Task task = new Task();
        task.title = title;
        task.memo = memo;
        task.setDue(dueDate, dueTime);
        task.priority = priority;
        task.status = TaskStatus.TODO;
        task.createdAt = now;
        task.updatedAt = now;
        return task;
    }

    /** 時刻だけの期限は持てない（呼び出し側で入力チェック済みであること） */
    public void setDue(LocalDate dueDate, LocalTime dueTime) {
        if (dueDate == null && dueTime != null) {
            throw new IllegalArgumentException("dueTime requires dueDate");
        }
        this.dueDate = dueDate;
        this.dueTime = dueTime;
    }

    /** ステータスを変え、完了日時を連動させる */
    public void changeStatus(TaskStatus newStatus, Instant now) {
        if (status == newStatus) {
            return;
        }
        status = newStatus;
        completedAt = newStatus == TaskStatus.DONE ? now : null;
    }

    public void touch(Instant now) {
        updatedAt = now;
    }

    public boolean isDone() {
        return status == TaskStatus.DONE;
    }

    /**
     * 期限切れかどうか。時刻ありはその時刻を過ぎたら、日付のみはその日が終わったら期限切れ。
     * 完了済みは期限切れにしない。
     */
    public boolean isOverdue(LocalDateTime now) {
        if (isDone() || dueDate == null) {
            return false;
        }
        if (dueTime == null) {
            return dueDate.isBefore(now.toLocalDate());
        }
        return dueDate.atTime(dueTime).isBefore(now);
    }

    @PrePersist
    void fillLevel() {
        level = (byte) (parentId == null ? 0 : 1);
        parentLevel = parentId == null ? null : (byte) 0;
    }
}
