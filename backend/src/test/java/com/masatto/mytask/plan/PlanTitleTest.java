package com.masatto.mytask.plan;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.masatto.mytask.plan.PlanProgressService.StepTitle;

/** 計画のステップとみなすタイトルの形（api-design 11.1） */
class PlanTitleTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "韓国語学習 Step3: 基本文型       | 韓国語学習   | 3",
            "expense-flow Step10：仕上げ      | expense-flow | 10",
            "読書 第2回: 3章を読む            | 読書         | 2",
            "TOPIK 対策 Step1: 準備           | TOPIK 対策   | 1",
    })
    void 計画名と番号に分ける(String title, String planName, int number) {
        assertThat(PlanProgressService.parseTitle(title)).contains(new StepTitle(planName, number));
    }

    @ParameterizedTest
    @ValueSource(strings = { "メモ: 雑多なこと", "Step1: 計画名がない", "韓国語学習 Step3 基本文型", "単語暗記（20分）" })
    void 形が違えばステップにしない(String title) {
        assertThat(PlanProgressService.parseTitle(title)).isEmpty();
    }
}
