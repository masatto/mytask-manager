package com.masatto.mytask.plan;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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

/** Phase 17：サブタスクの期限の割り振りと、サブタスクの遅れ（api-design 9.1・11.2）。基準日は 2026-10-14(水) */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Transactional
class SubtaskScheduleApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void resetClock() {
        clock.set(TestClockConfig.NOW);
    }

    private ResultActions importPlan(String json) throws Exception {
        return mockMvc.perform(post("/api/plan-import").param("dryRun", "false")
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions schedule(String name, boolean dryRun) throws Exception {
        return mockMvc.perform(post("/api/plans/schedule-subtasks").param("dryRun", String.valueOf(dryRun))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"" + name + "\"}"));
    }

    private long create(String json) throws Exception {
        String body = mockMvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    @Test
    void 取り込みでは期限のないサブタスクにステップの期間の中で期限を割り振る() throws Exception {
        String body = importPlan("""
                {"tasks":[
                  {"title":"読書 Step1: 前半","dueDate":"2026-10-17","subtasks":[
                    {"title":"1章","estimateMinutes":60},{"title":"2章","estimateMinutes":60,"done":true},
                    {"title":"3章","estimateMinutes":60},{"title":"4章","dueDate":"2026-10-20"}]},
                  {"title":"読書 Step2: 後半","dueDate":"2026-10-21","subtasks":[
                    {"title":"5章"},{"title":"6章"}]}
                ]}
                """)
                .andExpect(status().isOk())
                // Step1 は今日（10/14）〜10/17。完了と期限ありはそのまま
                .andExpect(jsonPath("$.tasks[0].subtasks[*].dueDate",
                        contains("2026-10-15", null, "2026-10-17", "2026-10-20")))
                .andExpect(jsonPath("$.tasks[0].subtasks[*].scheduled", contains(true, false, true, false)))
                // Step2 は前のステップの期限の翌日（10/18）〜10/21
                .andExpect(jsonPath("$.tasks[1].subtasks[*].dueDate", contains("2026-10-19", "2026-10-21")))
                .andReturn().getResponse().getContentAsString();
        long step2 = ((Number) JsonPath.read(body, "$.tasks[1].id")).longValue();
        mockMvc.perform(get("/api/tasks/{id}", step2))
                .andExpect(jsonPath("$.subtasks[*].dueDate", contains("2026-10-19", "2026-10-21")));
    }

    @Test
    void 取り込みで割り振らない指定もできる() throws Exception {
        importPlan("""
                {"scheduleSubtasks":false,"tasks":[{"title":"読書 Step1: 前半","dueDate":"2026-10-17",
                  "subtasks":[{"title":"1章"}]}]}
                """)
                .andExpect(jsonPath("$.tasks[0].subtasks[0].dueDate").value(nullValue()))
                .andExpect(jsonPath("$.tasks[0].subtasks[0].scheduled").value(false));
    }

    @Test
    void 今ある計画のサブタスクに期限を割り振り_遅れたサブタスクで計画を遅れにする() throws Exception {
        long step1 = create("""
                {"title":"韓国語学習 Step1: 教材","dueDate":"2026-10-15"}
                """);
        create("{\"title\":\"教材を選ぶ\",\"parentId\":%d,\"estimateMinutes\":30}".formatted(step1));
        long step2 = create("""
                {"title":"韓国語学習 Step2: ハングル","dueDate":"2026-10-19"}
                """);
        create("{\"title\":\"母音\",\"parentId\":%d,\"estimateMinutes\":60}".formatted(step2));
        create("{\"title\":\"子音\",\"parentId\":%d,\"estimateMinutes\":60}".formatted(step2));
        mockMvc.perform(get("/api/plans"))
                .andExpect(jsonPath("$.items[0].unscheduledSubtasks").value(3));

        // dryRun では変えない
        schedule("韓国語学習", true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(3))
                .andExpect(jsonPath("$.subtasks[*].dueDate", contains("2026-10-15", "2026-10-17", "2026-10-19")));
        mockMvc.perform(get("/api/plans")).andExpect(jsonPath("$.items[0].unscheduledSubtasks").value(3));

        schedule("韓国語学習", false).andExpect(jsonPath("$.count").value(3));
        mockMvc.perform(get("/api/tasks/{id}", step2))
                .andExpect(jsonPath("$.subtasks[*].dueDate", contains("2026-10-17", "2026-10-19")));
        mockMvc.perform(get("/api/plans"))
                .andExpect(jsonPath("$.items[0].unscheduledSubtasks").value(0))
                .andExpect(jsonPath("$.items[0].state").value("ON_TRACK"));
        // 2回目は割り振るものがない
        schedule("韓国語学習", false).andExpect(jsonPath("$.count").value(0));

        // 10/18：Step2 の期限（10/19）前だが、「母音」（10/17）が遅れている → 計画は遅れ
        clock.set(TestClockConfig.NOW.plusSeconds(4 * 86_400));
        mockMvc.perform(patch("/api/tasks/{id}/status", step1).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DONE\",\"completeSubtasks\":true}")).andExpect(status().isOk());
        mockMvc.perform(get("/api/plans"))
                .andExpect(jsonPath("$.items[0].state").value("BEHIND"))
                .andExpect(jsonPath("$.items[0].overdueSteps").value(1))
                .andExpect(jsonPath("$.items[0].steps[1].overdue").value(true))
                .andExpect(jsonPath("$.items[0].steps[1].overdueSubtasks").value(1));
    }

    @Test
    void 前のステップが完了していれば次のステップは今日から割り振る() throws Exception {
        long step1 = create("""
                {"title":"読書 Step1: 前半","dueDate":"2026-10-17"}
                """);
        mockMvc.perform(patch("/api/tasks/{id}/status", step1).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DONE\"}")).andExpect(status().isOk());
        long step2 = create("""
                {"title":"読書 Step2: 後半","dueDate":"2026-10-17"}
                """);
        create("{\"title\":\"5章\",\"parentId\":%d}".formatted(step2));
        create("{\"title\":\"6章\",\"parentId\":%d}".formatted(step2));
        // 前のステップ（期限 10/17）は完了済みなので、今日（10/14）〜10/17 に割り振る
        schedule("読書", true).andExpect(jsonPath("$.subtasks[*].dueDate", contains("2026-10-15", "2026-10-17")));
    }

    @Test
    void 無い計画は404() throws Exception {
        schedule("ない計画", true).andExpect(status().isNotFound());
    }
}
