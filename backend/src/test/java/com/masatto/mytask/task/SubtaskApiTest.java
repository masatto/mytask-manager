package com.masatto.mytask.task;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
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

/** Phase 2：サブタスク（api-design 3.2〜3.9 のサブタスク関連） */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Transactional
class SubtaskApiTest {

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

    private long createSubtask(long parentId, String fields) throws Exception {
        return createTask("{\"parentId\":" + parentId + (fields.isEmpty() ? "" : "," + fields) + "}");
    }

    private ResultActions changeStatus(long id, String json) throws Exception {
        return mockMvc.perform(patch("/api/tasks/{id}/status", id).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions list(String view) throws Exception {
        return mockMvc.perform(get("/api/tasks").param("view", view));
    }

    @Nested
    class 作成 {

        @Test
        void 親を指定するとサブタスクになる() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            postTask("{\"title\":\"子\",\"parentId\":" + parent + "}")
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.parentId").value(parent));
        }

        @Test
        void サブタスクの下にサブタスクは作れない() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            long child = createSubtask(parent, "\"title\":\"子\"");

            postTask("{\"title\":\"孫\",\"parentId\":" + child + "}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("NESTED_SUBTASK"));
        }

        @Test
        void 存在しない親は400() throws Exception {
            postTask("""
                    {"title":"子","parentId":99999}
                    """)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("parentId"));
        }

        @Test
        void 完了済みの親にサブタスクを追加すると親は進行中に戻る() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            changeStatus(parent, "{\"status\":\"DONE\"}");

            createSubtask(parent, "\"title\":\"追加\"");

            mockMvc.perform(get("/api/tasks/{id}", parent))
                    .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                    .andExpect(jsonPath("$.completedAt").doesNotExist());
        }
    }

    @Nested
    class 詳細 {

        @Test
        void 親の詳細にはサブタスクが作成順に入る() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            createSubtask(parent, "\"title\":\"1つ目\"");
            createSubtask(parent, "\"title\":\"2つ目\"");

            mockMvc.perform(get("/api/tasks/{id}", parent))
                    .andExpect(jsonPath("$.subtasks[*].title", contains("1つ目", "2つ目")))
                    .andExpect(jsonPath("$.parent").doesNotExist());
        }

        @Test
        void サブタスクの詳細には親の概要が入り_サブタスク欄はない() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            long child = createSubtask(parent, "\"title\":\"子\"");

            mockMvc.perform(get("/api/tasks/{id}", child))
                    .andExpect(jsonPath("$.parent.id").value(parent))
                    .andExpect(jsonPath("$.parent.title").value("親"))
                    .andExpect(jsonPath("$.subtasks").doesNotExist());
        }
    }

    @Nested
    class 一覧 {

        @Test
        void 親が条件を満たすとサブタスクはすべて表示される() throws Exception {
            long parent = createTask("""
                    {"title":"設計レビューの指摘対応","dueDate":"2026-10-13"}
                    """);
            long done = createSubtask(parent, "\"title\":\"指摘1\"");
            createSubtask(parent, "\"title\":\"指摘2\",\"dueDate\":\"2026-10-20\"");
            createSubtask(parent, "\"title\":\"指摘3\"");
            changeStatus(done, "{\"status\":\"DONE\"}");

            list("today")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].task.title").value("設計レビューの指摘対応"))
                    .andExpect(jsonPath("$.items[0].contextOnly").value(false))
                    .andExpect(jsonPath("$.items[0].subtasks[*].title", contains("指摘1", "指摘2", "指摘3")))
                    .andExpect(jsonPath("$.items[0].progress.done").value(1))
                    .andExpect(jsonPath("$.items[0].progress.total").value(3))
                    .andExpect(jsonPath("$.items[0].viewOverdue").value(true));
        }

        @Test
        void サブタスクだけが条件を満たすと親はコンテキスト表示になり_該当サブタスクだけが出る() throws Exception {
            long parent = createTask("""
                    {"title":"引っ越し準備","dueDate":"2026-10-30"}
                    """);
            createSubtask(parent, "\"title\":\"不用品の回収予約\",\"dueDate\":\"2026-10-14\",\"dueTime\":\"18:00\"");
            createSubtask(parent, "\"title\":\"段ボール手配\",\"dueDate\":\"2026-10-25\"");

            list("today")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].task.title").value("引っ越し準備"))
                    .andExpect(jsonPath("$.items[0].contextOnly").value(true))
                    .andExpect(jsonPath("$.items[0].subtasks[*].title", contains("不用品の回収予約")))
                    .andExpect(jsonPath("$.items[0].progress.total").value(2))
                    // グループ分けの日付は、条件を満たしたタスク（サブタスク）の期限
                    .andExpect(jsonPath("$.items[0].viewDate").value("2026-10-14"))
                    .andExpect(jsonPath("$.items[0].viewTime").value("18:00"));

            // 同じ親が今後ビューにも出る（親自身と、段ボール手配が条件を満たす）
            list("upcoming")
                    .andExpect(jsonPath("$.items[0].contextOnly").value(false))
                    .andExpect(jsonPath("$.items[0].viewDate").value("2026-10-25"));
        }

        @Test
        void 並び順は条件を満たしたタスクの最も早い期限で決まる() throws Exception {
            createTask("""
                    {"title":"単独・15日","dueDate":"2026-10-15"}
                    """);
            long parent = createTask("""
                    {"title":"親・期限なし"}
                    """);
            createSubtask(parent, "\"title\":\"子・16日\",\"dueDate\":\"2026-10-16\"");
            createSubtask(parent, "\"title\":\"子・明日の朝\",\"dueDate\":\"2026-10-15\",\"dueTime\":\"08:00\"");

            list("upcoming")
                    .andExpect(jsonPath("$.items[*].task.title", contains("親・期限なし", "単独・15日")))
                    .andExpect(jsonPath("$.items[0].subtasks[*].title", contains("子・16日", "子・明日の朝")));
        }

        @Test
        void 期限のないサブタスクは親の期限に従い_期限なしビューに親を引き込まない() throws Exception {
            long parent = createTask("""
                    {"title":"週次の振り返り","dueDate":"2026-10-14"}
                    """);
            createSubtask(parent, "\"title\":\"アウトプット確認\"");

            list("no-due").andExpect(jsonPath("$.items", hasSize(0)));
            list("today")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].viewDate").value("2026-10-14"));
            mockMvc.perform(get("/api/tasks/counts")).andExpect(jsonPath("$.noDue").value(0));
        }

        @Test
        void 親も期限なしならサブタスクは期限なしビューに出る() throws Exception {
            long parent = createTask("""
                    {"title":"本棚の整理"}
                    """);
            createSubtask(parent, "\"title\":\"古本を売る\"");

            list("no-due")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].contextOnly").value(false));
        }

        @Test
        void 件数は行の数と一致する() throws Exception {
            long parent = createTask("""
                    {"title":"親","dueDate":"2026-10-14"}
                    """);
            createSubtask(parent, "\"title\":\"子1\",\"dueDate\":\"2026-10-13\"");
            createSubtask(parent, "\"title\":\"子2\",\"dueDate\":\"2026-10-14\"");

            mockMvc.perform(get("/api/tasks/counts"))
                    .andExpect(jsonPath("$.today").value(1))
                    .andExpect(jsonPath("$.overdue").value(1))
                    .andExpect(jsonPath("$.noDue").value(0));
        }

        @Test
        void 完了済みビューは親が未完了なら完了したサブタスクだけをコンテキスト付きで出す() throws Exception {
            long parent = createTask("""
                    {"title":"見積もり提出"}
                    """);
            long sub = createSubtask(parent, "\"title\":\"単価確認\"");
            createSubtask(parent, "\"title\":\"上長承認\"");
            changeStatus(sub, "{\"status\":\"DONE\"}");

            list("done")
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].contextOnly").value(true))
                    .andExpect(jsonPath("$.items[0].subtasks[*].title", contains("単価確認")))
                    .andExpect(jsonPath("$.items[0].viewDate").value("2026-10-14"));
        }

        @Test
        void 完了済みビューのページングは行単位で数える() throws Exception {
            for (int i = 1; i <= 3; i++) {
                long parent = createTask("{\"title\":\"親" + i + "\"}");
                createSubtask(parent, "\"title\":\"子" + i + "\"");
                clock.set(TestClockConfig.NOW.plusMinutes(i));
                changeStatus(parent, "{\"status\":\"DONE\",\"completeSubtasks\":true}");
            }

            list("done").andExpect(jsonPath("$.items", hasSize(3)));
            mockMvc.perform(get("/api/tasks").param("view", "done").param("limit", "2"))
                    .andExpect(jsonPath("$.items[*].task.title", contains("親3", "親2")))
                    .andExpect(jsonPath("$.hasMore").value(true));
        }
    }

    @Nested
    class ステータスの連動 {

        @Test
        void 未完了のサブタスクが残る親を完了にすると409で件数を返す() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            createSubtask(parent, "\"title\":\"子1\"");
            createSubtask(parent, "\"title\":\"子2\"");

            changeStatus(parent, "{\"status\":\"DONE\"}")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("SUBTASKS_INCOMPLETE"))
                    .andExpect(jsonPath("$.incompleteCount").value(2));

            mockMvc.perform(get("/api/tasks/{id}", parent)).andExpect(jsonPath("$.status").value("TODO"));
        }

        @Test
        void 一括完了を指定すると未完了のサブタスクも完了になり_変化したものをすべて返す() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            long done = createSubtask(parent, "\"title\":\"完了済み\"");
            long open = createSubtask(parent, "\"title\":\"未完了\"");
            changeStatus(done, "{\"status\":\"DONE\"}");
            changeStatus(open, "{\"status\":\"IN_PROGRESS\"}");

            changeStatus(parent, "{\"status\":\"DONE\",\"completeSubtasks\":true}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.changed", hasSize(2)))
                    .andExpect(jsonPath("$.changed[*].id", containsInAnyOrder((int) parent, (int) open)))
                    .andExpect(jsonPath("$.changed[?(@.id == " + open + ")].previousStatus").value("IN_PROGRESS"));
        }

        @Test
        void 一括完了を元に戻すと親もサブタスクも元のステータスに戻る() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            long sub = createSubtask(parent, "\"title\":\"子\"");
            changeStatus(parent, "{\"status\":\"DONE\",\"completeSubtasks\":true}");

            mockMvc.perform(patch("/api/tasks/statuses").contentType(MediaType.APPLICATION_JSON).content(
                    "{\"changes\":[{\"id\":" + parent + ",\"status\":\"TODO\"},{\"id\":" + sub + ",\"status\":\"TODO\"}]}"))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/tasks/{id}", parent))
                    .andExpect(jsonPath("$.status").value("TODO"))
                    .andExpect(jsonPath("$.subtasks[0].status").value("TODO"));
        }

        @Test
        void 完了済みの親の下でサブタスクを未完了に戻すと親は進行中に戻る() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            long sub = createSubtask(parent, "\"title\":\"子\"");
            changeStatus(parent, "{\"status\":\"DONE\",\"completeSubtasks\":true}");

            changeStatus(sub, "{\"status\":\"TODO\"}")
                    .andExpect(jsonPath("$.changed[*].id", contains((int) sub, (int) parent)))
                    .andExpect(jsonPath("$.changed[1].status").value("IN_PROGRESS"));
        }

        @Test
        void サブタスクをすべて完了にしても親は自動では完了にならない() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            long sub = createSubtask(parent, "\"title\":\"子\"");

            changeStatus(sub, "{\"status\":\"DONE\"}").andExpect(jsonPath("$.changed", hasSize(1)));
            mockMvc.perform(get("/api/tasks/{id}", parent)).andExpect(jsonPath("$.status").value("TODO"));
        }

        @Test
        void PUTで未完了のサブタスクが残る親を完了にすると409() throws Exception {
            long parent = createTask("""
                    {"title":"親"}
                    """);
            createSubtask(parent, "\"title\":\"子\"");

            mockMvc.perform(put("/api/tasks/{id}", parent).contentType(MediaType.APPLICATION_JSON).content("""
                    {"title":"親（更新）","priority":"MEDIUM","status":"DONE"}
                    """))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.incompleteCount").value(1));

            mockMvc.perform(get("/api/tasks/{id}", parent)).andExpect(jsonPath("$.title").value("親"));
        }
    }

    @Test
    void 今日完了にした親タスクの数を返す_サブタスクと昨日の完了は数えない() throws Exception {
        long yesterday = createTask("""
                {"title":"昨日完了"}
                """);
        clock.set(TestClockConfig.NOW.minusDays(1));
        changeStatus(yesterday, "{\"status\":\"DONE\"}");
        clock.set(TestClockConfig.NOW);
        long parent = createTask("""
                {"title":"今日完了（サブタスクつき）"}
                """);
        createSubtask(parent, "\"title\":\"子\"");
        changeStatus(parent, "{\"status\":\"DONE\",\"completeSubtasks\":true}");
        long other = createTask("""
                {"title":"今日完了"}
                """);
        changeStatus(other, "{\"status\":\"DONE\"}");

        mockMvc.perform(get("/api/tasks/counts")).andExpect(jsonPath("$.doneToday").value(2));
    }

    @Test
    void 親を削除するとサブタスクも削除される() throws Exception {
        long parent = createTask("""
                {"title":"親"}
                """);
        long sub = createSubtask(parent, "\"title\":\"子\"");

        mockMvc.perform(delete("/api/tasks/{id}", parent)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tasks/{id}", sub)).andExpect(status().isNotFound());
    }
}
