package com.masatto.mytask.area;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

/** エリア（api-design 8章）と、タスク・ルール・バックアップのエリアまわり */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
class AreaApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    long project;
    long internal;

    /** 他のテストのデータとは別に、エリアだけを「Project / Internal」の2つに作り直す */
    @BeforeEach
    void setUp() throws Exception {
        clock.set(TestClockConfig.NOW);
        cleanUp();
        project = create("/api/areas", "{\"name\":\"Project\",\"color\":\"blue\"}");
        internal = create("/api/areas", "{\"name\":\"Internal\",\"color\":\"green\"}");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM tasks");
        jdbc.update("DELETE FROM rule_subtask_templates");
        jdbc.update("DELETE FROM recurrence_rules");
        jdbc.update("DELETE FROM areas");
    }

    private ResultActions send(String method, String path, String json) throws Exception {
        var builder = switch (method) {
            case "POST" -> post(path);
            case "PUT" -> put(path);
            default -> throw new IllegalArgumentException(method);
        };
        return mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private long create(String path, String json) throws Exception {
        String body = send("POST", path, json).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private long task(String title, Long areaId) throws Exception {
        return create("/api/tasks", "{\"title\":\"" + title + "\",\"dueDate\":\"2026-10-14\",\"areaId\":" + areaId + "}");
    }

    private Long areaOf(long taskId) {
        return jdbc.queryForObject("SELECT area_id FROM tasks WHERE id = ?", Long.class, taskId);
    }

    @Nested
    class エリアの管理 {

        @Test
        void 並び順に一覧し_件数も返す() throws Exception {
            task("A", project);
            mockMvc.perform(get("/api/areas"))
                    .andExpect(jsonPath("$.items[*].name", contains("Project", "Internal")))
                    .andExpect(jsonPath("$.items[0].color").value("blue"))
                    .andExpect(jsonPath("$.items[0].taskCount").value(1))
                    .andExpect(jsonPath("$.items[1].taskCount").value(0));
        }

        @Test
        void 名前と色を変えられ_並べ替えられる() throws Exception {
            send("PUT", "/api/areas/" + internal, "{\"name\":\" 社内 \",\"color\":\"purple\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("社内"))
                    .andExpect(jsonPath("$.color").value("purple"));
            send("PUT", "/api/areas/order", "{\"ids\":[" + internal + "," + project + "]}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[*].name", contains("社内", "Project")));
        }

        @Test
        void 同じ名前_空の名前_不明な色_一部だけの並べ替えはエラー() throws Exception {
            send("POST", "/api/areas", "{\"name\":\"project\",\"color\":\"blue\"}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors[0].message").value("同じ名前のエリアがあります"));
            send("POST", "/api/areas", "{\"name\":\" \",\"color\":\"blue\"}").andExpect(status().isBadRequest());
            send("POST", "/api/areas", "{\"name\":\"x\",\"color\":\"red\"}").andExpect(status().isBadRequest());
            send("POST", "/api/areas", "{\"name\":\"123456789012345678901\",\"color\":\"blue\"}")
                    .andExpect(status().isBadRequest());
            send("PUT", "/api/areas/order", "{\"ids\":[" + project + "]}").andExpect(status().isBadRequest());
        }

        @Test
        void 十個までしか作れない() throws Exception {
            for (int i = 3; i <= AreaService.MAX_AREAS; i++) {
                create("/api/areas", "{\"name\":\"A" + i + "\",\"color\":\"gray\"}");
            }
            send("POST", "/api/areas", "{\"name\":\"多すぎ\",\"color\":\"gray\"}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors[0].message").value("エリアは10個までです"));
        }

        @Test
        void 削除すると_タスクとルールを移動先に移す() throws Exception {
            long parent = task("親", internal);
            long sub = create("/api/tasks", "{\"title\":\"子\",\"parentId\":" + parent + "}");
            long rule = create("/api/rules", """
                    {"title":"日次","priority":"LOW","pattern":{"type":"DAILY"},"startDate":"2026-10-20","areaId":%d}
                    """.formatted(internal));

            mockMvc.perform(delete("/api/areas/" + internal).param("moveTo", String.valueOf(project)))
                    .andExpect(status().isNoContent());

            assertThat(areaOf(parent)).isEqualTo(project);
            assertThat(areaOf(sub)).isEqualTo(project);
            mockMvc.perform(get("/api/rules/" + rule)).andExpect(jsonPath("$.areaId").value(project));
            mockMvc.perform(get("/api/areas")).andExpect(jsonPath("$.items", hasSize(1)));
        }

        @Test
        void 移動先を指定せずに削除すると未分類になる() throws Exception {
            long parent = task("親", internal);
            mockMvc.perform(delete("/api/areas/" + internal)).andExpect(status().isNoContent());
            assertThat(areaOf(parent)).isNull();
        }

        @Test
        void 自分自身や存在しないエリアには移せない() throws Exception {
            mockMvc.perform(delete("/api/areas/" + internal).param("moveTo", String.valueOf(internal)))
                    .andExpect(status().isBadRequest());
            mockMvc.perform(delete("/api/areas/" + internal).param("moveTo", "999999"))
                    .andExpect(status().isBadRequest());
            mockMvc.perform(delete("/api/areas/999999")).andExpect(status().isNotFound());
        }
    }

    @Nested
    class タスクのエリア {

        @Test
        void サブタスクは親のエリアに入り_親のエリアを変えると一緒に移る() throws Exception {
            long parent = task("親", project);
            // サブタスクで別のエリアを指定しても、親に合わせる
            long sub = create("/api/tasks", "{\"title\":\"子\",\"parentId\":" + parent + ",\"areaId\":" + internal + "}");
            assertThat(areaOf(sub)).isEqualTo(project);

            send("PUT", "/api/tasks/" + parent, """
                    {"title":"親","dueDate":"2026-10-14","priority":"MEDIUM","status":"TODO","areaId":%d}
                    """.formatted(internal))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.areaId").value(internal));
            assertThat(areaOf(sub)).isEqualTo(internal);
        }

        @Test
        void 存在しないエリアは指定できない() throws Exception {
            send("POST", "/api/tasks", "{\"title\":\"x\",\"areaId\":999999}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("areaId"));
        }

        @Test
        void 一覧_件数_検索をエリアで絞り込める() throws Exception {
            task("設計レビュー", project);
            task("勤怠の締め", internal);
            task("未分類のレビュー", null);

            mockMvc.perform(get("/api/tasks").param("view", "today").param("area", String.valueOf(internal)))
                    .andExpect(jsonPath("$.items[*].task.title", contains("勤怠の締め")));
            mockMvc.perform(get("/api/tasks").param("view", "today"))
                    .andExpect(jsonPath("$.items", hasSize(3)));
            mockMvc.perform(get("/api/tasks/counts").param("area", String.valueOf(project)))
                    .andExpect(jsonPath("$.today").value(1));
            mockMvc.perform(get("/api/tasks/search").param("q", "レビュー").param("area", String.valueOf(project)))
                    .andExpect(jsonPath("$.items[*].task.title", contains("設計レビュー")));
        }

        @Test
        void 完了済みと今日の完了件数もエリアで絞り込める() throws Exception {
            long a = task("A", project);
            long b = task("B", internal);
            for (long id : new long[] { a, b }) {
                mockMvc.perform(patch("/api/tasks/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DONE\"}"));
            }
            mockMvc.perform(get("/api/tasks").param("view", "done").param("area", String.valueOf(project)))
                    .andExpect(jsonPath("$.items[*].task.title", contains("A")));
            mockMvc.perform(get("/api/tasks/counts").param("area", String.valueOf(internal)))
                    .andExpect(jsonPath("$.doneToday").value(1));
        }
    }

    @Nested
    class ルールのエリア {

        @Test
        void ルールから生成したタスクとサブタスクはルールのエリアに入り_ルール一覧も絞り込める() throws Exception {
            long rule = create("/api/rules", """
                    {"title":"勤怠の締め","priority":"MEDIUM","pattern":{"type":"DAILY"},"startDate":"2026-10-01",
                     "areaId":%d,"subtaskTemplates":[{"title":"確認","priority":"LOW"}]}
                    """.formatted(internal));
            create("/api/rules", """
                    {"title":"週報","priority":"MEDIUM","pattern":{"type":"DAILY"},"startDate":"2026-10-30","areaId":%d}
                    """.formatted(project));

            assertThat(jdbc.queryForList("SELECT area_id FROM tasks WHERE recurrence_rule_id = ? OR parent_id IN "
                    + "(SELECT id FROM tasks WHERE recurrence_rule_id = ?)", Long.class, rule, rule))
                    .hasSize(2)
                    .containsOnly(internal);
            mockMvc.perform(get("/api/rules").param("area", String.valueOf(internal)))
                    .andExpect(jsonPath("$.items[*].title", contains("勤怠の締め")));
            mockMvc.perform(get("/api/rules"))
                    .andExpect(jsonPath("$.items[*].title", containsInAnyOrder("勤怠の締め", "週報")));
        }
    }

    @Nested
    class バックアップのエリア {

        private String exportJson() throws Exception {
            return mockMvc.perform(get("/api/backup")).andReturn().getResponse().getContentAsString();
        }

        private ResultActions importJson(String json) throws Exception {
            return mockMvc.perform(post("/api/backup/import").contentType(MediaType.APPLICATION_JSON).content(json));
        }

        @Test
        void エリアも含めて書き出し_取り込むと元どおりになる() throws Exception {
            long parent = task("親", internal);
            create("/api/tasks", "{\"title\":\"子\",\"parentId\":" + parent + "}");
            String original = exportJson();
            assertThat((Object) JsonPath.read(original, "$.areas[*].name")).asString().contains("Project", "Internal");

            mockMvc.perform(delete("/api/areas/" + internal));
            importJson(original).andExpect(status().isNoContent());

            assertThat(exportJson().replaceAll("\"exportedAt\":\"[^\"]*\",", ""))
                    .isEqualTo(original.replaceAll("\"exportedAt\":\"[^\"]*\",", ""));
            // 取り込んだ後に作るエリアの ID が重ならない
            create("/api/areas", "{\"name\":\"新規\",\"color\":\"teal\"}");
        }

        @Test
        void 形式バージョン1を取り込むとエリアは残し_タスクは未分類になる() throws Exception {
            importJson("""
                    {"format":"mytask-manager-backup","version":1,"exportedAt":"2026-10-14T10:00:00+09:00","rules":[],
                     "tasks":[{"id":1,"title":"t","priority":"LOW","status":"TODO","areaId":%d,
                       "createdAt":"2026-10-14T10:00:00+09:00","updatedAt":"2026-10-14T10:00:00+09:00"}]}
                    """.formatted(project)).andExpect(status().isNoContent());

            assertThat(areaOf(1)).isNull();
            mockMvc.perform(get("/api/areas")).andExpect(jsonPath("$.items", hasSize(2)));
        }

        @Test
        void 存在しないエリアを参照するファイルは取り込まない() throws Exception {
            importJson("""
                    {"format":"mytask-manager-backup","version":2,"exportedAt":"2026-10-14T10:00:00+09:00","rules":[],
                     "areas":[{"id":5,"name":"A","color":"blue","createdAt":"2026-10-14T10:00:00+09:00","updatedAt":"2026-10-14T10:00:00+09:00"}],
                     "tasks":[{"id":1,"title":"t","priority":"LOW","status":"TODO","areaId":6,
                       "createdAt":"2026-10-14T10:00:00+09:00","updatedAt":"2026-10-14T10:00:00+09:00"}]}
                    """)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("エリアが見つかりません")));
        }
    }
}
