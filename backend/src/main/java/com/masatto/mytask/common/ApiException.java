package com.masatto.mytask.common;

import java.util.List;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/** 業務エラー。code は api-design 1章のエラーコード */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<ApiError.FieldError> fieldErrors;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    private ApiException(HttpStatus status, String code, String message, List<ApiError.FieldError> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    /** Bean Validation で表せない項目間の入力チェックエラー */
    public static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "入力内容に誤りがあります",
                List.of(new ApiError.FieldError(field, message)));
    }
}
