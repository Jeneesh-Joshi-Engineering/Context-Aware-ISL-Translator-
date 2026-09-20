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
    private java.util.concurrent.CompletableFuture<Void> translationTail = java.util.concurrent.CompletableFuture.completedFuture(null);
    private int pendingTranslations;
    public synchronized void enqueueTranslation(java.util.function.Supplier<java.util.concurrent.CompletableFuture<Void>> work) {
        if (pendingTranslations >= 20) throw new IllegalStateException("Please wait for the current translations to finish");
        pendingTranslations++;
        translationTail = translationTail.handle((result, error) -> null).thenCompose(ignored -> work.get())
            .whenComplete((result, error) -> { synchronized (this) { pendingTranslations--; } });
    }
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
