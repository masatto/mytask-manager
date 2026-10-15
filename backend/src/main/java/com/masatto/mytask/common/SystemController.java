package com.masatto.mytask.common;

import java.nio.file.Path;
import java.time.Clock;
import java.time.OffsetDateTime;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 設定画面の「このアプリについて」。動いているアプリのバージョン・ビルド日時と、データの保存先を返す。
 * 古いアプリが動いたままになっていないかを確かめられるようにする。
 */
@RestController
public class SystemController {

    private final ObjectProvider<BuildProperties> buildProperties;
    private final Clock clock;
    private final String dataDir;
    private final String backupDir;

    public SystemController(ObjectProvider<BuildProperties> buildProperties, Clock clock,
            @Value("${mytask.data-dir}") String dataDir, @Value("${mytask.backup-dir}") String backupDir) {
        this.buildProperties = buildProperties;
        this.clock = clock;
        this.dataDir = dataDir;
        this.backupDir = backupDir;
    }

    public record SystemInfo(String version, OffsetDateTime buildTime, String dataDirectory, String backupDirectory) {
    }

    @GetMapping("/api/system")
    public SystemInfo info() {
        BuildProperties build = buildProperties.getIfAvailable();
        return new SystemInfo(
                build != null ? build.getVersion() : "unknown",
                build != null && build.getTime() != null ? build.getTime().atZone(clock.getZone()).toOffsetDateTime()
                        : null,
                Path.of(dataDir).toAbsolutePath().normalize().toString(),
                Path.of(backupDir).toAbsolutePath().normalize().toString());
    }
}
