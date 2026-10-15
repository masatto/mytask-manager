package com.masatto.mytask.backup;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;
import tools.jackson.databind.json.JsonMapper;

/**
 * 自動バックアップ。1日1回（起動時と毎日0:05）、エクスポートと同じ JSON をバックアップ用フォルダーに保存し、
 * 新しいものから KEEP 日分だけ残す。手動のエクスポートを忘れても、DB ファイルの破損などから復元できるようにする。
 */
@Slf4j
@Service
public class AutoBackupService {

    static final int KEEP = 14;
    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final Pattern FILE_NAME = Pattern.compile("mytask-manager-auto-\\d{8}\\.json");

    private final BackupService backupService;
    private final JsonMapper jsonMapper;
    private final Clock clock;
    private final Path directory;

    public AutoBackupService(BackupService backupService, JsonMapper jsonMapper, Clock clock,
            @Value("${mytask.backup-dir}") String directory) {
        this.backupService = backupService;
        this.jsonMapper = jsonMapper;
        this.clock = clock;
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    public record BackupFile(String name, long size, OffsetDateTime createdAt) {
    }

    public record Status(String directory, int keep, List<BackupFile> files) {
    }

    @Scheduled(cron = "0 5 0 * * *", zone = "${mytask.zone}")
    public void daily() {
        runIfNeeded();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        runIfNeeded();
    }

    /** 今日の分がまだなければ保存する。失敗してもアプリは止めない（ログに残す） */
    public synchronized Optional<Path> runIfNeeded() {
        Path file = directory.resolve("mytask-manager-auto-" + LocalDate.now(clock).format(FILE_DATE) + ".json");
        if (Files.exists(file)) {
            return Optional.empty();
        }
        try {
            Files.createDirectories(directory);
            // 書きかけのファイルが残らないよう、一時ファイルに書いてから置き換える
            Path temp = Files.createTempFile(directory, "mytask-manager-auto-", ".tmp");
            try {
                jsonMapper.writeValue(temp.toFile(), backupService.export());
                Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } finally {
                Files.deleteIfExists(temp);
            }
            prune();
            log.info("Auto backup saved: {}", file);
            return Optional.of(file);
        } catch (IOException | RuntimeException e) {
            log.error("Auto backup failed: {}", file, e);
            return Optional.empty();
        }
    }

    public Status status() {
        return new Status(directory.toString(), KEEP, listFiles().stream().map(this::toBackupFile).toList());
    }

    /** 古いものから削除して KEEP 件にする */
    private void prune() throws IOException {
        List<Path> files = listFiles();
        for (Path old : files.subList(Math.min(KEEP, files.size()), files.size())) {
            Files.deleteIfExists(old);
        }
    }

    /** 自動バックアップのファイルを新しい順に（ファイル名の日付で並べる） */
    private List<Path> listFiles() {
        if (!Files.isDirectory(directory)) {
            return List.of();
        }
        try (Stream<Path> stream = Files.list(directory)) {
            return stream
                    .filter(p -> FILE_NAME.matcher(p.getFileName().toString()).matches())
                    .sorted(Comparator.comparing((Path p) -> p.getFileName().toString()).reversed())
                    .toList();
        } catch (IOException e) {
            log.warn("Cannot list auto backups in {}", directory, e);
            return List.of();
        }
    }

    private BackupFile toBackupFile(Path file) {
        try {
            Instant modified = Files.getLastModifiedTime(file).toInstant();
            return new BackupFile(file.getFileName().toString(), Files.size(file),
                    modified.atZone(clock.getZone()).toOffsetDateTime());
        } catch (IOException e) {
            return new BackupFile(file.getFileName().toString(), -1, null);
        }
    }
}
