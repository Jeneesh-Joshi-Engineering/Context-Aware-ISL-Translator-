package com.isl.backend.model;

import java.time.Instant;
import java.util.List;
public class OutgoingMessage {
    public MessageType type;
    public String sessionId;
    public List<String> originalKeywords;
    public String generatedSentence;
    public Long generationTimeMs;
    public String errorMessage;
    public String timestamp = Instant.now().toString();
    public static OutgoingMessage error(String sessionId, String message) {
        OutgoingMessage output = new OutgoingMessage(); output.type = MessageType.ERROR; output.sessionId = sessionId; output.errorMessage = message; return output;
    }
}
