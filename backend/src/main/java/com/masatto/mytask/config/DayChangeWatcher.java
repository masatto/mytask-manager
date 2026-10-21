package com.masatto.mytask.config;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.masatto.mytask.backup.AutoBackupService;
import com.masatto.mytask.rule.RecurrenceGenerator;

/**
 * 日付が変わったら、繰り返しタスクの生成と自動バックアップを行う。
 *
 * 0:00 ちょうどの cron だと、PC がスリープしていた夜はその日の分が実行されない（復帰しても取り戻さない）。
 * そこで一定間隔で「前回見た日付」と比べ、変わっていたときだけ実行する。
 * ふだんの確認はメモリ上の日付の比較だけなので、DB やファイルには触れない。
 * 起動した日の分は、各サービスの起動時の処理（ApplicationReadyEvent）が行う。
 */
@Component
public class DayChangeWatcher {

    private final RecurrenceGenerator recurrenceGenerator;
    private final AutoBackupService autoBackupService;
    private final Clock clock;
    private LocalDate lastSeenDate;

    public DayChangeWatcher(RecurrenceGenerator recurrenceGenerator, AutoBackupService autoBackupService,
            Clock clock) {
        this.recurrenceGenerator = recurrenceGenerator;
        this.autoBackupService = autoBackupService;
        this.clock = clock;
        this.lastSeenDate = LocalDate.now(clock);
    }

    @Scheduled(fixedDelayString = "${mytask.day-check-interval}", initialDelayString = "${mytask.day-check-interval}")
    public synchronized void check() {
        LocalDate today = LocalDate.now(clock);
        if (today.equals(lastSeenDate)) {
            return;
        }
        lastSeenDate = today;
        // 生成したタスクもバックアップに含めるため、生成を先に行う
        recurrenceGenerator.generateAll();
        autoBackupService.runIfNeeded();
    }
}
