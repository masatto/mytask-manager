package com.masatto.mytask.rule.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import jakarta.validation.constraints.Size;

/**
 * POST /api/rules/{id}/tasks（api-design 4.3）。ルールをひな形にして今すぐタスクを作る。
 *
 * @param title 親タスクの名前（省略・空ならルールのタイトル）。「インタビュー準備（〇〇さん）」のように作るたびに変える
 */
public record CreateTaskFromRuleRequest(
        @Size(max = 200, message = "タイトルは200文字以内で入力してください") String title,
        LocalDate dueDate,
        @JsonFormat(pattern = "HH:mm") LocalTime dueTime) {

    /** 作った親タスク */
    public record CreatedTask(Long id, String title, LocalDate dueDate) {
    }
}
