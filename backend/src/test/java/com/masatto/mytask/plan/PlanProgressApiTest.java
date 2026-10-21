package com.masatto.mytask.plan;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
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
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;
import com.masatto.mytask.MutableClock;
import com.masatto.mytask.TestClockConfig;

/** Phase 16：計画の進み具合（api-design 11章）。基準日は 2026-10-14(水) */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Transactional
class PlanProgressApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void resetClock() {
        clock.set(TestClockConfig.NOW);
    }

    private long create(String json) throws Exception {
        String body = mockMvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private void done(long id) throws Exception {
        mockMvc.perform(patch("/api/tasks/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DONE\",\"completeSubtasks\":true}")).andExpect(status().isOk());
    }

    private long area(String name) throws Exception {
        String body = mockMvc.perform(post("/api/areas").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"color\":\"pink\"}")).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    @Test
    void タイトルの計画名でまとめ_番号順に並べて残りと必要なペースを出す() throws Exception {
        long step1 = create("""
                {"title":"韓国語学習 Step1: 教材","dueDate":"2026-10-10","estimateMinutes":180}
                """);
        done(step1);
        long step2 = create("""
                {"title":"韓国語学習 Step2: ハングル","dueDate":"2026-10-13","estimateMinutes":120}
                """);
        long sub = create("""
                {"title":"母音","parentId":%d,"estimateMinutes":60}
                """.formatted(step2));
        create("""
                {"title":"子音","parentId":%d,"estimateMinutes":90}
                """.formatted(step2));
        done(sub);
        long step10 = create("""
                {"title":"韓国語学習 Step10：仕上げ","dueDate":"2026-10-27","estimateMinutes":600}
                """);
        // 1ステップだけのもの・形の違うものは計画にしない
        create("""
                {"title":"expense-flow Step1: 準備","dueDate":"2026-10-20"}
                """);
        create("""
                {"title":"メモ: 雑多なこと"}
                """);

        mockMvc.perform(get("/api/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].name").value("韓国語学習"))
                .andExpect(jsonPath("$.items[0].state").value("BEHIND"))
                .andExpect(jsonPath("$.items[0].totalSteps").value(3))
                .andExpect(jsonPath("$.items[0].doneSteps").value(1))
                .andExpect(jsonPath("$.items[0].overdueSteps").value(1))
                // Step2 はサブタスクの目安（60+90）を使う。残りは未完了のサブタスクの 90
                .andExpect(jsonPath("$.items[0].steps[*].number", contains(1, 2, 10)))
                .andExpect(jsonPath("$.items[0].steps[1].estimateMinutes").value(150))
                .andExpect(jsonPath("$.items[0].steps[1].remainingMinutes").value(90))
                .andExpect(jsonPath("$.items[0].steps[1].subtasksDone").value(1))
                .andExpect(jsonPath("$.items[0].steps[1].subtasksTotal").value(2))
                .andExpect(jsonPath("$.items[0].steps[1].overdue").value(true))
                .andExpect(jsonPath("$.items[0].totalMinutes").value(930))
                .andExpect(jsonPath("$.items[0].remainingMinutes").value(690))
                .andExpect(jsonPath("$.items[0].finalDueDate").value("2026-10-27"))
                // 10/14〜10/27 の14日で 690 分 → 週 345 分
                .andExpect(jsonPath("$.items[0].daysLeft").value(14))
                .andExpect(jsonPath("$.items[0].weeklyMinutesNeeded").value(345))
                .andExpect(jsonPath("$.items[0].nextStepId").value(step2))
                .andExpect(jsonPath("$.items[0].steps[2].id").value(step10));
    }

    @Test
    void 期限切れがなければ順調_すべて完了なら完了で後ろに並ぶ() throws Exception {
        long a1 = create("""
                {"title":"A Step1: x","dueDate":"2026-10-01"}
                """);
        long a2 = create("""
                {"title":"A Step2: y","dueDate":"2026-10-05"}
                """);
        done(a1);
        done(a2);
        create("""
                {"title":"B Step1: x","dueDate":"2026-10-20"}
                """);
        create("""
                {"title":"B Step2: y","dueDate":"2026-10-30"}
                """);

        mockMvc.perform(get("/api/plans"))
                .andExpect(jsonPath("$.items[*].name", contains("B", "A")))
                .andExpect(jsonPath("$.items[0].state").value("ON_TRACK"))
                // 目安が1つもなければ合計も残りもペースも出さない
                .andExpect(jsonPath("$.items[0].totalMinutes").value(nullValue()))
                .andExpect(jsonPath("$.items[0].remainingMinutes").value(nullValue()))
                .andExpect(jsonPath("$.items[0].weeklyMinutesNeeded").value(nullValue()))
                .andExpect(jsonPath("$.items[1].state").value("DONE"))
                .andExpect(jsonPath("$.items[1].nextStepId").value(nullValue()));
    }

    @Test
    void エリアを指定するとそのエリアのステップだけで集計する() throws Exception {
        long learning = area("Learning");
        create("""
                {"title":"韓国語学習 Step1: a","areaId":%d}
                """.formatted(learning));
        create("""
                {"title":"韓国語学習 Step2: b","areaId":%d}
                """.formatted(learning));
        create("""
                {"title":"expense-flow Step1: a"}
                """);
        create("""
                {"title":"expense-flow Step2: b"}
                """);

        mockMvc.perform(get("/api/plans").param("area", String.valueOf(learning)))
                .andExpect(jsonPath("$.items[*].name", contains("韓国語学習")))
                .andExpect(jsonPath("$.items[0].areaId").value(learning));
        mockMvc.perform(get("/api/plans"))
                .andExpect(jsonPath("$.items", hasSize(2)));
    }
}
