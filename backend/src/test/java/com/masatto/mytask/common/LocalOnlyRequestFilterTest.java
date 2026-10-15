package com.masatto.mytask.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** 別のサイトからの操作・DNS リバインディングを拒否する（LocalOnlyRequestFilter） */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LocalOnlyRequestFilterTest {

    @Autowired
    MockMvc mockMvc;

    private static MockHttpServletRequestBuilder createTask() {
        return post("/api/tasks").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"t\"}");
    }

    @Test
    void Orbit自身の画面からの操作は通す() throws Exception {
        mockMvc.perform(createTask().header("Host", "127.0.0.1:8080")
                .header("Origin", "http://127.0.0.1:8080").header("Sec-Fetch-Site", "same-origin"))
                .andExpect(status().isCreated());
        // 開発用（Vite 経由、localhost で開いた場合）
        mockMvc.perform(createTask().header("Host", "localhost:5173").header("Origin", "http://localhost:5173"))
                .andExpect(status().isCreated());
    }

    @Test
    void ブラウザ以外からのリクエスト_送信元の情報なし_は通す() throws Exception {
        mockMvc.perform(createTask()).andExpect(status().isCreated());
    }

    @Test
    void 別のサイトからの更新は拒否する() throws Exception {
        mockMvc.perform(createTask().header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mockMvc.perform(createTask().header("Sec-Fetch-Site", "cross-site"))
                .andExpect(status().isForbidden());
        mockMvc.perform(createTask().header("Sec-Fetch-Site", "same-site"))
                .andExpect(status().isForbidden());
    }

    @Test
    void JSON以外のPOSTは拒否する_単純なリクエストでの全データ置き換えを防ぐ() throws Exception {
        mockMvc.perform(post("/api/backup/import").contentType(MediaType.TEXT_PLAIN)
                .content("{\"format\":\"mytask-manager-backup\",\"version\":1,\"tasks\":[],\"rules\":[]}"))
                .andExpect(status().isUnsupportedMediaType());
        mockMvc.perform(post("/api/backup/auto/{name}/import", "orbit-auto-20261014.json"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void この_PC_以外を指す宛先は読み取りも拒否する() throws Exception {
        mockMvc.perform(get("/api/backup").header("Host", "attacker.example:8080"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/today").header("Host", "attacker.example"))
                .andExpect(status().isForbidden());
    }

    @Test
    void 宛先の判定() {
        assertThat(LocalOnlyRequestFilter.isLocalHost("127.0.0.1:8080")).isTrue();
        assertThat(LocalOnlyRequestFilter.isLocalHost("LOCALHOST")).isTrue();
        assertThat(LocalOnlyRequestFilter.isLocalHost("[::1]:8080")).isTrue();
        assertThat(LocalOnlyRequestFilter.isLocalHost("127.0.0.1.evil.example")).isFalse();
        assertThat(LocalOnlyRequestFilter.isLocalHost("localhost.evil.example:8080")).isFalse();
        assertThat(LocalOnlyRequestFilter.isLocalHost("")).isFalse();
        assertThat(LocalOnlyRequestFilter.isLocalHost(null)).isFalse();
    }
}
