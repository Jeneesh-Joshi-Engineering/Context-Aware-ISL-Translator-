package com.isl.backend.config;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

@RestController

public class HealthController {
    private final boolean geminiConfigured;
    private final java.util.List<String> vocabulary;
    public HealthController(@Value("${gemini.api.key:}") String key) throws java.io.IOException {
        geminiConfigured = !key.isBlank();
        try (var input = new org.springframework.core.io.ClassPathResource("static/model/model_metadata.json").getInputStream()) {
            var metadata = new com.fasterxml.jackson.databind.ObjectMapper().readTree(input);
            var values = new java.util.ArrayList<String>();
            for (var label : metadata.path("output_classes")) if (!label.asText().equals("No_Gesture")) values.add(label.asText());
            vocabulary = java.util.List.copyOf(values);
        }
    }
    @GetMapping("/api/health") public Map<String, Object> health() {
        return Map.of("status", "ok", "translationMode", geminiConfigured ? "gemini-with-fallback" : "template-fallback",
            "vocabulary", vocabulary, "audioTranscriptionConfigured", geminiConfigured);
    }
}
