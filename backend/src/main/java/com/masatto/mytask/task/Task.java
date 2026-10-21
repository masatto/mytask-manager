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

    /**
     * 親タスクのID。サブタスクの取得は親IDでまとめて行う（N+1 を避けるため）ので、
     * 関連（@ManyToOne）にはせずIDで持つ。作成後は変更できない。
     */
    private Long parentId;

    @Column(nullable = false)
    private byte level;

    private Byte parentLevel;

    /** 生成元の繰り返しルール。ルールを削除すると DB 側で NULL になる（ON DELETE SET NULL） */
    private Long recurrenceRuleId;

    private LocalDate occurrenceDate;

    /** エリア（null は未分類）。サブタスクは親と同じ値を持つ */
    @Setter
    private Long areaId;

    /** 目安時間（分。null は未設定）。親の目安とサブタスクの合計は画面で比べる */
    @Setter
    private Integer estimateMinutes;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public static Task create(String title, String memo, LocalDate dueDate, LocalTime dueTime,
            Priority priority, Long parentId, Instant now) {
        Task task = new Task();
        task.parentId = parentId;
        task.title = title;
        task.memo = memo;
        task.setDue(dueDate, dueTime);
        task.priority = priority;
        task.status = TaskStatus.TODO;
        task.createdAt = now;
        task.updatedAt = now;
        return task;
    }

    /** 繰り返しルールから生成したタスクとして、生成元と発生日を記録する（親タスクのみ） */
    public void linkRecurrence(Long ruleId, LocalDate occurrenceDate) {
        this.recurrenceRuleId = ruleId;
        this.occurrenceDate = occurrenceDate;
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

    public boolean isSubtask() {
        return parentId != null;
    }

    /** 一覧で親単位にまとめるときのキー（親なら自分、サブタスクなら親） */
    public Long rootId() {
        return parentId != null ? parentId : id;
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
