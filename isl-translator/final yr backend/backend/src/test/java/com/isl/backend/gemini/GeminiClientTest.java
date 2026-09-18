package com.isl.backend.gemini;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class GeminiClientTest {
    private final GeminiRequestBuilder builder = new GeminiRequestBuilder();
    @Test void buildsPromptWithKeywordsInOrder() {
        String prompt = builder.prompt(List.of("Bank", "Account", "Help"));
        assertTrue(prompt.contains("Bank, Account, Help"));
        assertTrue(prompt.contains("ONLY the sentence"));
    }
    @Test void extractsMockedGeminiResponse() throws Exception {
        GeminiClient client = new GeminiClient(WebClient.builder(), builder, "test-key", "http://example.test", "gemini-test", 1000);
        var response = new ObjectMapper().readTree("{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"  Please help me with my account.  \"}]}}]}");
        assertEquals("Please help me with my account.", client.extractSentence(response));
    }
    @Test void rejectsMalformedGeminiResponse() throws Exception {
        GeminiClient client = new GeminiClient(WebClient.builder(), builder, "test-key", "http://example.test", "gemini-test", 1000);
        assertThrows(IllegalStateException.class, () -> client.extractSentence(new ObjectMapper().readTree("{}")));
    }
}
