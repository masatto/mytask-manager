package com.masatto.mytask.plan;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
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

/** Phase 14：計画の取り込み（api-design 9章） */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Transactional
class PlanImportApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void resetClock() {
        clock.set(TestClockConfig.NOW);
    }

    private ResultActions importPlan(String json, boolean dryRun) throws Exception {
        return mockMvc.perform(post("/api/plan-import").param("dryRun", String.valueOf(dryRun))
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private long createArea() throws Exception {
        String body = mockMvc.perform(post("/api/areas").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Study\",\"color\":\"orange\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private static final String PLAN = """
            {"tasks":[
              {"title":"Step1: 準備","memo":"目安 2h","dueDate":"2026-10-15","dueTime":"10:00","priority":"HIGH",
               "subtasks":[{"title":"環境を作る","done":true},{"title":"型を書く"}]},
              {"title":"Step2: 実装","dueDate":"2026-10-16","subtasks":[{"title":"APIを書く"}]}
            ]}
            """;

    @Test
    void dryRunは登録せずに内容を返す() throws Exception {
        importPlan(PLAN, true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(2))
                .andExpect(jsonPath("$.skipped").value(0))
                .andExpect(jsonPath("$.tasks[0].action").value("CREATE"))
                .andExpect(jsonPath("$.tasks[0].id").value(nullValue()))
                .andExpect(jsonPath("$.tasks[0].dueTime").value("10:00"))
                .andExpect(jsonPath("$.tasks[0].priority").value("HIGH"))
                .andExpect(jsonPath("$.tasks[0].subtasks[*].title", contains("環境を作る", "型を書く")))
                .andExpect(jsonPath("$.tasks[0].subtasks[0].done").value(true));
        mockMvc.perform(get("/api/tasks/search").param("q", "Step"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void 親とサブタスクを登録しエリアと状態を反映する() throws Exception {
        long area = createArea();
        String body = importPlan(PLAN.replace("{\"tasks\"", "{\"areaId\":" + area + ",\"tasks\""), false)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(2))
                .andReturn().getResponse().getContentAsString();
        long first = ((Number) JsonPath.read(body, "$.tasks[0].id")).longValue();

        // 完了のサブタスクがあるので親は進行中。サブタスクも親と同じエリアに入る
        mockMvc.perform(get("/api/tasks/{id}", first))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.areaId").value(area))
                .andExpect(jsonPath("$.memo").value("目安 2h"))
                .andExpect(jsonPath("$.dueDate").value("2026-10-15"))
                .andExpect(jsonPath("$.subtasks[*].status", contains("DONE", "TODO")))
                .andExpect(jsonPath("$.subtasks[*].areaId", contains((int) area, (int) area)));
    }

    @Test
    void 完了の親はサブタスクもすべて完了にする() throws Exception {
        String body = importPlan("""
                {"tasks":[{"title":"終わった作業","done":true,"subtasks":[{"title":"a"},{"title":"b"}]}]}
                """, false).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(body, "$.tasks[0].id")).longValue();
        mockMvc.perform(get("/api/tasks/{id}", id))
                .andExpect(jsonPath("$.status").value("DONE"))
                .andExpect(jsonPath("$.subtasks[*].status", contains("DONE", "DONE")));
    }

    @Test
    void 同じタイトルの親タスクがあれば飛ばす() throws Exception {
        importPlan(PLAN, false).andExpect(status().isOk());
        importPlan(PLAN, true)
                .andExpect(jsonPath("$.created").value(0))
                .andExpect(jsonPath("$.skipped").value(2))
                .andExpect(jsonPath("$.tasks[*].action", contains("SKIP_DUPLICATE", "SKIP_DUPLICATE")));
        importPlan(PLAN, false).andExpect(jsonPath("$.created").value(0));
        mockMvc.perform(get("/api/tasks/search").param("q", "Step"))
                .andExpect(jsonPath("$.items", hasSize(2)));
    }

    @Test
    void 計画の中で同じタイトルが重なったら2件目を飛ばす() throws Exception {
        importPlan("""
                {"tasks":[{"title":"同じ"},{"title":" 同じ "}]}
                """, true)
                .andExpect(jsonPath("$.tasks[*].action", contains("CREATE", "SKIP_DUPLICATE")));
    }

    @Test
    void 誤りは項目ごとにまとめて返し何も登録しない() throws Exception {
        importPlan("""
                {"tasks":[
                  {"title":"正しい"},
                  {"title":"誤り","dueDate":"10/20","dueTime":"25:00","priority":"URGENT",
                   "subtasks":[{"title":""},{"title":"時刻だけ","dueTime":"09:00"}]}
                ]}
                """, false)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[*].field", containsInAnyOrder(
                        "tasks[1].subtasks[0].title")));
        // Bean Validation を通ったあとの解釈エラー
        importPlan("""
                {"tasks":[{"title":"誤り","dueDate":"10/20","dueTime":"25:00","priority":"URGENT",
                  "subtasks":[{"title":"時刻だけ","dueTime":"09:00"}]}]}
                """, false)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", containsInAnyOrder(
                        "tasks[0].dueDate", "tasks[0].dueTime", "tasks[0].priority",
                        "tasks[0].subtasks[0].dueTime")));
        mockMvc.perform(get("/api/tasks/search").param("q", "正しい"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void タスクが空やエリアが無いときは400() throws Exception {
        importPlan("{\"tasks\":[]}", true)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("tasks"));
        importPlan("{\"areaId\":9999,\"tasks\":[{\"title\":\"a\"}]}", true)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("areaId"));
    }
}
