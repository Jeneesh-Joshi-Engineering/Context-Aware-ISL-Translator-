package com.isl.backend.translation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.isl.backend.gemini.GeminiRequestBuilder;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/** Session-aware Gemini relay. Calls are optional so a missing key never breaks the demo. */
@Component("sessionGeminiClient")
public class GeminiClient {
    private final WebClient client; private final GeminiRequestBuilder prompts; private final String key, endpoint, model; private final Duration timeout;
    public GeminiClient(WebClient.Builder builder, GeminiRequestBuilder prompts, @Value("${gemini.api.key:}") String key, @Value("${gemini.endpoint}") String endpoint, @Value("${gemini.model}") String model, @Value("${gemini.timeout-ms:5000}") long timeoutMs) {
        this.client = builder.build(); this.prompts = prompts; this.key = key; this.endpoint = endpoint; this.model = model; this.timeout = Duration.ofMillis(timeoutMs);
    }
    public CompletableFuture<String> generate(String keyword, List<String> history) {
        if (key == null || key.isBlank()) return CompletableFuture.failedFuture(new IllegalStateException("Gemini is not configured"));
        return client.post().uri(endpoint + "/" + model + ":generateContent").header("x-goog-api-key", key).bodyValue(prompts.sessionBody(keyword, history)).retrieve().bodyToMono(JsonNode.class).timeout(timeout).map(this::text).toFuture();
    }
    public CompletableFuture<BilingualText> bilingual(String source, String language, boolean official, List<String> history) {
        if (key == null || key.isBlank()) return CompletableFuture.failedFuture(new IllegalStateException("Gemini is not configured"));
        return client.post().uri(endpoint + "/" + model + ":generateContent").header("x-goog-api-key", key)
            .bodyValue(prompts.bilingualBody(source, language, official, history)).retrieve().bodyToMono(JsonNode.class)
            .timeout(timeout).map(this::parseBilingual).toFuture();
    }
    private BilingualText parseBilingual(JsonNode response) {
        try {
            StringBuilder content = new StringBuilder();
            for (var part : response.path("candidates").path(0).path("content").path("parts"))
                if (!part.path("thought").asBoolean(false)) content.append(part.path("text").asText(""));
            var data = new ObjectMapper().readTree(content.toString());
            String en = data.path("englishText").asText("").trim(), hi = data.path("hindiText").asText("").trim();
            if (en.isBlank() || hi.isBlank() || en.length() > 2000 || hi.length() > 3000
                    || !en.matches("(?s).*[A-Za-z].*") || !hi.matches("(?s).*[\\u0900-\\u097F].*"))
                throw new IllegalArgumentException("Missing or invalid bilingual fields");
            return new BilingualText(en, hi, "gemini");
        } catch (Exception error) { throw new IllegalStateException("Invalid bilingual response", error); }
    }
    private String text(JsonNode response) { String value = response.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText("").trim().replaceAll("\\s+", " "); if (value.isBlank() || value.length() > 500) throw new IllegalStateException("Invalid Gemini response"); return value; }
}
