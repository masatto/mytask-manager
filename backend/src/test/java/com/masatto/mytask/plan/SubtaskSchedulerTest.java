package com.masatto.mytask.plan;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

class SubtaskSchedulerTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 21);

    private static LocalDate d(String s) {
        return LocalDate.parse(s);
    }

    @Test
    void 期間の始まりは前のステップの期限の翌日で過ぎていれば今日() {
        assertThat(SubtaskScheduler.windowStart(null, TODAY)).isEqualTo(TODAY);
        assertThat(SubtaskScheduler.windowStart(d("2026-10-29"), TODAY)).isEqualTo(d("2026-10-30"));
        assertThat(SubtaskScheduler.windowStart(d("2026-10-10"), TODAY)).isEqualTo(TODAY);
    }

    @Test
    void 同じ目安なら期間を均等に分け最後は親の期限() {
        // 10/22〜10/29 の8日間に4件 → 2日ごと
        assertThat(SubtaskScheduler.spread(d("2026-10-22"), d("2026-10-29"), List.of(60, 60, 60, 60)))
                .containsExactly(d("2026-10-23"), d("2026-10-25"), d("2026-10-27"), d("2026-10-29"));
    }

    @Test
    void 目安の大きい作業ほど日数を多く取る() {
        // 8日間に 30分・90分・120分 → 累積の割合 1/8・4/8・8/8
        assertThat(SubtaskScheduler.spread(d("2026-10-22"), d("2026-10-29"), List.of(30, 90, 120)))
                .containsExactly(d("2026-10-22"), d("2026-10-25"), d("2026-10-29"));
    }

    @Test
    void 目安のないものは平均として扱い全部無ければ同じ重さ() {
        assertThat(SubtaskScheduler.spread(d("2026-10-22"), d("2026-10-25"), Arrays.asList(60, null, 60, null)))
                .containsExactly(d("2026-10-22"), d("2026-10-23"), d("2026-10-24"), d("2026-10-25"));
        assertThat(SubtaskScheduler.spread(d("2026-10-22"), d("2026-10-23"), Arrays.asList(null, null)))
                .containsExactly(d("2026-10-22"), d("2026-10-23"));
    }

    @Test
    void 日数より件数が多ければ同じ日に並び期間が無ければすべて親の期限() {
        assertThat(SubtaskScheduler.spread(d("2026-10-22"), d("2026-10-23"), List.of(10, 10, 10, 10)))
                .containsExactly(d("2026-10-22"), d("2026-10-22"), d("2026-10-23"), d("2026-10-23"));
        assertThat(SubtaskScheduler.spread(d("2026-10-25"), d("2026-10-20"), List.of(10, 10)))
                .containsExactly(d("2026-10-20"), d("2026-10-20"));
        assertThat(SubtaskScheduler.spread(d("2026-10-22"), d("2026-10-29"), List.of())).isEmpty();
    }
}
