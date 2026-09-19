package com.isl.backend.config;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = "*")
public class HealthController {
    private final boolean geminiConfigured;
    public HealthController(@Value("${gemini.api.key:}") String key) { geminiConfigured = !key.isBlank(); }
    @GetMapping("/api/health") public Map<String, Object> health() {
        return Map.of("status", "ok", "translationMode", geminiConfigured ? "gemini-with-fallback" : "template-fallback",
            "vocabulary", java.util.List.of("Help", "Ticket", "Train"));
    }
}
