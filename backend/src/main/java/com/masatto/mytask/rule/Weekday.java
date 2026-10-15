package com.masatto.mytask.rule;

import java.time.DayOfWeek;

/** API で使う曜日の表記（api-design 1章）。宣言順は月曜始まり */
public enum Weekday {
    MON, TUE, WED, THU, FRI, SAT, SUN;

    public DayOfWeek toDayOfWeek() {
        return DayOfWeek.of(ordinal() + 1);
    }

    public static Weekday of(DayOfWeek dayOfWeek) {
        return values()[dayOfWeek.getValue() - 1];
    }
}
