package com.masatto.mytask.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;
import com.masatto.mytask.MutableClock;
import com.masatto.mytask.TestClockConfig;

/** 自動バックアップ（保存先はテスト用の target/test-backups） */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
class AutoBackupServiceTest {

    @Autowired
    AutoBackupService autoBackup;

    @Autowired
    MutableClock clock;

    @Autowired
    MockMvc mockMvc;

    @Value("${mytask.backup-dir}")
    String backupDir;

    private Path dir() {
        return Path.of(backupDir).toAbsolutePath().normalize();
    }

    @BeforeEach
    void cleanUp() throws IOException {
        clock.set(TestClockConfig.NOW);
        if (Files.isDirectory(dir())) {
            try (Stream<Path> files = Files.list(dir())) {
                for (Path f : files.toList()) {
                    Files.delete(f);
                }
            }
        }
    }

    private long fileCount() throws IOException {
        try (Stream<Path> files = Files.list(dir())) {
            return files.count();
        }
    }

    @Test
    void その日の分を1つだけ保存する() throws Exception {
        Path file = autoBackup.runIfNeeded().orElseThrow();

        assertThat(file.getFileName().toString()).isEqualTo("mytask-manager-auto-20261014.json");
        String json = Files.readString(file);
        assertThat((String) JsonPath.read(json, "$.format")).isEqualTo("mytask-manager-backup");

        // 同じ日にもう一度実行しても作らない
        assertThat(autoBackup.runIfNeeded()).isEmpty();
        assertThat(fileCount()).isEqualTo(1);
    }

    @Test
    void 古いものから消して直近14日分だけ残す() throws Exception {
        for (int day = 0; day < 20; day++) {
            clock.set(TestClockConfig.NOW.plusDays(day));
            autoBackup.runIfNeeded();
        }

        assertThat(fileCount()).isEqualTo(AutoBackupService.KEEP);
        assertThat(autoBackup.status().files().getFirst().name()).isEqualTo("mytask-manager-auto-20261102.json");
        assertThat(autoBackup.status().files().getLast().name()).isEqualTo("mytask-manager-auto-20261020.json");
    }

    @Test
    void 状態として保存先とファイルの一覧を返す() throws Exception {
        autoBackup.runIfNeeded();

        mockMvc.perform(get("/api/backup/auto"))
                .andExpect(jsonPath("$.directory").value(dir().toString()))
                .andExpect(jsonPath("$.keep").value(14))
                .andExpect(jsonPath("$.files[0].name").value("mytask-manager-auto-20261014.json"))
                .andExpect(jsonPath("$.files[0].createdAt").exists());
    }

    @Test
    void バックアップ用のファイル名に合わないファイルには触れない() throws Exception {
        Files.createDirectories(dir());
        Files.writeString(dir().resolve("自分で置いたメモ.txt"), "keep me");
        for (int day = 0; day < 16; day++) {
            clock.set(TestClockConfig.NOW.plusDays(day));
            autoBackup.runIfNeeded();
        }

        assertThat(dir().resolve("自分で置いたメモ.txt")).exists();
        assertThat(fileCount()).isEqualTo(AutoBackupService.KEEP + 1);
    }
}
