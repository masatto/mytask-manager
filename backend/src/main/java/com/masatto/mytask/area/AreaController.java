package com.masatto.mytask.area;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.masatto.mytask.area.dto.AreaRequest;
import com.masatto.mytask.area.dto.AreaResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/areas")
@RequiredArgsConstructor
public class AreaController {

    private final AreaService areaService;

    public record AreaListResponse(List<AreaResponse> items) {
    }

    public record OrderRequest(@NotNull(message = "並び順は必須です") List<@NotNull Long> ids) {
    }

    @GetMapping
    public AreaListResponse list() {
        return new AreaListResponse(areaService.list());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AreaResponse create(@Valid @RequestBody AreaRequest request) {
        return areaService.create(request);
    }

    @PutMapping("/{id}")
    public AreaResponse update(@PathVariable Long id, @Valid @RequestBody AreaRequest request) {
        return areaService.update(id, request);
    }

    @PutMapping("/order")
    public AreaListResponse reorder(@Valid @RequestBody OrderRequest request) {
        return new AreaListResponse(areaService.reorder(request.ids()));
    }

    /** moveTo を省くと、そのエリアのタスクとルールは未分類になる */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @RequestParam(required = false) Long moveTo) {
        areaService.delete(id, moveTo);
    }
}
