package com.masatto.mytask.backup;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;

import com.masatto.mytask.area.AreaService;
import com.masatto.mytask.common.ApiException;

/**
 * バックアップファイルの検証（api-design 6.2）。DB の制約だけでは分かりやすいエラーにならないもの
 * （形式・必須項目・ID の重複・参照先の有無）を、取り込む前にまとめて確かめる。
 */
final class BackupValidator {

    private BackupValidator() {
    }

    static void validate(BackupDocument doc) {
        checkFormat(doc);
        Set<Long> areaIds = hasAreas(doc) ? checkAreas(doc.areas()) : Set.of();
        checkRequiredFields(doc.tasks(), doc.rules());
        checkReferences(doc, areaIds);
    }

    /** 形式バージョン 2 以降はエリアを持つ。1 ならエリアは今のまま残し、取り込むタスクとルールは未分類にする */
    static boolean hasAreas(BackupDocument doc) {
        return doc.version() >= 2;
    }

    static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BACKUP", "バックアップファイルが不正です：" + message);
    }

    private static void checkFormat(BackupDocument doc) {
        if (!BackupDocument.FORMAT.equals(doc.format()) || doc.version() == null || doc.version() < 1
                || doc.version() > BackupDocument.VERSION) {
            throw invalid("Orbit のバックアップファイル（形式バージョン 1〜" + BackupDocument.VERSION + "）ではありません");
        }
        if (doc.tasks() == null || doc.rules() == null) {
            throw invalid("tasks または rules がありません");
        }
    }

    /** エリアの数・必須項目・ID の重複を確かめ、エリアの ID を返す */
    private static Set<Long> checkAreas(List<BackupDocument.AreaData> areas) {
        if (areas == null) {
            throw invalid("areas がありません");
        }
        if (areas.size() > AreaService.MAX_AREAS) {
            throw invalid("エリアが多すぎます（" + AreaService.MAX_AREAS + "個まで）");
        }
        for (BackupDocument.AreaData a : areas) {
            if (a == null || a.id() == null || isBlank(a.name()) || a.name().strip().length() > 20
                    || a.color() == null || a.createdAt() == null || a.updatedAt() == null) {
                throw invalid("エリアに必須の項目がありません（id=" + (a == null ? null : a.id()) + "）");
            }
        }
        return uniqueIds(areas, BackupDocument.AreaData::id, "エリア").keySet();
    }

    private static void checkRequiredFields(List<BackupDocument.TaskData> tasks, List<BackupDocument.RuleData> rules) {
        for (BackupDocument.TaskData t : tasks) {
            if (t.id() == null || isBlank(t.title()) || t.priority() == null || t.status() == null
                    || t.createdAt() == null || t.updatedAt() == null) {
                throw invalid("タスクに必須の項目がありません（id=" + t.id() + "）");
            }
        }
        for (BackupDocument.RuleData r : rules) {
            if (r.id() == null || isBlank(r.title()) || r.priority() == null || r.pattern() == null
                    || r.pattern().type() == null || r.startDate() == null || r.active() == null
                    || r.createdAt() == null || r.updatedAt() == null) {
                throw invalid("ルールに必須の項目がありません（id=" + r.id() + "）");
            }
            if (r.subtaskTemplates() != null && r.subtaskTemplates().stream()
                    .anyMatch(tt -> tt == null || isBlank(tt.title()) || tt.priority() == null)) {
                throw invalid("ルールのサブタスクのひな形に不正な項目があります（id=" + r.id() + "）");
            }
        }
    }

    /** ID の重複と、親タスク・エリア・生成元ルールの参照先があるか */
    private static void checkReferences(BackupDocument doc, Set<Long> areaIds) {
        Map<Long, BackupDocument.TaskData> tasksById = uniqueIds(doc.tasks(), BackupDocument.TaskData::id, "タスク");
        Set<Long> ruleIds = uniqueIds(doc.rules(), BackupDocument.RuleData::id, "ルール").keySet();
        boolean checkAreas = hasAreas(doc);
        for (BackupDocument.RuleData r : doc.rules()) {
            if (checkAreas && r.areaId() != null && !areaIds.contains(r.areaId())) {
                throw invalid("エリアが見つかりません（ルール id=" + r.id() + " の areaId=" + r.areaId() + "）");
            }
        }
        for (BackupDocument.TaskData t : doc.tasks()) {
            if (t.parentId() != null) {
                BackupDocument.TaskData parent = tasksById.get(t.parentId());
                if (parent == null) {
                    throw invalid("親タスクが見つかりません（id=" + t.id() + " の parentId=" + t.parentId() + "）");
                }
                if (parent.parentId() != null) {
                    throw invalid("サブタスクが入れ子になっています（id=" + t.id() + "）");
                }
            }
            if (checkAreas && t.areaId() != null && !areaIds.contains(t.areaId())) {
                throw invalid("エリアが見つかりません（id=" + t.id() + " の areaId=" + t.areaId() + "）");
            }
            if (t.recurrenceRuleId() != null && !ruleIds.contains(t.recurrenceRuleId())) {
                throw invalid("生成元のルールが見つかりません（id=" + t.id() + " の recurrenceRuleId="
                        + t.recurrenceRuleId() + "）");
            }
        }
    }

    private static <T> Map<Long, T> uniqueIds(List<T> items, Function<T, Long> id, String label) {
        Set<Long> seen = new HashSet<>();
        for (T item : items) {
            if (!seen.add(id.apply(item))) {
                throw invalid(label + "の id が重複しています（id=" + id.apply(item) + "）");
            }
        }
        return items.stream().collect(Collectors.toMap(id, Function.identity()));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
