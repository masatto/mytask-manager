package com.masatto.mytask.task;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<Task, Long> {

    /** 未完了のタスク（親・サブタスクの両方） */
    List<Task> findByStatusNot(TaskStatus status);

    /** 完了済みのタスク（親・サブタスクの両方）を完了日時の新しい順に */
    List<Task> findByStatusOrderByCompletedAtDescIdDesc(TaskStatus status);

    /** 指定した親のサブタスクを作成順に */
    List<Task> findByParentIdInOrderByIdAsc(Collection<Long> parentIds);

    List<Task> findByParentIdOrderByIdAsc(Long parentId);
}
