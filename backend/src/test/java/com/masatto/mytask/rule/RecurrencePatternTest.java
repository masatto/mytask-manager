package com.masatto.mytask.rule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Set;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class RecurrencePatternTest {

    private static final LocalDate START = LocalDate.of(2026, 1, 1);

    private static RecurrencePattern daily(LocalDate start, LocalDate end) {
        return new RecurrencePattern(PatternType.DAILY, null, null, start, end);
    }

    private static RecurrencePattern weekly(Set<Weekday> days) {
        return new RecurrencePattern(PatternType.WEEKLY, days, null, START, null);
    }

    private static RecurrencePattern monthly(int day) {
        return new RecurrencePattern(PatternType.MONTHLY, null, day, START, null);
    }

    private static LocalDate d(int y, int m, int day) {
        return LocalDate.of(y, m, day);
    }

    @Nested
    class 毎日 {

        @Test
        void 今日が発生日() {
            assertThat(daily(START, null).latestOnOrBefore(d(2026, 10, 14))).contains(d(2026, 10, 14));
        }

        @Test
        void 開始日より前は発生日がない() {
            RecurrencePattern p = daily(d(2026, 10, 20), null);
            assertThat(p.latestOnOrBefore(d(2026, 10, 14))).isEmpty();
            assertThat(p.nextOnOrAfter(d(2026, 10, 14))).contains(d(2026, 10, 20));
        }

        @Test
        void 終了日を過ぎたら直近は終了日で_次回はない() {
            RecurrencePattern p = daily(START, d(2026, 10, 10));
            assertThat(p.latestOnOrBefore(d(2026, 10, 14))).contains(d(2026, 10, 10));
            assertThat(p.nextOnOrAfter(d(2026, 10, 11))).isEmpty();
        }

        @Test
        void 終了日当日はまだ発生する() {
            RecurrencePattern p = daily(START, d(2026, 10, 14));
            assertThat(p.nextOnOrAfter(d(2026, 10, 14))).contains(d(2026, 10, 14));
        }
    }

    @Nested
    class 毎週 {

        @Test
        void 直近の指定曜日を返す() {
            RecurrencePattern p = weekly(EnumSet.of(Weekday.MON, Weekday.THU));
            // 2026-10-14 は水曜。直近は 10/12(月)、次回は 10/15(木)
            assertThat(p.latestOnOrBefore(d(2026, 10, 14))).contains(d(2026, 10, 12));
            assertThat(p.nextOnOrAfter(d(2026, 10, 14))).contains(d(2026, 10, 15));
        }

        @Test
        void 当日が指定曜日なら当日() {
            RecurrencePattern p = weekly(EnumSet.of(Weekday.WED));
            assertThat(p.latestOnOrBefore(d(2026, 10, 14))).contains(d(2026, 10, 14));
            assertThat(p.nextOnOrAfter(d(2026, 10, 14))).contains(d(2026, 10, 14));
        }

        @Test
        void 次回の予定を複数返す() {
            RecurrencePattern p = weekly(EnumSet.of(Weekday.MON, Weekday.THU));
            assertThat(p.nextOccurrences(d(2026, 10, 14), 3))
                    .containsExactly(d(2026, 10, 15), d(2026, 10, 19), d(2026, 10, 22));
        }

        @Test
        void 開始日より前の曜日は含めない() {
            RecurrencePattern p = new RecurrencePattern(PatternType.WEEKLY, EnumSet.of(Weekday.MON), null,
                    d(2026, 10, 13), null);
            // 直近の月曜 10/12 は開始日より前
            assertThat(p.latestOnOrBefore(d(2026, 10, 14))).isEmpty();
        }
    }

    @Nested
    class 毎月 {

        @Test
        void 指定日が今月まだ来ていなければ直近は先月() {
            RecurrencePattern p = monthly(20);
            assertThat(p.latestOnOrBefore(d(2026, 10, 14))).contains(d(2026, 9, 20));
            assertThat(p.nextOnOrAfter(d(2026, 10, 14))).contains(d(2026, 10, 20));
        }

        @Test
        void 三十一日指定は三十日の月では三十日() {
            RecurrencePattern p = monthly(31);
            assertThat(p.nextOnOrAfter(d(2026, 11, 1))).contains(d(2026, 11, 30));
            assertThat(p.latestOnOrBefore(d(2026, 12, 15))).contains(d(2026, 11, 30));
        }

        @Test
        void 二月はうるう年を考慮する() {
            assertThat(monthly(30).nextOnOrAfter(d(2028, 2, 1))).contains(d(2028, 2, 29));
            assertThat(monthly(30).nextOnOrAfter(d(2027, 2, 1))).contains(d(2027, 2, 28));
        }

        @Test
        void 末日指定() {
            RecurrencePattern p = monthly(RecurrencePattern.LAST_DAY);
            assertThat(p.nextOccurrences(d(2027, 1, 31), 3))
                    .containsExactly(d(2027, 1, 31), d(2027, 2, 28), d(2027, 3, 31));
        }

        @Test
        void 年をまたぐ() {
            assertThat(monthly(5).latestOnOrBefore(d(2027, 1, 3))).contains(d(2026, 12, 5));
            assertThat(monthly(5).nextOnOrAfter(d(2026, 12, 6))).contains(d(2027, 1, 5));
        }
    }
}
