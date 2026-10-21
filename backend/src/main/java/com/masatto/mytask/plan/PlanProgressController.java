package com.masatto.mytask.plan;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.masatto.mytask.plan.dto.PlanProgressResponse;
import com.masatto.mytask.plan.dto.SubtaskScheduleRequest;
import com.masatto.mytask.plan.dto.SubtaskScheduleResponse;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
public class PlanProgressController {

    private final PlanProgressService planProgressService;

    /** 計画ごとの進み具合。area を付けるとそのエリアのステップだけで集計する */
    @GetMapping
    public PlanProgressResponse list(@RequestParam(required = false) Long area) {
        return planProgressService.list(area);
    }

    /** 期限のないサブタスクに、ステップの期間の中で期限を割り振る。dryRun なら割り振る内容だけを返す */
    @PostMapping("/schedule-subtasks")
    public SubtaskScheduleResponse scheduleSubtasks(@RequestParam(defaultValue = "false") boolean dryRun,
            @Valid @RequestBody SubtaskScheduleRequest request) {
        return planProgressService.scheduleSubtasks(request.name(), dryRun);
    }
}
