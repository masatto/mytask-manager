package com.masatto.mytask.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SpaControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void 画面のURLはindex_htmlに転送する() throws Exception {
        for (String path : new String[] { "/", "/today", "/no-due", "/rules", "/settings", "/search" }) {
            mockMvc.perform(get(path).param("rule", "1")).andExpect(forwardedUrl("/index.html"));
        }
    }

    @Test
    void APIやファイルは転送しない() throws Exception {
        mockMvc.perform(get("/api/health")).andExpect(jsonPath("$.status").value("ok"));
        mockMvc.perform(get("/api/no-such-path")).andExpect(status().isNotFound());
        mockMvc.perform(get("/assets/index.js")).andExpect(forwardedUrl(null));
        mockMvc.perform(get("/favicon.svg")).andExpect(forwardedUrl(null));
    }
}
