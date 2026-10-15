package com.masatto.mytask.task.dto;

import java.util.List;

public record TaskListResponse(List<TaskListItem> items, boolean hasMore) {
}
