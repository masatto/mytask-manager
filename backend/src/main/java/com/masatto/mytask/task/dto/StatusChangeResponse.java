package com.masatto.mytask.task.dto;

import java.util.List;

import com.masatto.mytask.task.TaskStatus;

/** 今回の操作で状態が変わったタスク（「元に戻す」で使う） */
public record StatusChangeResponse(List<Changed> changed) {

    public record Changed(Long id, TaskStatus previousStatus, TaskStatus status) {
    }
}
