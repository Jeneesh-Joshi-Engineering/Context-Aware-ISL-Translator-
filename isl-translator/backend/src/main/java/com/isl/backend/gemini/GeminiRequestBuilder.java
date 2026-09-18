package com.isl.backend.gemini;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Builds the single-purpose transit-hub prompt sent to Gemini. */
@Component
public class GeminiRequestBuilder {
    public String prompt(List<String> keywords) {
        return "You are converting isolated Indian Sign Language keywords into a single, natural, polite, grammatically correct sentence, spoken by a Deaf or Hard-of-Hearing passenger to transit staff at a railway station, bus terminal, or airport (e.g., ticket counter staff, platform staff, security personnel, or police). The sentence should sound like something a passenger would realistically say in that setting. Keywords, in the order signed: " + String.join(", ", keywords) + ". Respond with ONLY the sentence — no explanation, no quotation marks, no preamble.";
    }
    public String sessionPrompt(String keyword, List<String> recentMessages) {
        String history = recentMessages.isEmpty() ? "No previous conversation." : String.join(" | ", recentMessages);
        return "Convert the isolated Indian Sign Language keyword '" + keyword + "' into one concise, polite, grammatically correct sentence spoken by a passenger to transit-hub staff. Use only the supplied keyword and the recent conversation for continuity; do not invent facts, requests, locations, or details. Recent conversation: " + history + ". Return ONLY the English sentence.";
    }
    public Map<String, Object> sessionBody(String keyword, List<String> recentMessages) {
        return Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", sessionPrompt(keyword, recentMessages))))),
            "generationConfig", Map.of("temperature", 0.2, "maxOutputTokens", 100));
    }
    public Map<String, Object> body(List<String> keywords) {
        return Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt(keywords))))),
            "generationConfig", Map.of("temperature", 0.2, "maxOutputTokens", 100));
    }
}
