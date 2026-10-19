package com.masatto.mytask.area;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** エリアの色。実際の色は画面側で決める（ここでは名前だけ持つ） */
public enum AreaColor {
    BLUE, GREEN, PURPLE, ORANGE, TEAL, PINK, BROWN, GRAY;

    @JsonValue
    public String value() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static AreaColor of(String value) {
        for (AreaColor color : values()) {
            if (color.value().equals(value)) {
                return color;
            }
        }
        throw new IllegalArgumentException("Unknown area color: " + value);
    }
}
