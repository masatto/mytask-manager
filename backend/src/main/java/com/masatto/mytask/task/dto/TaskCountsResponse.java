package com.masatto.mytask.task.dto;

public record TaskCountsResponse(int today, int overdue, int upcoming, int noDue) {
}
