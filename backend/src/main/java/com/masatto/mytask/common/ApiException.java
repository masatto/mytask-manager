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
    private final Integer incompleteCount;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null, null);
    }

    private ApiException(HttpStatus status, String code, String message, List<ApiError.FieldError> fieldErrors,
            Integer incompleteCount) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors;
        this.incompleteCount = incompleteCount;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    /** Bean Validation で表せない項目間の入力チェックエラー */
    public static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "入力内容に誤りがあります",
                List.of(new ApiError.FieldError(field, message)), null);
    }

    /** 未完了のサブタスクが残る親を、一括完了の指定なしで完了にしようとした（api-design 3.7） */
    public static ApiException subtasksIncomplete(int incompleteCount) {
        return new ApiException(HttpStatus.CONFLICT, "SUBTASKS_INCOMPLETE",
                "未完了のサブタスクが" + incompleteCount + "件あります", null, incompleteCount);
    }

    public ApiError toError() {
        return new ApiError(code, getMessage(), fieldErrors, incompleteCount);
    }
}
