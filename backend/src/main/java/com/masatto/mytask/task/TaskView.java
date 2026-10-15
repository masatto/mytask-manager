package com.masatto.mytask.task;

import java.util.Arrays;

import com.masatto.mytask.common.ApiException;

/** 一覧のビュー（api-design 3.2） */
public enum TaskView {
    TODAY("today"), UPCOMING("upcoming"), NO_DUE("no-due"), DONE("done");

    private final String param;

    TaskView(String param) {
        this.param = param;
    }

    public static TaskView fromParam(String param) {
        return Arrays.stream(values())
                .filter(v -> v.param.equals(param))
                .findFirst()
                .orElseThrow(() -> ApiException.validation("view", "view の値が不正です"));
    }
}
