package com.masatto.mytask.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 「今日」「期限切れ」の判定や繰り返し生成で使う時計。
 * テストでは固定時刻の Clock に差し替える。
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock(@Value("${mytask.zone}") String zone) {
        return Clock.system(ZoneId.of(zone));
    }
}
