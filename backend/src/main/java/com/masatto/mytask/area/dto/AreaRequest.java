package com.masatto.mytask.area.dto;

import com.masatto.mytask.area.AreaColor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** POST / PUT /api/areas（api-design 8.2） */
public record AreaRequest(
        @NotBlank(message = "名前は必須です") @Size(max = 20, message = "名前は20文字以内で入力してください") String name,
        @NotNull(message = "色は必須です") AreaColor color) {
}
