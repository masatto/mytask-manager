package com.masatto.mytask.rule;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.masatto.mytask.rule.dto.RulePreviewRequest;
import com.masatto.mytask.rule.dto.RuleRequest;
import com.masatto.mytask.rule.dto.RuleResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/rules")
@RequiredArgsConstructor
public class RuleController {

    private final RuleService ruleService;

    public record RuleListResponse(List<RuleResponse> items) {
    }

    public record ActiveRequest(@NotNull(message = "有効/停止の指定は必須です") Boolean active) {
    }

    public record PreviewResponse(List<LocalDate> occurrences) {
    }

    @GetMapping
    public RuleListResponse list(@RequestParam(required = false) Long area) {
        return new RuleListResponse(ruleService.list(area));
    }

    @GetMapping("/{id}")
    public RuleResponse get(@PathVariable Long id) {
        return ruleService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RuleResponse create(@Valid @RequestBody RuleRequest request) {
        return ruleService.create(request);
    }

    @PutMapping("/{id}")
    public RuleResponse update(@PathVariable Long id, @Valid @RequestBody RuleRequest request) {
        return ruleService.update(id, request);
    }

    @PatchMapping("/{id}/active")
    public RuleResponse setActive(@PathVariable Long id, @Valid @RequestBody ActiveRequest request) {
        return ruleService.setActive(id, request.active());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        ruleService.delete(id);
    }

    @PostMapping("/preview")
    public PreviewResponse preview(@Valid @RequestBody RulePreviewRequest request) {
        return new PreviewResponse(ruleService.preview(request));
    }
}
