package com.masatto.mytask.task;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
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

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Transactional
class TaskApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void resetClock() {
        clock.set(TestClockConfig.NOW);
    }

    private ResultActions postTask(String json) throws Exception {
        return mockMvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private long createTask(String json) throws Exception {
        String body = postTask(json).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private ResultActions changeStatus(long id, String status) throws Exception {
        return mockMvc.perform(patch("/api/tasks/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}"));
    }

    @Nested
    class 作成 {

        @Test
        void 既定値で作成される() throws Exception {
            postTask("""
                    {"title":"  API設計書を書く  "}
                    """)
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.title").value("API設計書を書く"))
                    .andExpect(jsonPath("$.priority").value("MEDIUM"))
                    .andExpect(jsonPath("$.status").value("TODO"))
                    .andExpect(jsonPath("$.completedAt").value(nullValue()))
                    .andExpect(jsonPath("$.createdAt").value("2026-10-14T10:00:00+09:00"));
        }

        @Test
        void 期限時刻はHH_mm形式で返る() throws Exception {
            postTask("""
                    {"title":"t","dueDate":"2026-10-14","dueTime":"15:30"}
                    """)
                    .andExpect(jsonPath("$.dueDate").value("2026-10-14"))
                    .andExpect(jsonPath("$.dueTime").value("15:30"));
        }

        @Test
        void クライアントが送ったidは無視される() throws Exception {
            long first = createTask("""
                    {"title":"元のタスク"}
                    """);
            postTask("{\"id\":" + first + ",\"title\":\"乗っ取り\"}")
                    .andExpect(status().isCreated());

            mockMvc.perform(get("/api/tasks/{id}", first))
                    .andExpect(jsonPath("$.title").value("元のタスク"));
        }

        @Test
        void タイトルが空なら400() throws Exception {
            postTask("""
                    {"title":"   "}
                    """)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("title"));
        }

        @Test
        void 時刻だけの期限は400() throws Exception {
            postTask("""
                    {"title":"t","dueTime":"10:00"}
                    """)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("dueTime"));
        }

        @Test
        void 不正な列挙値は400() throws Exception {
            postTask("""
                    {"title":"t","priority":"URGENT"}
                    """)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        }
    }

    @Nested
    class ビュー判定 {

        @Test
        void 今日ビューには今日と期限切れが入り_明日以降と期限なしは入らない() throws Exception {
            createTask("""
                    {"title":"昨日","dueDate":"2026-10-13"}
                    """);
            createTask("""
                    {"title":"今日","dueDate":"2026-10-14"}
                    """);
            createTask("""
                    {"title":"明日","dueDate":"2026-10-15"}
                    """);
            createTask("""
                    {"title":"期限なし"}
                    """);

            mockMvc.perform(get("/api/tasks").param("view", "today"))
                    .andExpect(jsonPath("$.items[*].task.title", contains("昨日", "今日")));
            mockMvc.perform(get("/api/tasks").param("view", "upcoming"))
                    .andExpect(jsonPath("$.items[*].task.title", contains("明日")));
            mockMvc.perform(get("/api/tasks").param("view", "no-due"))
                    .andExpect(jsonPath("$.items[*].task.title", contains("期限なし")));
        }

        @Test
        void 時刻ありはその時刻を過ぎたら期限切れ() throws Exception {
            createTask("""
                    {"title":"9時59分","dueDate":"2026-10-14","dueTime":"09:59"}
                    """);
            createTask("""
                    {"title":"10時ちょうど","dueDate":"2026-10-14","dueTime":"10:00"}
                    """);

            // 現在は 10:00。10:00 期限はまだ期限切れではない
            mockMvc.perform(get("/api/tasks").param("view", "today"))
                    .andExpect(jsonPath("$.items[0].task.title").value("9時59分"))
                    .andExpect(jsonPath("$.items[0].viewOverdue").value(true))
                    .andExpect(jsonPath("$.items[1].task.title").value("10時ちょうど"))
                    .andExpect(jsonPath("$.items[1].viewOverdue").value(false));
        }

        @Test
        void 日付のみはその日が終わるまで期限切れにならない() throws Exception {
            createTask("""
                    {"title":"今日","dueDate":"2026-10-14"}
                    """);

            clock.set(TestClockConfig.NOW.withHour(23).withMinute(59));
            mockMvc.perform(get("/api/tasks").param("view", "today"))
                    .andExpect(jsonPath("$.items[0].viewOverdue").value(false));

            clock.set(TestClockConfig.NOW.plusDays(1).withHour(0).withMinute(0));
            mockMvc.perform(get("/api/tasks").param("view", "today"))
                    .andExpect(jsonPath("$.items[0].viewOverdue").value(true));
        }

        @Test
        void 並び順は期限日_時刻_優先度_作成日時の順() throws Exception {
            createTask("""
                    {"title":"日付のみ・高","dueDate":"2026-10-15","priority":"HIGH"}
                    """);
            createTask("""
                    {"title":"14時・低","dueDate":"2026-10-15","dueTime":"14:00","priority":"LOW"}
                    """);
            createTask("""
                    {"title":"9時・低","dueDate":"2026-10-15","dueTime":"09:00","priority":"LOW"}
                    """);
            createTask("""
                    {"title":"日付のみ・中","dueDate":"2026-10-15"}
                    """);
            createTask("""
                    {"title":"翌日","dueDate":"2026-10-16","dueTime":"08:00","priority":"HIGH"}
                    """);

            mockMvc.perform(get("/api/tasks").param("view", "upcoming"))
                    .andExpect(jsonPath("$.items[*].task.title",
                            contains("9時・低", "14時・低", "日付のみ・高", "日付のみ・中", "翌日")));
        }

        @Test
        void 期限なしビューは優先度順() throws Exception {
            createTask("""
                    {"title":"低","priority":"LOW"}
                    """);
            createTask("""
                    {"title":"高","priority":"HIGH"}
                    """);

            mockMvc.perform(get("/api/tasks").param("view", "no-due"))
                    .andExpect(jsonPath("$.items[*].task.title", contains("高", "低")));
        }

        @Test
        void 不正なviewは400() throws Exception {
            mockMvc.perform(get("/api/tasks").param("view", "someday"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void 件数はビューの件数と一致する() throws Exception {
            createTask("""
                    {"title":"昨日","dueDate":"2026-10-13"}
                    """);
            createTask("""
                    {"title":"今日","dueDate":"2026-10-14"}
                    """);
            createTask("""
                    {"title":"明日","dueDate":"2026-10-15"}
                    """);
            createTask("""
                    {"title":"期限なし"}
                    """);

            mockMvc.perform(get("/api/tasks/counts"))
                    .andExpect(jsonPath("$.today").value(2))
                    .andExpect(jsonPath("$.overdue").value(1))
                    .andExpect(jsonPath("$.upcoming").value(1))
                    .andExpect(jsonPath("$.noDue").value(1));
        }
    }

    @Nested
    class ステータス {

        @Test
        void 完了にすると完了日時が入り_完了済みビューに移る() throws Exception {
            long id = createTask("""
                    {"title":"t","dueDate":"2026-10-13"}
                    """);

            changeStatus(id, "DONE")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.changed[0].id").value(id))
                    .andExpect(jsonPath("$.changed[0].previousStatus").value("TODO"))
                    .andExpect(jsonPath("$.changed[0].status").value("DONE"));

            mockMvc.perform(get("/api/tasks").param("view", "today"))
                    .andExpect(jsonPath("$.items", empty()));
            mockMvc.perform(get("/api/tasks").param("view", "done"))
                    .andExpect(jsonPath("$.items[0].task.completedAt").value("2026-10-14T10:00:00+09:00"))
                    .andExpect(jsonPath("$.items[0].task.overdue").value(false));
        }

        @Test
        void 同じステータスへの変更は変化なしを返す() throws Exception {
            long id = createTask("""
                    {"title":"t"}
                    """);

            changeStatus(id, "TODO").andExpect(jsonPath("$.changed", empty()));
        }

        @Test
        void 元に戻すで完了前のステータスに戻り_完了日時が消える() throws Exception {
            long id = createTask("""
                    {"title":"t"}
                    """);
            changeStatus(id, "IN_PROGRESS");
            changeStatus(id, "DONE");

            mockMvc.perform(patch("/api/tasks/statuses").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"changes\":[{\"id\":" + id + ",\"status\":\"IN_PROGRESS\"}]}"))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/tasks/{id}", id))
                    .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                    .andExpect(jsonPath("$.completedAt").value(nullValue()));
        }

        @Test
        void 元に戻すで存在しないIDがあれば全体を404にする() throws Exception {
            long id = createTask("""
                    {"title":"t"}
                    """);
            changeStatus(id, "DONE");

            mockMvc.perform(patch("/api/tasks/statuses").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"changes\":[{\"id\":" + id + ",\"status\":\"TODO\"},{\"id\":99999,\"status\":\"TODO\"}]}"))
                    .andExpect(status().isNotFound());

            mockMvc.perform(get("/api/tasks/{id}", id)).andExpect(jsonPath("$.status").value("DONE"));
        }
    }

    @Nested
    class 完了済みビューのページング {

        @Test
        void 完了日時の新しい順にlimit件返し_続きの有無を返す() throws Exception {
            for (int i = 1; i <= 3; i++) {
                long id = createTask("{\"title\":\"完了" + i + "\"}");
                clock.set(TestClockConfig.NOW.plusMinutes(i));
                changeStatus(id, "DONE");
            }

            mockMvc.perform(get("/api/tasks").param("view", "done").param("limit", "2"))
                    .andExpect(jsonPath("$.items[*].task.title", contains("完了3", "完了2")))
                    .andExpect(jsonPath("$.hasMore").value(true));
            mockMvc.perform(get("/api/tasks").param("view", "done").param("offset", "2").param("limit", "2"))
                    .andExpect(jsonPath("$.items[*].task.title", contains("完了1")))
                    .andExpect(jsonPath("$.hasMore").value(false));
        }

        @Test
        void limitが上限を超えたら400() throws Exception {
            mockMvc.perform(get("/api/tasks").param("view", "done").param("limit", "101"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    class 更新と削除 {

        @Test
        void 全項目を更新できる() throws Exception {
            long id = createTask("""
                    {"title":"t","dueDate":"2026-10-14","dueTime":"10:00","memo":"m"}
                    """);
            clock.set(TestClockConfig.NOW.plusHours(1));

            mockMvc.perform(put("/api/tasks/{id}", id).contentType(MediaType.APPLICATION_JSON).content("""
                    {"title":"更新後","memo":"","dueDate":null,"dueTime":null,"priority":"HIGH","status":"IN_PROGRESS"}
                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("更新後"))
                    .andExpect(jsonPath("$.memo").value(nullValue()))
                    .andExpect(jsonPath("$.dueDate").value(nullValue()))
                    .andExpect(jsonPath("$.priority").value("HIGH"))
                    .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                    .andExpect(jsonPath("$.updatedAt").value("2026-10-14T11:00:00+09:00"));
        }

        @Test
        void 詳細には空のサブタスク一覧が含まれる() throws Exception {
            long id = createTask("""
                    {"title":"t"}
                    """);

            mockMvc.perform(get("/api/tasks/{id}", id))
                    .andExpect(jsonPath("$.subtasks", hasSize(0)));
        }

        @Test
        void 削除すると404になる() throws Exception {
            long id = createTask("""
                    {"title":"t"}
                    """);

            mockMvc.perform(delete("/api/tasks/{id}", id)).andExpect(status().isNoContent());
            mockMvc.perform(get("/api/tasks/{id}", id))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        }
    }
}
