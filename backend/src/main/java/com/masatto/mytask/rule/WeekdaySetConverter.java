package com.masatto.mytask.rule;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** 曜日の集合 ⇔ "MON,THU"（db-design 3.2 の days_of_week） */
@Converter
public class WeekdaySetConverter implements AttributeConverter<Set<Weekday>, String> {

    @Override
    public String convertToDatabaseColumn(Set<Weekday> days) {
        if (days == null || days.isEmpty()) {
            return null;
        }
        // EnumSet は宣言順（月曜始まり）で並ぶので、保存される文字列が安定する
        return EnumSet.copyOf(days).stream().map(Weekday::name).collect(Collectors.joining(","));
    }

    @Override
    public Set<Weekday> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Arrays.stream(value.split(","))
                .map(Weekday::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(Weekday.class)));
    }
}
