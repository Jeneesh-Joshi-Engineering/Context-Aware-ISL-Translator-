package com.isl.backend.ws;

import com.isl.backend.model.*;
import com.isl.backend.session.SessionService;
import com.isl.backend.translation.GeminiClient;
import com.isl.backend.translation.TemplateFallbackAgent;
import java.util.List;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class SessionSocketController {
    private final SessionService sessions; private final SimpMessagingTemplate broker; private final GeminiClient gemini; private final TemplateFallbackAgent fallback;
    public SessionSocketController(SessionService sessions, SimpMessagingTemplate broker, GeminiClient gemini, TemplateFallbackAgent fallback) { this.sessions = sessions; this.broker = broker; this.gemini = gemini; this.fallback = fallback; }
    @MessageMapping("/session/{sessionId}/join") public void join(@DestinationVariable String sessionId, MessageEnvelope<?> input, @Header("simpSessionId") String websocketId) { String role = validRole(input.sender); sessions.joined(sessionId, role); sessions.rememberClient(websocketId, sessionId, role); broadcastStatus(sessionId); }
    @MessageMapping("/session/{sessionId}/transcript") public void transcript(@DestinationVariable String sessionId, MessageEnvelope<SpeechTranscriptPayload> input) {
        requireRole(input.sender, "OFFICIAL"); String text = input.payload == null ? null : input.payload.text; if (text == null || text.isBlank()) throw new IllegalArgumentException("Transcript text is required");
        if (text.length() > 1000) throw new IllegalArgumentException("Reply must be at most 1000 characters");
        String language = input.payload.language;
        if (language == null) language = "en-IN";
        if (!language.equals("en-IN") && !language.equals("hi-IN")) throw new IllegalArgumentException("Choose English or Hindi");
        translate(sessionId, text.trim(), language, true);
    }
    @MessageMapping("/session/{sessionId}/keyword") public void keyword(@DestinationVariable String sessionId, MessageEnvelope<KeywordInputPayload> input) {
        requireRole(input.sender, "SIGNER"); String keyword = input.payload == null ? null : input.payload.keyword; if (keyword == null || keyword.isBlank()) throw new IllegalArgumentException("Keyword is required");
        if (sessions.get(sessionId) == null) return;
        String clean = keyword.trim();
        if (clean.equalsIgnoreCase("No_Gesture") || clean.equalsIgnoreCase("No Gesture")) return;
        if (clean.length() > 200) throw new IllegalArgumentException("Gloss is too long");
        translate(sessionId, clean, "en-IN", false);
    }
    private void translate(String sessionId, String source, String language, boolean official) {
        var session = sessions.get(sessionId); if (session == null) return;
        session.enqueueTranslation(() -> {
            if (sessions.get(sessionId) != session) return java.util.concurrent.CompletableFuture.completedFuture(null);
            var messages = sessions.history(sessionId);
            List<String> history = messages == null ? List.of() : messages.stream().skip(Math.max(0, messages.size() - 8)).map(m -> m.englishText).toList();
            return gemini.bilingual(source, language, official, history)
                .exceptionally(error -> fallback.bilingual(source, language, official))
                .thenAccept(text -> { if (sessions.get(sessionId) == session) publishTranslation(sessionId, text.message(official ? "OFFICIAL" : "SIGNER")); });
        });
    }
    public void broadcastStatus(String sessionId) { SessionStatusPayload status = sessions.status(sessionId); if (status != null) publish(sessionId, new MessageEnvelope<>("SESSION_STATUS", sessionId, "SYSTEM", status)); }
    private void publishTranslation(String sessionId, TranslatedMessagePayload payload) { if (sessions.get(sessionId) == null) return; sessions.append(sessionId, payload); publish(sessionId, new MessageEnvelope<>("TRANSLATED_MESSAGE", sessionId, "SYSTEM", payload)); }
    private void publish(String sessionId, MessageEnvelope<?> message) { broker.convertAndSend("/topic/session/" + sessionId.toUpperCase(), message); }
    private String validRole(String role) { if (!"SIGNER".equals(role) && !"OFFICIAL".equals(role)) throw new IllegalArgumentException("sender must be SIGNER or OFFICIAL"); return role; }
    private void requireRole(String actual, String expected) { if (!expected.equals(actual)) throw new IllegalArgumentException("sender must be " + expected); }
}
