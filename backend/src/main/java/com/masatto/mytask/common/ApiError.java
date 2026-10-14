package com.masatto.mytask.common;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 共通エラーレスポンス（api-design 1章） */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(String code, String message, List<FieldError> fieldErrors) {

    public record FieldError(String field, String message) {
    }

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, null);
    }
}
