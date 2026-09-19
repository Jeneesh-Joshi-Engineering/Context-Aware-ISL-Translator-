package com.isl.backend.counter;

import java.io.IOException;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/counters")
@CrossOrigin(origins = "*")
public class CounterController {
    private final CounterService counters;
    public CounterController(CounterService counters) { this.counters = counters; }
    @PostMapping public Counter create(@RequestBody(required = false) Map<String, String> body) throws IOException {
        return counters.create(body == null ? null : body.get("label"));
    }
    @GetMapping("/{id}") public Counter get(@PathVariable String id) { return counters.get(id); }
    @PostMapping("/{id}/sessions") public Map<String, String> start(@PathVariable String id) {
        return Map.of("sessionId", counters.start(id).getSessionId());
    }
    @PostMapping("/{id}/sessions/{sessionId}/end") public Map<String, String> end(@PathVariable String id, @PathVariable String sessionId) {
        counters.end(id, sessionId); return Map.of("status", "ended");
    }
}
