package com.masatto.mytask.common;

import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SystemControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void バージョンとビルド日時と保存先を返す() throws Exception {
        mockMvc.perform(get("/api/system"))
                .andExpect(jsonPath("$.version").value("1.0.0"))
                // 再現可能ビルド用の固定日時（1980年）ではなく、実際のビルド日時
                .andExpect(jsonPath("$.buildTime", matchesPattern("20[2-9][0-9]-.*[+]09:00")))
                .andExpect(jsonPath("$.dataDirectory", endsWith("test-data")))
                .andExpect(jsonPath("$.backupDirectory", endsWith("test-backups")));
    }
}
