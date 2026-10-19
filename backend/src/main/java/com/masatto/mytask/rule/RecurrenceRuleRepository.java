package com.masatto.mytask.rule;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RecurrenceRuleRepository extends JpaRepository<RecurrenceRule, Long> {

    List<RecurrenceRule> findAllByOrderByIdAsc();

    List<RecurrenceRule> findByActiveTrue();

    long countByAreaId(Long areaId);

    /** エリアを消すときに、そのエリアのルールを別のエリア（null なら未分類）に移す */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE RecurrenceRule r SET r.areaId = :to WHERE r.areaId = :from")
    int moveArea(Long from, Long to);
}
