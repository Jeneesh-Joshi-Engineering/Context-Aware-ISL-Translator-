package com.isl.backend.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.isl.backend.gemini.GeminiService;
import com.isl.backend.gemini.GeminiClient;
import com.isl.backend.logging.KpiLogger;
import com.isl.backend.model.IncomingMessage;
import com.isl.backend.model.MessageType;
import com.isl.backend.model.OutgoingMessage;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ConversationWebSocketHandler extends TextWebSocketHandler {
    private static final Logger log = LoggerFactory.getLogger(ConversationWebSocketHandler.class);
    private static final String SESSION_ID = "conversationSessionId";
    private final SessionManager sessionManager; private final GeminiService geminiService; private final KpiLogger kpiLogger; private final ObjectMapper mapper;
    @Autowired
    public ConversationWebSocketHandler(SessionManager sessionManager, GeminiService geminiService, KpiLogger kpiLogger, ObjectMapper mapper) { this.sessionManager = sessionManager; this.geminiService = geminiService; this.kpiLogger = kpiLogger; this.mapper = mapper; }
    /** Compatibility constructor for existing tests and integrations using GeminiClient directly. */
    public ConversationWebSocketHandler(SessionManager sessionManager, GeminiClient geminiClient, KpiLogger kpiLogger, ObjectMapper mapper) { this(sessionManager, new GeminiService(geminiClient), kpiLogger, mapper); }
    @Override public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = query(session, "sessionId"), role = query(session, "role");
        if (sessionId == null || !roleAllowed(role)) { send(session, OutgoingMessage.error(sessionId, "Connection requires sessionId and role (deaf_user, official, or observer)")); session.close(CloseStatus.BAD_DATA); return; }
        session.getAttributes().put(SESSION_ID, sessionId); session.getAttributes().put("role", role); sessionManager.add(sessionId, session);
    }
    @Override protected void handleTextMessage(WebSocketSession session, TextMessage frame) {
        String sessionId = (String) session.getAttributes().get(SESSION_ID);
        try {
            if (sessionId == null) { send(session, OutgoingMessage.error(null, "Invalid connection session")); return; }
            if ("observer".equals(session.getAttributes().get("role"))) { send(session, OutgoingMessage.error(sessionId, "Observers cannot send messages")); return; }
            IncomingMessage input = mapper.readValue(frame.getPayload(), IncomingMessage.class);
            if (input.type == null) { error(session, sessionId, "Missing required field: type"); return; }
            if (input.sessionId != null && !sessionId.equals(input.sessionId)) { error(session, sessionId, "sessionId does not match this connection"); return; }
            if (input.type == MessageType.KEYWORD_DETECTED) processKeywords(session, sessionId, input);
            else if (input.type == MessageType.OFFICIAL_RESPONSE) processOfficialResponse(session, sessionId, input, frame);
            else error(session, sessionId, "Unsupported incoming message type: " + input.type);
        } catch (Exception ex) { log.warn("Unexpected WebSocket message failure", ex); error(session, sessionId, "Malformed message: " + safeMessage(ex)); }
    }
    private void processKeywords(WebSocketSession sender, String sessionId, IncomingMessage input) {
        if (!"deaf_user".equals(input.role)) { error(sender, sessionId, "KEYWORD_DETECTED requires role deaf_user"); return; }
        List<String> keywords = sanitize(input);
        if (keywords.isEmpty()) { error(sender, sessionId, "Missing required field: keyword or keywords"); return; }
        long started = System.nanoTime();
        geminiService.generateContextualSentence(keywords).whenComplete((sentence, failure) -> {
            if (failure != null) { String reason = "Sentence generation failed: " + safeMessage(failure); error(sender, sessionId, reason); return; }
            long elapsed = (System.nanoTime() - started) / 1_000_000;
            OutgoingMessage output = new OutgoingMessage(); output.type = MessageType.SENTENCE_GENERATED; output.sessionId = sessionId; output.originalKeywords = keywords; output.generatedSentence = sentence; output.generationTimeMs = elapsed; output.timestamp = Instant.now().toString();
            kpiLogger.success(sessionId, keywords, elapsed); broadcast(sessionId, output);
        });
    }
    private void processOfficialResponse(WebSocketSession sender, String sessionId, IncomingMessage input, TextMessage original) {
        if (!"official".equals(input.role) || input.transcribedText == null || input.transcribedText.isBlank()) { error(sender, sessionId, "OFFICIAL_RESPONSE requires role official and transcribedText"); return; }
        sessionManager.relayToOthers(sessionId, sender, original);
    }
    private List<String> sanitize(IncomingMessage input) {
        List<String> values = new ArrayList<>(); if (input.keyword != null) values.add(input.keyword); if (input.keywords != null) values.addAll(input.keywords);
        List<String> clean = new ArrayList<>();
        for (String value : values) { if (value == null) continue; String word = value.trim().replaceAll("[^\\p{L}\\p{N}_ .,'!?-]", "").replaceAll("\\s+", " "); if (!word.isBlank() && word.length() <= 80) clean.add(word); }
        return clean.size() <= 10 ? clean : List.of();
    }
    @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) { Object id = session.getAttributes().get(SESSION_ID); if (id instanceof String sessionId) sessionManager.remove(sessionId, session); }
    private String query(WebSocketSession session, String key) { if (session.getUri() == null) return null; return org.springframework.web.util.UriComponentsBuilder.fromUri(session.getUri()).build().getQueryParams().getFirst(key); }
    private boolean roleAllowed(String role) { return "deaf_user".equals(role) || "official".equals(role) || "observer".equals(role); }
    private void broadcast(String sessionId, OutgoingMessage message) { try { sessionManager.broadcast(sessionId, new TextMessage(mapper.writeValueAsString(message))); } catch (Exception ex) { kpiLogger.error(sessionId, "Could not serialize outgoing message"); } }
    private void error(WebSocketSession session, String sessionId, String message) { kpiLogger.error(sessionId, message); send(session, OutgoingMessage.error(sessionId, message)); }
    private void send(WebSocketSession session, OutgoingMessage message) { try { session.sendMessage(new TextMessage(mapper.writeValueAsString(message))); } catch (Exception ex) { log.warn("Could not send WebSocket error", ex); } }
    private String safeMessage(Throwable failure) { String value = failure.getMessage(); return value == null ? "Unknown error" : value.replaceAll("[\\r\\n]", " "); }
}
