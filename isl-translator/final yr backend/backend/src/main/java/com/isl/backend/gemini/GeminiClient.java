package com.isl.backend.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.util.retry.Retry;

@Component
public class GeminiClient {
    private final WebClient webClient;
    private final GeminiRequestBuilder requestBuilder;
    private final String apiKey, endpoint, model;
    private final Duration timeout;
    public GeminiClient(WebClient.Builder builder, GeminiRequestBuilder requestBuilder,
            @Value("${gemini.api.key}") String apiKey, @Value("${gemini.endpoint}") String endpoint, @Value("${gemini.model}") String model,
            @Value("${gemini.timeout-ms:5000}") long timeoutMs) {
        if (apiKey == null || apiKey.isBlank() || apiKey.startsWith("${")) throw new IllegalStateException("GEMINI_API_KEY environment variable is required");
        this.webClient = builder.build(); this.requestBuilder = requestBuilder; this.apiKey = apiKey; this.endpoint = endpoint; this.model = model; this.timeout = Duration.ofMillis(timeoutMs);
    }
    public CompletableFuture<String> generate(List<String> keywords) {
        return webClient.post().uri(endpoint + "/" + model + ":generateContent?key={key}", apiKey).bodyValue(requestBuilder.body(keywords)).retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, response -> response.createException())
            .bodyToMono(JsonNode.class).timeout(timeout)
            .retryWhen(Retry.max(1).filter(this::isTransient))
            .map(this::extractSentence).toFuture();
    }
    private boolean isTransient(Throwable error) {
        if (error instanceof org.springframework.web.reactive.function.client.WebClientResponseException response) return response.getStatusCode().is5xxServerError();
        return true;
    }
    String extractSentence(JsonNode root) {
        JsonNode text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
        if (!text.isTextual() || text.asText().isBlank()) throw new IllegalStateException("Gemini returned an empty or malformed response");
        String sentence = text.asText().trim().replaceAll("^[\\\"']+|[\\\"']+$", "").replaceAll("\\s+", " ");
        if (sentence.length() > 500 || sentence.contains("\n")) throw new IllegalStateException("Gemini returned an invalid sentence");
        return sentence;
    }
}
