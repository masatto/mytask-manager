package com.masatto.mytask.backup;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * 画面から変えるバックアップの設定を、JSON ファイル（mytask.settings-file）に保存する。
 * DB の外に置くのは、DB を復元（インポート）しても設定が巻き戻らないようにするため。
 */
@Slf4j
@Component
public class BackupSettingsStore {

    /** @param mirrorDirectory 自動バックアップのコピー先（OneDrive などの同期フォルダー）。null なら使わない */
    public record BackupSettings(String mirrorDirectory) {
    }

    private final JsonMapper jsonMapper;
    private final Path file;
    private BackupSettings cached;

    public BackupSettingsStore(JsonMapper jsonMapper, @Value("${mytask.settings-file}") String file) {
        this.jsonMapper = jsonMapper;
        this.file = Path.of(file).toAbsolutePath().normalize();
    }

    public synchronized BackupSettings get() {
        if (cached == null) {
            cached = load();
        }
        return cached;
    }

    public synchronized void save(BackupSettings settings) throws IOException {
        Files.createDirectories(file.getParent());
        Path temp = Files.createTempFile(file.getParent(), "settings-", ".tmp");
        try {
            jsonMapper.writeValue(temp.toFile(), settings);
            Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temp);
        }
        cached = settings;
    }

    private BackupSettings load() {
        if (!Files.isRegularFile(file)) {
            return new BackupSettings(null);
        }
        try {
            return jsonMapper.readValue(file.toFile(), BackupSettings.class);
        } catch (JacksonException e) {
            log.warn("Cannot read settings file {}; using defaults", file, e);
            return new BackupSettings(null);
        }
    }
}
