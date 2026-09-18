package com.isl.backend.gemini;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class GeminiRequestBuilder {
    public String prompt(List<String> keywords) {
        return "You are converting isolated Indian Sign Language keywords into a single, natural, polite, grammatically correct sentence appropriate for a banking or public-transit customer service context. Keywords, in the order signed: " + String.join(", ", keywords) + ". Respond with ONLY the sentence — no explanation, no quotation marks, no preamble.";
    }
    public Map<String, Object> body(List<String> keywords) {
        return Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt(keywords))))),
            "generationConfig", Map.of("temperature", 0.2, "maxOutputTokens", 100));
    }
}
