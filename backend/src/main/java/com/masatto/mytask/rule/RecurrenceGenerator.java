package com.masatto.mytask.rule;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.masatto.mytask.task.Task;
import com.masatto.mytask.task.TaskRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 繰り返しタスクの生成（api-design 5章）。
 *
 * <ol>
 * <li>今日以前で最も新しい発生日 d を求める（停止中に逃した回は直近の1件だけになる）</li>
 * <li>d が lastGeneratedDate 以前なら何もしない（生成済みのタスクを削除しても再生成しない）</li>
 * <li>ひな形から期限日 d の親タスクとサブタスクを作り、lastGeneratedDate を d にする</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecurrenceGenerator {

    private final RecurrenceRuleRepository ruleRepository;
    private final TaskRepository taskRepository;
    private final Clock clock;
    private final TransactionTemplate transactionTemplate;

    /** 日付が変わったときの生成は DayChangeWatcher が行う */
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        generateAll();
    }

    /** 有効なルールすべてについて生成する。ルールごとに別トランザクションにし、1件の失敗で全体を止めない */
    public synchronized int generateAll() {
        int generated = 0;
        for (RecurrenceRule rule : ruleRepository.findByActiveTrue()) {
            try {
                Boolean created = transactionTemplate.execute(status -> ruleRepository.findById(rule.getId())
                        .flatMap(this::generate)
                        .isPresent());
                if (Boolean.TRUE.equals(created)) {
                    generated++;
                }
            } catch (RuntimeException e) {
                log.error("Failed to generate task for rule {}", rule.getId(), e);
            }
        }
        if (generated > 0) {
            log.info("Generated {} recurring task(s)", generated);
        }
        return generated;
    }

    /** 1つのルールについて生成する。トランザクション内で呼ぶこと。生成した親タスクを返す */
    public synchronized Optional<Task> generate(RecurrenceRule rule) {
        if (!rule.isActive()) {
            return Optional.empty();
        }
        Optional<LocalDate> latest = rule.pattern().latestOnOrBefore(LocalDate.now(clock));
        if (latest.isEmpty()) {
            return Optional.empty();
        }
        LocalDate occurrence = latest.get();
        if (rule.getLastGeneratedDate() != null && !occurrence.isAfter(rule.getLastGeneratedDate())) {
            return Optional.empty();
        }

        Task parent = null;
        // バックアップの復元などで同じ回が既にある場合は作らない（一意制約の最終防止策より手前で止める）
        if (!taskRepository.existsByRecurrenceRuleIdAndOccurrenceDate(rule.getId(), occurrence)) {
            parent = createTasks(rule, occurrence);
        }
        rule.markGenerated(occurrence);
        return Optional.ofNullable(parent);
    }

    private Task createTasks(RecurrenceRule rule, LocalDate occurrence) {
        Instant now = Instant.now(clock);
        Task parent = Task.create(rule.getTitle(), rule.getMemo(), occurrence, rule.getDueTime(), rule.getPriority(),
                null, now);
        parent.linkRecurrence(rule.getId(), occurrence);
        parent.setAreaId(rule.getAreaId());
        taskRepository.save(parent);
        for (RuleSubtaskTemplate template : rule.getSubtaskTemplates()) {
            Task subtask = Task.create(template.getTitle(), null, null, null, template.getPriority(), parent.getId(),
                    now);
            subtask.setAreaId(rule.getAreaId());
            taskRepository.save(subtask);
        }
        return parent;
    }
}
