package com.masatto.mytask.task;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.masatto.mytask.rule.RecurrenceRule;
import com.masatto.mytask.rule.RecurrenceRuleRepository;
import com.masatto.mytask.task.dto.TaskResponse;

import lombok.RequiredArgsConstructor;

/** Task を API の TaskResponse にする。生成元ルールのタイトルを引くので、読み取りと更新の両方から使う */
@Component
@RequiredArgsConstructor
class TaskResponseMapper {

    private final RecurrenceRuleRepository ruleRepository;
    private final Clock clock;

    TaskResponse toResponse(Task task, LocalDateTime now) {
        return TaskResponse.of(task, now, clock.getZone(), ruleTitles(List.of(task)));
    }

    /** 生成元ルールのID → タイトル（ルールを持たないタスクだけなら空） */
    Map<Long, String> ruleTitles(Collection<Task> tasks) {
        Set<Long> ruleIds = tasks.stream()
                .map(Task::getRecurrenceRuleId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ruleIds.isEmpty()) {
            return Map.of();
        }
        return ruleRepository.findAllById(ruleIds).stream()
                .collect(Collectors.toMap(RecurrenceRule::getId, RecurrenceRule::getTitle));
    }
}
