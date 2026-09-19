package com.isl.backend.translation;

import com.fasterxml.jackson.databind.JsonNode;
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
    private String text(JsonNode response) { String value = response.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText("").trim().replaceAll("\\s+", " "); if (value.isBlank() || value.length() > 500) throw new IllegalStateException("Invalid Gemini response"); return value; }
}
