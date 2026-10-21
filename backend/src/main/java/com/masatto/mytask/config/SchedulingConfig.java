package com.masatto.mytask.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 日付が変わったときの繰り返しタスクの生成と自動バックアップ（DayChangeWatcher）を有効にする */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
