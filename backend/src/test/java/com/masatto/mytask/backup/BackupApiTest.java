package com.masatto.mytask.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;
import com.masatto.mytask.MutableClock;
import com.masatto.mytask.TestClockConfig;

/**
 * Phase 4：バックアップ（api-design 6章）。
 * インポートは自前でトランザクションを確定・ロールバックし、H2 の DDL（ID の振り直し）は確定を伴うため、
 * このクラスはテスト用トランザクションを使わず、前後でテーブルを空にする。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
class BackupApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    @AfterEach
    void cleanUp() {
        clock.set(TestClockConfig.NOW);
        jdbc.update("DELETE FROM tasks");
        jdbc.update("DELETE FROM rule_subtask_templates");
        jdbc.update("DELETE FROM recurrence_rules");
    }

    private long create(String path, String json) throws Exception {
        String body = mockMvc.perform(
                post(path)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    /** 親・サブタスク・完了済み・繰り返し（ひな形つき）を含むデータを作る */
    private void seed() throws Exception {
        long parent = create("/api/tasks", """
                {"title":"設計レビューの指摘対応","dueDate":"2026-10-13","dueTime":"18:00","priority":"HIGH","memo":"メモ","estimateMinutes":120}
                """);
        long sub = create("/api/tasks", "{\"title\":\"指摘1\",\"parentId\":" + parent + "}");
        create("/api/tasks", "{\"title\":\"指摘2\",\"parentId\":" + parent + "}");
        mockMvc.perform(patch("/api/tasks/{id}/status", sub).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DONE\"}"));
        create("/api/rules", """
                {"title":"週次の振り返り","priority":"MEDIUM","dueTime":"17:00",
                 "pattern":{"type":"WEEKLY","daysOfWeek":["WED","MON"]},"startDate":"2026-10-01","estimateMinutes":30,
                 "subtaskTemplates":[{"title":"アウトプット確認","priority":"MEDIUM","estimateMinutes":10},{"title":"来週の計画","priority":"LOW"}]}
                """);
    }

    private String exportJson() throws Exception {
        return mockMvc.perform(get("/api/backup")).andReturn().getResponse().getContentAsString();
    }

    private ResultActions importJson(String json, boolean dryRun) throws Exception {
        return mockMvc.perform(post("/api/backup/import").param("dryRun", String.valueOf(dryRun))
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    /** exportedAt を除いた比較用の JSON */
    private static String withoutExportedAt(String json) {
        return json.replaceAll("\"exportedAt\":\"[^\"]*\",", "");
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    @Test
    void エクスポートにはタスクとルールがIDや関係ごと入り_ファイル名が付く() throws Exception {
        seed();

        mockMvc.perform(get("/api/backup"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        containsString("attachment; filename=\"orbit-20261014-1000.json\"")))
                .andExpect(jsonPath("$.format").value("mytask-manager-backup"))
                .andExpect(jsonPath("$.version").value(3))
                .andExpect(jsonPath("$.exportedAt").value("2026-10-14T10:00:00+09:00"))
                // 親・サブタスク2件・ルールから生成された親・そのサブタスク2件
                .andExpect(jsonPath("$.tasks", hasSize(6)))
                .andExpect(jsonPath("$.tasks[0].dueTime").value("18:00"))
                .andExpect(jsonPath("$.tasks[0].estimateMinutes").value(120))
                .andExpect(jsonPath("$.tasks[1].parentId").value((Object) JsonPath.read(exportJson(), "$.tasks[0].id")))
                .andExpect(jsonPath("$.tasks[1].completedAt").value("2026-10-14T10:00:00+09:00"))
                .andExpect(jsonPath("$.rules[0].pattern.daysOfWeek", contains("MON", "WED")))
                .andExpect(jsonPath("$.rules[0].lastGeneratedDate").value("2026-10-14"))
                .andExpect(jsonPath("$.rules[0].subtaskTemplates[*].title", contains("アウトプット確認", "来週の計画")))
                .andExpect(jsonPath("$.rules[0].estimateMinutes").value(30))
                .andExpect(jsonPath("$.rules[0].subtaskTemplates[0].estimateMinutes").value(10));
    }

    @Test
    void エクスポートしたものをインポートすると元どおりになる() throws Exception {
        seed();
        String original = exportJson();

        // データを変えてから戻す
        mockMvc.perform(delete("/api/tasks/{id}", (Integer) JsonPath.read(original, "$.tasks[0].id")));
        create("/api/tasks", "{\"title\":\"あとから追加\"}");
        importJson(original, false).andExpect(status().isNoContent());

        assertThat(withoutExportedAt(exportJson())).isEqualTo(withoutExportedAt(original));
    }

    @Test
    void インポート後に新しく作るタスクのIDは取り込んだIDと重ならない() throws Exception {
        seed();
        String original = exportJson();
        int maxId = JsonPath.<java.util.List<Integer>>read(original, "$.tasks[*].id").stream()
                .mapToInt(Integer::intValue).max().orElseThrow();

        jdbc.execute("ALTER TABLE tasks ALTER COLUMN id RESTART WITH 1");
        importJson(original, false).andExpect(status().isNoContent());

        assertThat(create("/api/tasks", "{\"title\":\"新規\"}")).isGreaterThan(maxId);
    }

    @Test
    void ドライランは件数を返すだけで何も変えない() throws Exception {
        seed();
        String original = exportJson();
        create("/api/tasks", "{\"title\":\"追加1\"}");
        create("/api/tasks", "{\"title\":\"追加2\"}");

        importJson(original, true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.tasks").value(8))
                .andExpect(jsonPath("$.current.rules").value(1))
                .andExpect(jsonPath("$.incoming.tasks").value(6))
                .andExpect(jsonPath("$.incoming.rules").value(1));

        assertThat(count("tasks")).isEqualTo(8);
    }

    @Test
    void 空のバックアップを取り込むと全データが消える() throws Exception {
        seed();

        importJson("""
                {"format":"mytask-manager-backup","version":1,"exportedAt":"2026-10-14T10:00:00+09:00","tasks":[],"rules":[]}
                """, false).andExpect(status().isNoContent());

        assertThat(count("tasks")).isZero();
        assertThat(count("recurrence_rules")).isZero();
    }

    @Test
    void 取り込んだ繰り返しルールは今日の分が未生成なら生成される() throws Exception {
        seed();
        String original = exportJson();

        // 翌週の水曜にインポートした想定。ルールの lastGeneratedDate は 10/14 のまま
        clock.set(TestClockConfig.NOW.plusDays(7));
        importJson(original, false).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tasks").param("view", "today"))
                .andExpect(jsonPath("$.items[*].task.dueDate", contains("2026-10-13", "2026-10-14", "2026-10-21")));
    }

    @Nested
    class 不正なファイル {

        private static final String HEADER = "\"format\":\"mytask-manager-backup\",\"version\":1,\"exportedAt\":\"2026-10-14T10:00:00+09:00\"";

        private void assertRejected(String json, String messagePart) throws Exception {
            for (boolean dryRun : new boolean[] { true, false }) {
                importJson(json, dryRun)
                        .andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.code").value("INVALID_BACKUP"))
                        .andExpect(jsonPath("$.message", containsString(messagePart)));
            }
            // 既存データは変わらない
            assertThat(count("tasks")).isEqualTo(6);
        }

        @BeforeEach
        void seedData() throws Exception {
            seed();
        }

        @Test
        void JSONとして読めない() throws Exception {
            assertRejected("{not json", "JSON として読み込めません");
        }

        @Test
        void 形式やバージョンが違う() throws Exception {
            assertRejected("{\"format\":\"other\",\"version\":1,\"tasks\":[],\"rules\":[]}", "形式バージョン");
            assertRejected("{\"format\":\"mytask-manager-backup\",\"version\":4,\"tasks\":[],\"rules\":[]}", "形式バージョン");
        }

        @Test
        void 参照先のない親がある() throws Exception {
            assertRejected("{" + HEADER + ",\"rules\":[],\"tasks\":["
                    + task(1, "null") + "," + task(2, "99") + "]}", "親タスクが見つかりません");
        }

        @Test
        void サブタスクが入れ子になっている() throws Exception {
            assertRejected("{" + HEADER + ",\"rules\":[],\"tasks\":["
                    + task(1, "null") + "," + task(2, "1") + "," + task(3, "2") + "]}", "入れ子");
        }

        @Test
        void IDが重複している() throws Exception {
            assertRejected("{" + HEADER + ",\"rules\":[],\"tasks\":[" + task(1, "null") + "," + task(1, "null") + "]}",
                    "重複");
        }

        @Test
        void DBの制約に違反する内容は取り込まない() throws Exception {
            String doneWithoutCompletedAt = task(1, "null").replace("\"TODO\"", "\"DONE\"");
            assertRejected("{" + HEADER + ",\"rules\":[],\"tasks\":[" + doneWithoutCompletedAt + "]}", "制約に違反");
        }

        @Test
        void 列挙値が不正() throws Exception {
            assertRejected("{" + HEADER + ",\"rules\":[],\"tasks\":[" + task(1, "null").replace("\"LOW\"", "\"URGENT\"") + "]}",
                    "JSON として読み込めません");
        }

        private static String task(long id, String parentId) {
            return """
                    {"id":%d,"title":"t%d","priority":"LOW","status":"TODO","parentId":%s,
                     "createdAt":"2026-10-14T10:00:00+09:00","updatedAt":"2026-10-14T10:00:00+09:00"}
                    """.formatted(id, id, parentId);
        }
    }
}
