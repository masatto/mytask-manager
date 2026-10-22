package com.masatto.mytask.rule;

public enum PatternType {
    DAILY, WEEKLY, MONTHLY,
    /** 自動では作らない。ルールをひな形として、必要なときに「作成」でタスクを作る（インタビュー準備など） */
    MANUAL
}
