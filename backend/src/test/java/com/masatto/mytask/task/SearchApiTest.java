package com.masatto.mytask.task;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
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

/** 検索（GET /api/tasks/search） */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Transactional
class SearchApiTest {

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

    private void complete(long id) throws Exception {
        mockMvc.perform(patch("/api/tasks/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DONE\",\"completeSubtasks\":true}"));
    }

    private ResultActions search(String q) throws Exception {
        return mockMvc.perform(get("/api/tasks/search").param("q", q));
    }

    @Test
    void タイトルとメモを大文字小文字を区別せずに探す() throws Exception {
        create("""
                {"title":"API設計書を書く"}
                """);
        create("""
                {"title":"レビュー","memo":"api の命名を確認"}
                """);
        create("""
                {"title":"買い物"}
                """);

        search("Api").andExpect(jsonPath("$.items[*].task.title", contains("API設計書を書く", "レビュー")));
    }

    @Test
    void 未完了を先に_完了済みを後に並べる() throws Exception {
        long done = create("""
                {"title":"見積もり（済）"}
                """);
        complete(done);
        create("""
                {"title":"見積もり（再提出）","dueDate":"2026-10-20"}
                """);
        create("""
                {"title":"見積もり（下書き）","dueDate":"2026-10-15"}
                """);

        search("見積もり").andExpect(jsonPath("$.items[*].task.title",
                contains("見積もり（下書き）", "見積もり（再提出）", "見積もり（済）")));
    }

    @Test
    void サブタスクが一致したら親をコンテキストとして出す() throws Exception {
        long parent = create("""
                {"title":"引っ越し準備"}
                """);
        create("{\"title\":\"不用品の回収予約\",\"parentId\":" + parent + "}");
        create("{\"title\":\"段ボール手配\",\"parentId\":" + parent + "}");

        search("回収")
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].task.title").value("引っ越し準備"))
                .andExpect(jsonPath("$.items[0].contextOnly").value(true))
                .andExpect(jsonPath("$.items[0].subtasks[*].title", contains("不用品の回収予約")));
    }

    @Test
    void 同じ親の未完了と完了済みが一致しても行は1つ() throws Exception {
        long parent = create("""
                {"title":"週次レポート"}
                """);
        long sub = create("{\"title\":\"週次レポートの下書き\",\"parentId\":" + parent + "}");
        complete(sub);

        search("週次レポート").andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void LIKEの特殊文字はそのままの文字として探す() throws Exception {
        create("""
                {"title":"進捗100%"}
                """);
        create("""
                {"title":"進捗1000"}
                """);
        create("""
                {"title":"file_name"}
                """);
        create("""
                {"title":"filexname"}
                """);

        search("100%").andExpect(jsonPath("$.items[*].task.title", contains("進捗100%")));
        search("file_").andExpect(jsonPath("$.items[*].task.title", contains("file_name")));
    }

    @Test
    void 一致しなければ空() throws Exception {
        search("存在しない語").andExpect(jsonPath("$.items", empty()));
    }

    @Test
    void 空の検索語は400() throws Exception {
        search("   ").andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors[0].field").value("q"));
    }
}
