package com.isl.backend.session;

import com.isl.backend.model.TranslatedMessagePayload;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class Session {
    private final String sessionId;
    private final List<TranslatedMessagePayload> messages = new CopyOnWriteArrayList<>();
    private volatile boolean signerConnected;
    private volatile boolean officialConnected;
    private volatile Instant lastActivity = Instant.now();
    public Session(String sessionId) { this.sessionId = sessionId; }
    public String getSessionId() { return sessionId; }
    public List<TranslatedMessagePayload> getMessages() { return List.copyOf(messages); }
    public void addMessage(TranslatedMessagePayload message) { messages.add(message); touch(); }
    public boolean isSignerConnected() { return signerConnected; }
    public boolean isOfficialConnected() { return officialConnected; }
    public void setConnected(String role, boolean connected) { if ("SIGNER".equals(role)) signerConnected = connected; if ("OFFICIAL".equals(role)) officialConnected = connected; touch(); }
    public boolean hasConnections() { return signerConnected || officialConnected; }
    public Instant getLastActivity() { return lastActivity; }
    public void touch() { lastActivity = Instant.now(); }
}
