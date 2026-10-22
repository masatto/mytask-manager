package com.masatto.mytask.rule;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 繰り返しパターンと期間から発生日を計算する（requirements F4 / api-design 5章）。
 *
 * <ul>
 * <li>毎日：開始日以降の毎日</li>
 * <li>毎週：指定した曜日</li>
 * <li>毎月：指定した日。その月に存在しない日（31日など）と末日指定（-1）は、その月の最終日</li>
 * <li>手動：発生日はない（自動では作らない）</li>
 * </ul>
 *
 * @param daysOfWeek WEEKLY のときだけ使う
 * @param dayOfMonth MONTHLY のときだけ使う。1〜31、または -1（末日）
 * @param endDate    null なら終了なし
 */
public record RecurrencePattern(
        PatternType type,
        Set<Weekday> daysOfWeek,
        Integer dayOfMonth,
        LocalDate startDate,
        LocalDate endDate) {

    public static final int LAST_DAY = -1;

    /** date 以前で最も新しい発生日（停止中に逃した回は、この1件だけを生成する） */
    public Optional<LocalDate> latestOnOrBefore(LocalDate date) {
        LocalDate candidate = endDate != null && endDate.isBefore(date) ? endDate : date;
        Optional<LocalDate> found = switch (type) {
            case DAILY -> Optional.of(candidate);
            case WEEKLY -> {
                for (int i = 0; i < 7; i++) {
                    LocalDate d = candidate.minusDays(i);
                    if (isWeeklyDay(d)) {
                        yield Optional.of(d);
                    }
                }
                yield Optional.empty();
            }
            case MONTHLY -> {
                LocalDate inMonth = monthlyDate(YearMonth.from(candidate));
                yield Optional.of(inMonth.isAfter(candidate)
                        ? monthlyDate(YearMonth.from(candidate).minusMonths(1))
                        : inMonth);
            }
            case MANUAL -> Optional.empty();
        };
        return found.filter(d -> !d.isBefore(startDate));
    }

    /** date 以降で最も早い発生日 */
    public Optional<LocalDate> nextOnOrAfter(LocalDate date) {
        LocalDate candidate = date.isBefore(startDate) ? startDate : date;
        Optional<LocalDate> found = switch (type) {
            case DAILY -> Optional.of(candidate);
            case WEEKLY -> {
                for (int i = 0; i < 7; i++) {
                    LocalDate d = candidate.plusDays(i);
                    if (isWeeklyDay(d)) {
                        yield Optional.of(d);
                    }
                }
                yield Optional.empty();
            }
            case MONTHLY -> {
                LocalDate inMonth = monthlyDate(YearMonth.from(candidate));
                yield Optional.of(inMonth.isBefore(candidate)
                        ? monthlyDate(YearMonth.from(candidate).plusMonths(1))
                        : inMonth);
            }
            case MANUAL -> Optional.empty();
        };
        return found.filter(d -> endDate == null || !d.isAfter(endDate));
    }

    /** date 以降の発生日を最大 count 件（S4 の「次回の生成予定」） */
    public List<LocalDate> nextOccurrences(LocalDate date, int count) {
        List<LocalDate> result = new ArrayList<>();
        LocalDate from = date;
        while (result.size() < count) {
            Optional<LocalDate> next = nextOnOrAfter(from);
            if (next.isEmpty()) {
                break;
            }
            result.add(next.get());
            from = next.get().plusDays(1);
        }
        return result;
    }

    private boolean isWeeklyDay(LocalDate date) {
        return daysOfWeek.contains(Weekday.of(date.getDayOfWeek()));
    }

    private LocalDate monthlyDate(YearMonth month) {
        int last = month.lengthOfMonth();
        int day = dayOfMonth == LAST_DAY ? last : Math.min(dayOfMonth, last);
        return month.atDay(day);
    }
}
