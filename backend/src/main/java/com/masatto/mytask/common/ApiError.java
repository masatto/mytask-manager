package com.masatto.mytask.common;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 共通エラーレスポンス（api-design 1章）。
 * incompleteCount は SUBTASKS_INCOMPLETE のときだけ値を持つ（api-design 3.7）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(String code, String message, List<FieldError> fieldErrors, Integer incompleteCount) {

    public record FieldError(String field, String message) {
    }

    public ApiError(String code, String message, List<FieldError> fieldErrors) {
        this(code, message, fieldErrors, null);
    }

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, null, null);
    }
}
