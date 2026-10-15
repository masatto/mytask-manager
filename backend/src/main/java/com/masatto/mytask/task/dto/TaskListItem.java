package com.masatto.mytask.task.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

/** 一覧の1行（親タスク単位。api-design 3.1） */
public record TaskListItem(
        TaskResponse task,
        boolean contextOnly,
        List<TaskResponse> subtasks,
        Progress progress,
        LocalDate viewDate,
        @JsonFormat(pattern = "HH:mm") LocalTime viewTime,
        boolean viewOverdue) {

    public record Progress(int done, int total) {
    }
}
