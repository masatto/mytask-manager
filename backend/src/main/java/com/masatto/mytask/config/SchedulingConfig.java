package com.masatto.mytask.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 繰り返しタスクの毎日0時の生成（RecurrenceGenerator）を有効にする */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
