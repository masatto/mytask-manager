package com.masatto.mytask.task;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TaskRepository extends JpaRepository<Task, Long> {

    @Query("""
            SELECT t FROM Task t
            WHERE t.parentId IS NULL AND t.status <> com.masatto.mytask.task.TaskStatus.DONE
              AND t.dueDate IS NOT NULL AND t.dueDate <= :today
            """)
    List<Task> findOpenDueOnOrBefore(LocalDate today);

    @Query("""
            SELECT t FROM Task t
            WHERE t.parentId IS NULL AND t.status <> com.masatto.mytask.task.TaskStatus.DONE
              AND t.dueDate > :today
            """)
    List<Task> findOpenDueAfter(LocalDate today);

    @Query("""
            SELECT t FROM Task t
            WHERE t.parentId IS NULL AND t.status <> com.masatto.mytask.task.TaskStatus.DONE
              AND t.dueDate IS NULL
            """)
    List<Task> findOpenWithoutDue();

    @Query("""
            SELECT t FROM Task t
            WHERE t.parentId IS NULL AND t.status = com.masatto.mytask.task.TaskStatus.DONE
            ORDER BY t.completedAt DESC, t.id DESC
            """)
    List<Task> findDone(Pageable pageable);
}
