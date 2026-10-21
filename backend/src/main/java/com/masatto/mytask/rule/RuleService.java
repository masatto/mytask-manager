package com.masatto.mytask.rule;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.masatto.mytask.area.AreaService;
import com.masatto.mytask.common.ApiException;
import com.masatto.mytask.rule.dto.PatternDto;
import com.masatto.mytask.rule.dto.RulePreviewRequest;
import com.masatto.mytask.rule.dto.RuleRequest;
import com.masatto.mytask.rule.dto.RuleResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RuleService {

    static final int PREVIEW_COUNT = 3;

    private final RecurrenceRuleRepository ruleRepository;
    private final RecurrenceGenerator generator;
    private final AreaService areaService;
    private final Clock clock;

    /** @param areaId 指定するとそのエリアのルールだけにする（null ならすべて） */
    public List<RuleResponse> list(Long areaId) {
        return ruleRepository.findAllByOrderByIdAsc().stream()
                .filter(r -> areaId == null || areaId.equals(r.getAreaId()))
                .map(this::toResponse)
                .toList();
    }

    public RuleResponse get(Long id) {
        return toResponse(findRule(id));
    }

    @Transactional
    public RuleResponse create(RuleRequest request) {
        RecurrenceRule rule = RecurrenceRule.create(Instant.now(clock));
        apply(rule, request);
        ruleRepository.save(rule);
        // 今日以前の直近の発生日があれば、すぐに生成する（api-design 7章 決定事項3）
        generator.generate(rule);
        return toResponse(rule);
    }

    @Transactional
    public RuleResponse update(Long id, RuleRequest request) {
        RecurrenceRule rule = findRule(id);
        apply(rule, request);
        // 変更は次回生成分から反映する。生成済みの回は lastGeneratedDate により作り直されない
        generator.generate(rule);
        return toResponse(rule);
    }

    @Transactional
    public RuleResponse setActive(Long id, boolean active) {
        RecurrenceRule rule = findRule(id);
        rule.setActive(active, Instant.now(clock));
        if (active) {
            // 再開したときは、停止中に逃した回のうち直近の1件を生成する（起動時の追いつき生成と同じ扱い）
            generator.generate(rule);
        }
        return toResponse(rule);
    }

    @Transactional
    public void delete(Long id) {
        // 生成済みのタスクは残り、ルールへの参照だけが DB 側で NULL になる（ON DELETE SET NULL）
        ruleRepository.delete(findRule(id));
    }

    public List<LocalDate> preview(RulePreviewRequest request) {
        RecurrencePattern pattern = toPattern(request.pattern(), request.startDate(), request.endDate());
        return pattern.nextOccurrences(LocalDate.now(clock), PREVIEW_COUNT);
    }

    private void apply(RecurrenceRule rule, RuleRequest request) {
        areaService.checkExists(request.areaId(), "areaId");
        RecurrencePattern pattern = toPattern(request.pattern(), request.startDate(), request.endDate());
        List<RecurrenceRule.TemplateSpec> templates = request.subtaskTemplates() == null ? List.of()
                : request.subtaskTemplates().stream()
                        .map(t -> new RecurrenceRule.TemplateSpec(t.title().strip(), t.priority(), t.estimateMinutes()))
                        .toList();
        rule.update(
                request.title().strip(),
                request.memo() == null || request.memo().isBlank() ? null : request.memo(),
                request.priority(),
                request.dueTime(),
                pattern,
                request.active() == null || request.active(),
                templates,
                request.areaId(),
                request.estimateMinutes(),
                Instant.now(clock));
    }

    /** パターンの項目間チェック（Bean Validation で表せない部分） */
    private static RecurrencePattern toPattern(PatternDto dto, LocalDate startDate, LocalDate endDate) {
        if (endDate != null && endDate.isBefore(startDate)) {
            throw ApiException.validation("endDate", "終了日は開始日以降にしてください");
        }
        return switch (dto.type()) {
            case DAILY -> new RecurrencePattern(PatternType.DAILY, null, null, startDate, endDate);
            case WEEKLY -> {
                if (dto.daysOfWeek() == null || dto.daysOfWeek().isEmpty()) {
                    throw ApiException.validation("pattern.daysOfWeek", "曜日を1つ以上選んでください");
                }
                yield new RecurrencePattern(PatternType.WEEKLY, dto.daysOfWeek(), null, startDate, endDate);
            }
            case MONTHLY -> {
                Integer day = dto.dayOfMonth();
                if (day == null || (day != RecurrencePattern.LAST_DAY && (day < 1 || day > 31))) {
                    throw ApiException.validation("pattern.dayOfMonth", "日付は1〜31または末日を選んでください");
                }
                yield new RecurrencePattern(PatternType.MONTHLY, null, day, startDate, endDate);
            }
        };
    }

    private RecurrenceRule findRule(Long id) {
        return ruleRepository.findById(id).orElseThrow(() -> ApiException.notFound("ルールが見つかりません"));
    }

    private RuleResponse toResponse(RecurrenceRule rule) {
        return RuleResponse.of(rule, LocalDate.now(clock), clock.getZone());
    }
}
