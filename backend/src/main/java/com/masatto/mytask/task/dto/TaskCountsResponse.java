package com.masatto.mytask.task.dto;

/**
 * サイドバーなどの件数（api-design 3.3）。
 * doneToday は今日完了にした親タスクの数（Today の進み具合の表示に使う）。
 */
public record TaskCountsResponse(int today, int overdue, int upcoming, int noDue, int doneToday) {
}
