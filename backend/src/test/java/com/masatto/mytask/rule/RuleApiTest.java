package com.masatto.mytask.rule;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;
import com.masatto.mytask.MutableClock;
import com.masatto.mytask.TestClockConfig;

import jakarta.persistence.EntityManager;

/** Phase 3：繰り返しルールAPI（api-design 4章）と生成処理（5章）。基準日は 2026-10-14(水) */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Transactional
class RuleApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    MutableClock clock;

    @Autowired
    RecurrenceGenerator generator;

    @Autowired
    EntityManager entityManager;

    @BeforeEach
    void resetClock() {
        clock.set(TestClockConfig.NOW);
    }

    private static String weekly(String title, String days, String startDate) {
        return """
                {"title":"%s","priority":"MEDIUM","pattern":{"type":"WEEKLY","daysOfWeek":[%s]},
                 "startDate":"%s","subtaskTemplates":[{"title":"アウトプット確認","priority":"MEDIUM"},
                 {"title":"来週の計画","priority":"LOW"}]}
                """.formatted(title, days, startDate);
    }

    private ResultActions postRule(String json) throws Exception {
        return mockMvc.perform(post("/api/rules").contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private long createRule(String json) throws Exception {
        String body = postRule(json).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private ResultActions tasks(String view) throws Exception {
        return mockMvc.perform(get("/api/tasks").param("view", view));
    }

    @Nested
    class 作成と取得 {

        @Test
        void ルールを作成すると次回の生成日が返る() throws Exception {
            postRule(weekly("週次の振り返り", "\"MON\",\"THU\"", "2026-10-15"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.pattern.type").value("WEEKLY"))
                    .andExpect(jsonPath("$.pattern.daysOfWeek", contains("MON", "THU")))
                    .andExpect(jsonPath("$.pattern.dayOfMonth").doesNotExist())
                    .andExpect(jsonPath("$.subtaskTemplates[*].title", contains("アウトプット確認", "来週の計画")))
                    .andExpect(jsonPath("$.active").value(true))
                    .andExpect(jsonPath("$.nextOccurrence").value("2026-10-15"))
                    .andExpect(jsonPath("$.lastGeneratedDate").doesNotExist());
        }

        @Test
        void 一覧は作成順() throws Exception {
            createRule(weekly("B", "\"MON\"", "2026-10-20"));
            createRule(weekly("A", "\"MON\"", "2026-10-20"));

            mockMvc.perform(get("/api/rules")).andExpect(jsonPath("$.items[*].title", contains("B", "A")));
        }

        @Test
        void パターンと関係ない項目は無視する() throws Exception {
            postRule("""
                    {"title":"毎日","priority":"LOW","pattern":{"type":"DAILY","daysOfWeek":["MON"],"dayOfMonth":3},
                     "startDate":"2026-10-20"}
                    """)
                    .andExpect(jsonPath("$.pattern.daysOfWeek").doesNotExist())
                    .andExpect(jsonPath("$.pattern.dayOfMonth").doesNotExist());
        }

        @Test
        void 存在しないルールは404() throws Exception {
            mockMvc.perform(get("/api/rules/{id}", 99999)).andExpect(status().isNotFound());
        }
    }

    @Nested
    class 入力チェック {

        @Test
        void 毎週は曜日が1つ以上必要() throws Exception {
            postRule(weekly("t", "", "2026-10-14"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("pattern.daysOfWeek"));
        }

        @Test
        void 毎月の日付は1から31か末日() throws Exception {
            postRule("""
                    {"title":"t","priority":"MEDIUM","pattern":{"type":"MONTHLY","dayOfMonth":32},"startDate":"2026-10-14"}
                    """)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("pattern.dayOfMonth"));
        }

        @Test
        void 終了日は開始日以降() throws Exception {
            postRule("""
                    {"title":"t","priority":"MEDIUM","pattern":{"type":"DAILY"},"startDate":"2026-10-14","endDate":"2026-10-13"}
                    """)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("endDate"));
        }

        @Test
        void ひな形は20件まで() throws Exception {
            String templates = "{\"title\":\"x\",\"priority\":\"LOW\"},".repeat(21);
            postRule("{\"title\":\"t\",\"priority\":\"MEDIUM\",\"pattern\":{\"type\":\"DAILY\"},\"startDate\":\"2026-10-20\","
                    + "\"subtaskTemplates\":[" + templates.substring(0, templates.length() - 1) + "]}")
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    class 生成 {

        @Test
        void 作成した直後に今日が発生日なら_すぐに生成されサブタスクもコピーされる() throws Exception {
            long ruleId = createRule(weekly("週次の振り返り", "\"WED\"", "2026-10-01"));

            tasks("today")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].task.title").value("週次の振り返り"))
                    .andExpect(jsonPath("$.items[0].task.dueDate").value("2026-10-14"))
                    .andExpect(jsonPath("$.items[0].task.recurrence.ruleId").value(ruleId))
                    .andExpect(jsonPath("$.items[0].task.recurrence.ruleTitle").value("週次の振り返り"))
                    .andExpect(jsonPath("$.items[0].task.recurrence.occurrenceDate").value("2026-10-14"))
                    .andExpect(jsonPath("$.items[0].subtasks[*].title", contains("アウトプット確認", "来週の計画")))
                    .andExpect(jsonPath("$.items[0].subtasks[0].recurrence").doesNotExist());

            mockMvc.perform(get("/api/rules/{id}", ruleId))
                    .andExpect(jsonPath("$.lastGeneratedDate").value("2026-10-14"))
                    .andExpect(jsonPath("$.nextOccurrence").value("2026-10-21"));
        }

        @Test
        void 開始日が過去なら過去の直近の回が1件だけ生成される() throws Exception {
            createRule("""
                    {"title":"日報","priority":"MEDIUM","dueTime":"18:00","pattern":{"type":"DAILY"},"startDate":"2026-09-01"}
                    """);

            tasks("today")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].task.dueDate").value("2026-10-14"))
                    .andExpect(jsonPath("$.items[0].task.dueTime").value("18:00"));
        }

        @Test
        void 開始日が未来なら作成時には生成しない() throws Exception {
            createRule(weekly("t", "\"WED\"", "2026-10-20"));

            tasks("today").andExpect(jsonPath("$.items", empty()));
            tasks("upcoming").andExpect(jsonPath("$.items", empty()));
        }

        @Test
        void 日付が変わると次の回が生成される() throws Exception {
            createRule("""
                    {"title":"日報","priority":"MEDIUM","pattern":{"type":"DAILY"},"startDate":"2026-10-14"}
                    """);

            clock.set(TestClockConfig.NOW.plusDays(1).withHour(0).withMinute(0));
            generator.generateAll();

            tasks("today").andExpect(jsonPath("$.items[*].task.dueDate", contains("2026-10-14", "2026-10-15")));
        }

        @Test
        void 停止していた間に逃した回は直近の1件だけ生成される() throws Exception {
            createRule("""
                    {"title":"日報","priority":"MEDIUM","pattern":{"type":"DAILY"},"startDate":"2026-10-14"}
                    """);

            // アプリを5日間止めていた想定
            clock.set(TestClockConfig.NOW.plusDays(5));
            generator.generateAll();

            tasks("today").andExpect(jsonPath("$.items[*].task.dueDate", contains("2026-10-14", "2026-10-19")));
        }

        @Test
        void 同じ日に何度実行しても二重には生成されない() throws Exception {
            createRule(weekly("t", "\"WED\"", "2026-10-01"));

            generator.generateAll();
            generator.generateAll();

            tasks("today").andExpect(jsonPath("$.items", hasSize(1)));
        }

        @Test
        void 生成されたタスクを削除しても再生成されない() throws Exception {
            createRule(weekly("t", "\"WED\"", "2026-10-01"));
            String body = tasks("today").andReturn().getResponse().getContentAsString();
            long taskId = ((Number) JsonPath.read(body, "$.items[0].task.id")).longValue();

            mockMvc.perform(delete("/api/tasks/{id}", taskId)).andExpect(status().isNoContent());
            generator.generateAll();

            tasks("today").andExpect(jsonPath("$.items", empty()));
        }

        @Test
        void 停止中のルールは生成しない() throws Exception {
            // 開始日を明日（木曜）にして、作成時点では何も生成されないようにする
            long ruleId = createRule(weekly("t", "\"THU\"", "2026-10-15"));
            mockMvc.perform(patch("/api/rules/{id}/active", ruleId).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"active\":false}"))
                    .andExpect(jsonPath("$.active").value(false))
                    .andExpect(jsonPath("$.nextOccurrence").doesNotExist());

            clock.set(TestClockConfig.NOW.plusDays(1));
            generator.generateAll();

            tasks("today").andExpect(jsonPath("$.items", empty()));
        }

        @Test
        void 再開すると逃した直近の回が生成される() throws Exception {
            long ruleId = createRule(weekly("t", "\"THU\"", "2026-10-15"));
            mockMvc.perform(patch("/api/rules/{id}/active", ruleId).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"active\":false}"));

            clock.set(TestClockConfig.NOW.plusDays(9)); // 10/23(金)。停止中に 10/15, 10/22 の木曜を逃した
            generator.generateAll();
            mockMvc.perform(patch("/api/rules/{id}/active", ruleId).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"active\":true}"));

            tasks("today").andExpect(jsonPath("$.items[*].task.dueDate", contains("2026-10-22")));
        }

        @Test
        void 終了日を過ぎたルールは生成しない() throws Exception {
            createRule("""
                    {"title":"t","priority":"MEDIUM","pattern":{"type":"DAILY"},"startDate":"2026-10-14","endDate":"2026-10-14"}
                    """);

            clock.set(TestClockConfig.NOW.plusDays(3));
            generator.generateAll();

            tasks("today").andExpect(jsonPath("$.items[*].task.dueDate", contains("2026-10-14")));
        }
    }

    @Nested
    class 更新と削除 {

        @Test
        void 更新は次回生成分から反映され_生成済みのタスクは変わらない() throws Exception {
            long ruleId = createRule(weekly("週次の振り返り", "\"WED\"", "2026-10-01"));

            mockMvc.perform(put("/api/rules/{id}", ruleId).contentType(MediaType.APPLICATION_JSON)
                    .content(weekly("週次レビュー", "\"WED\"", "2026-10-01").replace(
                            "{\"title\":\"アウトプット確認\",\"priority\":\"MEDIUM\"},\n", "")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("週次レビュー"))
                    .andExpect(jsonPath("$.subtaskTemplates[*].title", contains("来週の計画")));

            tasks("today")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].task.title").value("週次の振り返り"))
                    .andExpect(jsonPath("$.items[0].subtasks", hasSize(2)));

            clock.set(TestClockConfig.NOW.plusDays(7));
            generator.generateAll();
            tasks("today").andExpect(jsonPath("$.items[1].task.title").value("週次レビュー"))
                    .andExpect(jsonPath("$.items[1].subtasks[*].title", contains("来週の計画")));
        }

        @Test
        void ひな形を増やしたり減らしたりできる() throws Exception {
            long ruleId = createRule(weekly("t", "\"MON\"", "2026-10-20"));
            String three = """
                    {"title":"t","priority":"MEDIUM","pattern":{"type":"WEEKLY","daysOfWeek":["MON"]},"startDate":"2026-10-20",
                     "subtaskTemplates":[{"title":"1","priority":"LOW"},{"title":"2","priority":"LOW"},{"title":"3","priority":"HIGH"}]}
                    """;
            mockMvc.perform(put("/api/rules/{id}", ruleId).contentType(MediaType.APPLICATION_JSON).content(three))
                    .andExpect(jsonPath("$.subtaskTemplates[*].title", contains("1", "2", "3")));

            String one = three.replace(",{\"title\":\"2\",\"priority\":\"LOW\"},{\"title\":\"3\",\"priority\":\"HIGH\"}", "");
            mockMvc.perform(put("/api/rules/{id}", ruleId).contentType(MediaType.APPLICATION_JSON).content(one))
                    .andExpect(jsonPath("$.subtaskTemplates[*].title", contains("1")));
        }

        @Test
        void ルールを削除しても生成済みのタスクは残り_繰り返しの参照だけが外れる() throws Exception {
            long ruleId = createRule(weekly("t", "\"WED\"", "2026-10-01"));

            mockMvc.perform(delete("/api/rules/{id}", ruleId)).andExpect(status().isNoContent());
            // 参照を外すのは DB（ON DELETE SET NULL）。実際はリクエストごとに別セッションなので、
            // テストでもキャッシュ済みのエンティティを捨てて DB から読み直す
            entityManager.flush();
            entityManager.clear();

            mockMvc.perform(get("/api/rules")).andExpect(jsonPath("$.items", empty()));
            tasks("today")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].task.recurrence.ruleId").doesNotExist())
                    .andExpect(jsonPath("$.items[0].task.recurrence.ruleTitle").doesNotExist())
                    .andExpect(jsonPath("$.items[0].task.recurrence.occurrenceDate").value("2026-10-14"));
        }
    }

    @Nested
    class プレビュー {

        @Test
        void 今日以降の発生日を3件返し_保存はしない() throws Exception {
            mockMvc.perform(post("/api/rules/preview").contentType(MediaType.APPLICATION_JSON).content("""
                    {"pattern":{"type":"MONTHLY","dayOfMonth":-1},"startDate":"2026-01-01"}
                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.occurrences", contains("2026-10-31", "2026-11-30", "2026-12-31")));

            mockMvc.perform(get("/api/rules")).andExpect(jsonPath("$.items", empty()));
        }

        @Test
        void 終了日までしか返さない() throws Exception {
            mockMvc.perform(post("/api/rules/preview").contentType(MediaType.APPLICATION_JSON).content("""
                    {"pattern":{"type":"DAILY"},"startDate":"2026-10-01","endDate":"2026-10-15"}
                    """))
                    .andExpect(jsonPath("$.occurrences", contains("2026-10-14", "2026-10-15")));
        }
    }
}
