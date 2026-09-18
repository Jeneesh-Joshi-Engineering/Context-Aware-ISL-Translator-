package com.isl.backend.ws;

import com.isl.backend.model.*;
import com.isl.backend.session.SessionService;
import com.isl.backend.translation.GeminiClient;
import com.isl.backend.translation.TemplateFallbackAgent;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class SessionSocketController {
    private static final Logger log = LoggerFactory.getLogger(SessionSocketController.class);
    private final SessionService sessions; private final SimpMessagingTemplate broker; private final GeminiClient gemini; private final TemplateFallbackAgent fallback;
    public SessionSocketController(SessionService sessions, SimpMessagingTemplate broker, GeminiClient gemini, TemplateFallbackAgent fallback) { this.sessions = sessions; this.broker = broker; this.gemini = gemini; this.fallback = fallback; }
    @MessageMapping("/session/{sessionId}/join") public void join(@DestinationVariable String sessionId, MessageEnvelope<?> input, @Header("simpSessionId") String websocketId) { String role = validRole(input.sender); sessions.joined(sessionId, role); sessions.rememberClient(websocketId, sessionId, role); broadcastStatus(sessionId); }
    @MessageMapping("/session/{sessionId}/transcript") public void transcript(@DestinationVariable String sessionId, MessageEnvelope<SpeechTranscriptPayload> input) {
        requireRole(input.sender, "OFFICIAL"); String text = input.payload == null ? null : input.payload.text; if (text == null || text.isBlank()) throw new IllegalArgumentException("Transcript text is required");
        publishTranslation(sessionId, new TranslatedMessagePayload("OFFICIAL", text.trim(), ""));
    }
    @MessageMapping("/session/{sessionId}/keyword") public void keyword(@DestinationVariable String sessionId, MessageEnvelope<KeywordInputPayload> input) {
        requireRole(input.sender, "SIGNER"); String keyword = input.payload == null ? null : input.payload.keyword; if (keyword == null || keyword.isBlank()) throw new IllegalArgumentException("Keyword is required");
        String clean = keyword.trim(); Instant received = Instant.now(); log.info("Keyword received: sessionId={}, at={}", sessionId, received);
        List<String> history = sessions.history(sessionId) == null ? List.of() : sessions.history(sessionId).stream().map(m -> m.englishText).limit(8).toList();
        gemini.generate(clean, history).exceptionally(error -> { log.warn("Gemini unavailable; using template fallback: {}", error.getMessage()); return fallback.sentenceFor(clean); }).thenAccept(sentence -> { publishTranslation(sessionId, new TranslatedMessagePayload("SIGNER", sentence, "")); log.info("Keyword broadcast: sessionId={}, receivedAt={}, emittedAt={}", sessionId, received, Instant.now()); });
    }
    public void broadcastStatus(String sessionId) { SessionStatusPayload status = sessions.status(sessionId); if (status != null) publish(sessionId, new MessageEnvelope<>("SESSION_STATUS", sessionId, "SYSTEM", status)); }
    private void publishTranslation(String sessionId, TranslatedMessagePayload payload) { sessions.append(sessionId, payload); publish(sessionId, new MessageEnvelope<>("TRANSLATED_MESSAGE", sessionId, "SYSTEM", payload)); }
    private void publish(String sessionId, MessageEnvelope<?> message) { broker.convertAndSend("/topic/session/" + sessionId.toUpperCase(), message); }
    private String validRole(String role) { if (!"SIGNER".equals(role) && !"OFFICIAL".equals(role)) throw new IllegalArgumentException("sender must be SIGNER or OFFICIAL"); return role; }
    private void requireRole(String actual, String expected) { if (!expected.equals(actual)) throw new IllegalArgumentException("sender must be " + expected); }
}
