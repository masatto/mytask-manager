package com.masatto.mytask.area.dto;

import com.masatto.mytask.area.AreaColor;

/**
 * api-design 8.1 の AreaResponse。
 *
 * @param taskCount このエリアの親タスクの数（完了済みも含む。削除するときの確認に使う）
 * @param ruleCount このエリアの繰り返しルールの数
 */
public record AreaResponse(Long id, String name, AreaColor color, long taskCount, long ruleCount) {
}
