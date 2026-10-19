package com.masatto.mytask.task;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TaskRepository extends JpaRepository<Task, Long> {

    /** 未完了のタスク（親・サブタスクの両方） */
    List<Task> findByStatusNot(TaskStatus status);

    /** 完了済みのタスク（親・サブタスクの両方）を完了日時の新しい順に */
    List<Task> findByStatusOrderByCompletedAtDescIdDesc(TaskStatus status);

    /** 指定した期間に完了にした親タスク（完了日時の新しい順） */
    @Query("""
            SELECT t FROM Task t
            WHERE t.parentId IS NULL AND t.completedAt >= :from AND t.completedAt < :to
            ORDER BY t.completedAt DESC, t.id DESC
            """)
    List<Task> findDoneBetween(Instant from, Instant to);

    /** 指定した親のサブタスクを作成順に */
    List<Task> findByParentIdInOrderByIdAsc(Collection<Long> parentIds);

    List<Task> findByParentIdOrderByIdAsc(Long parentId);

    /**
     * タイトルかメモに語を含むタスク（親・サブタスク、完了済みも含む）。大文字小文字は区別しない。
     * q の % _ \ は呼び出し側でエスケープしておくこと。
     */
    @Query("""
            SELECT t FROM Task t
            WHERE LOWER(t.title) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '\\'
               OR LOWER(t.memo) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '\\'
            """)
    List<Task> search(String q);

    /** エリアの親タスクの数（完了済みも含む） */
    long countByAreaIdAndParentIdIsNull(Long areaId);

    /** エリアを消すときに、そのエリアのタスク（サブタスクも）を別のエリア（null なら未分類）に移す */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Task t SET t.areaId = :to WHERE t.areaId = :from")
    int moveArea(Long from, Long to);

    /** 指定した親のサブタスクのエリアを親に合わせる */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Task t SET t.areaId = :areaId WHERE t.parentId = :parentId")
    int updateSubtaskArea(Long parentId, Long areaId);

    /** 同じルールの同じ回が生成済みか（二重生成の防止） */
    boolean existsByRecurrenceRuleIdAndOccurrenceDate(Long recurrenceRuleId, LocalDate occurrenceDate);
}
