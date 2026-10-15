package com.masatto.mytask.backup;

import java.time.format.DateTimeFormatter;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/backup")
@RequiredArgsConstructor
public class BackupController {

    private static final DateTimeFormatter FILE_TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");

    private final BackupService backupService;
    private final AutoBackupService autoBackupService;

    /** 自動バックアップの保存先と、保存済みのファイル */
    @GetMapping("/auto")
    public AutoBackupService.Status autoBackupStatus() {
        return autoBackupService.status();
    }

    @GetMapping
    public ResponseEntity<BackupDocument> export() {
        BackupDocument doc = backupService.export();
        String filename = "mytask-manager-" + doc.exportedAt().format(FILE_TIMESTAMP) + ".json";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .body(doc);
    }

    /**
     * ファイルの中身を文字列で受け取り、形式の誤りを JSON 一般の入力エラー（VALIDATION_ERROR）ではなく
     * INVALID_BACKUP として返す。dryRun=true なら検証と件数の確認だけを行う。
     */
    @PostMapping("/import")
    public ResponseEntity<?> importBackup(@RequestBody String json,
            @RequestParam(defaultValue = "false") boolean dryRun) {
        BackupService.ImportSummary summary = backupService.importJson(json, dryRun);
        return dryRun ? ResponseEntity.ok(summary) : ResponseEntity.noContent().build();
    }
}
