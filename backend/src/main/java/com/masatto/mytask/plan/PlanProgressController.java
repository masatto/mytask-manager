package com.masatto.mytask.plan;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.masatto.mytask.plan.dto.PlanProgressResponse;

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
}
