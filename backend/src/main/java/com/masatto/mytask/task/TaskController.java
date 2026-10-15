package com.masatto.mytask.task;

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

import com.masatto.mytask.task.dto.StatusChangeRequest;
import com.masatto.mytask.task.dto.StatusChangeResponse;
import com.masatto.mytask.task.dto.StatusRestoreRequest;
import com.masatto.mytask.task.dto.TaskCountsResponse;
import com.masatto.mytask.task.dto.TaskCreateRequest;
import com.masatto.mytask.task.dto.TaskListResponse;
import com.masatto.mytask.task.dto.TaskResponse;
import com.masatto.mytask.task.dto.TaskUpdateRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public TaskListResponse list(
            @RequestParam String view,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "100") int limit) {
        return taskService.list(TaskView.fromParam(view), offset, limit);
    }

    @GetMapping("/counts")
    public TaskCountsResponse counts() {
        return taskService.counts();
    }

    @GetMapping("/{id}")
    public TaskResponse get(@PathVariable Long id) {
        return taskService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@Valid @RequestBody TaskCreateRequest request) {
        return taskService.create(request);
    }

    @PutMapping("/{id}")
    public TaskResponse update(@PathVariable Long id, @Valid @RequestBody TaskUpdateRequest request) {
        return taskService.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public StatusChangeResponse changeStatus(@PathVariable Long id,
            @Valid @RequestBody StatusChangeRequest request) {
        return taskService.changeStatus(id, request);
    }

    @PatchMapping("/statuses")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restoreStatuses(@Valid @RequestBody StatusRestoreRequest request) {
        taskService.restoreStatuses(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        taskService.delete(id);
    }
}
