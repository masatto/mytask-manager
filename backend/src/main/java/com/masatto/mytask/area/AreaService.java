package com.masatto.mytask.area;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.masatto.mytask.area.dto.AreaRequest;
import com.masatto.mytask.area.dto.AreaResponse;
import com.masatto.mytask.common.ApiException;
import com.masatto.mytask.rule.RecurrenceRuleRepository;
import com.masatto.mytask.task.TaskRepository;

import lombok.RequiredArgsConstructor;

/** エリアの管理（api-design 8章） */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AreaService {

    /** サイドバーのタブが増えすぎないように上限を設ける */
    public static final int MAX_AREAS = 10;

    private final AreaRepository areaRepository;
    private final TaskRepository taskRepository;
    private final RecurrenceRuleRepository ruleRepository;
    private final Clock clock;

    public List<AreaResponse> list() {
        return areaRepository.findAllByOrderByPositionAscIdAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public AreaResponse create(AreaRequest request) {
        List<Area> areas = areaRepository.findAllByOrderByPositionAscIdAsc();
        if (areas.size() >= MAX_AREAS) {
            throw ApiException.validation("name", "エリアは" + MAX_AREAS + "個までです");
        }
        String name = request.name().strip();
        checkUniqueName(areas, name, null);
        int position = areas.isEmpty() ? 0 : areas.getLast().getPosition() + 1;
        Area area = areaRepository.save(Area.create(name, request.color(), position, Instant.now(clock)));
        return toResponse(area);
    }

    @Transactional
    public AreaResponse update(Long id, AreaRequest request) {
        Area area = findArea(id);
        String name = request.name().strip();
        checkUniqueName(areaRepository.findAll(), name, id);
        area.update(name, request.color(), Instant.now(clock));
        return toResponse(area);
    }

    /** 並び順を、渡された ID の順にする。すべてのエリアを1回ずつ含めること */
    @Transactional
    public List<AreaResponse> reorder(List<Long> ids) {
        Map<Long, Area> areas = areaRepository.findAll().stream()
                .collect(Collectors.toMap(Area::getId, Function.identity()));
        if (ids.size() != areas.size() || !new HashSet<>(ids).equals(areas.keySet())) {
            throw ApiException.validation("ids", "すべてのエリアを1回ずつ指定してください");
        }
        for (int i = 0; i < ids.size(); i++) {
            areas.get(ids.get(i)).moveTo(i);
        }
        return list();
    }

    /**
     * エリアを削除する。そのエリアのタスク（サブタスクも）とルールは moveTo のエリアに移す。
     * moveTo が null なら未分類（エリアなし）にする。
     */
    @Transactional
    public void delete(Long id, Long moveTo) {
        Area area = findArea(id);
        if (moveTo != null && (moveTo.equals(id) || !areaRepository.existsById(moveTo))) {
            throw ApiException.validation("moveTo", "移動先のエリアが見つかりません");
        }
        taskRepository.moveArea(id, moveTo);
        ruleRepository.moveArea(id, moveTo);
        areaRepository.delete(area);
    }

    /** 指定されたエリアがあることを確かめる（null は未分類として通す） */
    public void checkExists(Long id, String field) {
        if (id != null && !areaRepository.existsById(id)) {
            throw ApiException.validation(field, "エリアが見つかりません");
        }
    }

    private static void checkUniqueName(List<Area> areas, String name, Long selfId) {
        boolean duplicated = areas.stream()
                .anyMatch(a -> !a.getId().equals(selfId) && a.getName().equalsIgnoreCase(name));
        if (duplicated) {
            throw ApiException.validation("name", "同じ名前のエリアがあります");
        }
    }

    private Area findArea(Long id) {
        return areaRepository.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND",
                "エリアが見つかりません"));
    }

    private AreaResponse toResponse(Area area) {
        return new AreaResponse(area.getId(), area.getName(), AreaColor.of(area.getColor()),
                taskRepository.countByAreaIdAndParentIdIsNull(area.getId()),
                ruleRepository.countByAreaId(area.getId()));
    }
}
