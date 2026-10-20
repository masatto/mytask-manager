package com.masatto.mytask.plan;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.masatto.mytask.plan.dto.PlanImportRequest;
import com.masatto.mytask.plan.dto.PlanImportResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/plan-import")
@RequiredArgsConstructor
public class PlanImportController {

    private final PlanImportService planImportService;

    /** dryRun なら登録せず、登録する内容と飛ばす内容だけを返す */
    @PostMapping
    public PlanImportResponse importPlan(@RequestParam(defaultValue = "false") boolean dryRun,
            @Valid @RequestBody PlanImportRequest request) {
        return planImportService.importPlan(request, dryRun);
    }
}
