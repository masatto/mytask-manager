package com.masatto.mytask.common;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/** 業務エラー。code は api-design 1章のエラーコード */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }
}
