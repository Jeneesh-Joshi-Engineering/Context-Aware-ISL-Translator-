package com.isl.backend.gemini;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.springframework.stereotype.Service;

/** Transit-context sentence generation boundary used by WebSocket conversations. */
@Service
public class GeminiService {
    private final GeminiClient client;
    public GeminiService(GeminiClient client) { this.client = client; }
    public CompletableFuture<String> generateContextualSentence(List<String> keywords) { return client.generate(keywords); }
}
