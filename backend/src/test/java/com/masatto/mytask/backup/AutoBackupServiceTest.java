package com.masatto.mytask.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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

    @Autowired
    JdbcTemplate jdbc;

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

        assertThat(file.getFileName().toString()).isEqualTo("orbit-auto-20261014.json");
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
        assertThat(autoBackup.status().files().getFirst().name()).isEqualTo("orbit-auto-20261102.json");
        assertThat(autoBackup.status().files().getLast().name()).isEqualTo("orbit-auto-20261020.json");
    }

    @Test
    void 状態として保存先とファイルの一覧を返す() throws Exception {
        autoBackup.runIfNeeded();

        mockMvc.perform(get("/api/backup/auto"))
                .andExpect(jsonPath("$.directory").value(dir().toString()))
                .andExpect(jsonPath("$.keep").value(14))
                .andExpect(jsonPath("$.files[0].name").value("orbit-auto-20261014.json"))
                .andExpect(jsonPath("$.files[0].createdAt").exists());
    }

    @Test
    void 名前を変える前の自動バックアップも件数に含めて古いものから消す() throws Exception {
        Files.createDirectories(dir());
        for (int day = 1; day <= 10; day++) {
            Files.writeString(dir().resolve("mytask-manager-auto-202610%02d.json".formatted(day)), "{}");
        }
        for (int day = 0; day < 8; day++) {
            clock.set(TestClockConfig.NOW.plusDays(day));
            autoBackup.runIfNeeded();
        }

        // 新しい名前の 10/14〜10/21 の8件と、旧名の 10/05〜10/10 の6件が残る
        assertThat(fileCount()).isEqualTo(AutoBackupService.KEEP);
        assertThat(autoBackup.status().files().getFirst().name()).isEqualTo("orbit-auto-20261021.json");
        assertThat(autoBackup.status().files().getLast().name()).isEqualTo("mytask-manager-auto-20261005.json");
    }

    @Test
    void 自動バックアップのファイルから復元できる() throws Exception {
        jdbc.update("DELETE FROM tasks");
        autoBackup.runIfNeeded(); // 空の状態を保存
        mockMvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON).content("""
                {"title":"バックアップ後に追加"}
                """));

        mockMvc.perform(post("/api/backup/auto/{name}/import", "orbit-auto-20261014.json").param("dryRun", "true").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.tasks").value(1))
                .andExpect(jsonPath("$.incoming.tasks").value(0));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM tasks", Integer.class)).isEqualTo(1);

        mockMvc.perform(post("/api/backup/auto/{name}/import", "orbit-auto-20261014.json").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM tasks", Integer.class)).isZero();
    }

    @Test
    void 自動バックアップ以外のファイルは復元に使えない() throws Exception {
        Files.createDirectories(dir());
        Files.writeString(dir().resolve("other.json"), "{}");
        for (String name : new String[] { "other.json", "..%2Fdata%2Fmytask.mv.db", "orbit-auto-20990101.json" }) {
            mockMvc.perform(post("/api/backup/auto/{name}/import", name).param("dryRun", "true").contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isNotFound());
        }
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
