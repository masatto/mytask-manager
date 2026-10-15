package com.masatto.mytask.rule;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RecurrenceRuleRepository extends JpaRepository<RecurrenceRule, Long> {

    List<RecurrenceRule> findAllByOrderByIdAsc();

    List<RecurrenceRule> findByActiveTrue();
}
