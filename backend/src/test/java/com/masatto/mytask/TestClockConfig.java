package com.masatto.mytask;

import java.time.LocalDateTime;
import java.time.ZoneId;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration
public class TestClockConfig {

    /** テストの基準時刻：2026-10-14(水) 10:00 JST */
    public static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 14, 10, 0);

    @Bean
    @Primary
    public MutableClock testClock() {
        return new MutableClock(NOW, ZoneId.of("Asia/Tokyo"));
    }
}
