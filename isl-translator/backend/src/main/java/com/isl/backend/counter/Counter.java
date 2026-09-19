package com.isl.backend.counter;

import java.time.Instant;

public class Counter {
    private final String counterId;
    private final String label;
    private final String createdAt;
    private volatile String currentSessionId;

    public Counter(String counterId, String label, String createdAt) {
        this.counterId = counterId;
        this.label = label;
        this.createdAt = createdAt == null ? Instant.now().toString() : createdAt;
    }
    public String getCounterId() { return counterId; }
    public String getLabel() { return label; }
    public String getCreatedAt() { return createdAt; }
    public String getCurrentSessionId() { return currentSessionId; }
    public void setCurrentSessionId(String id) { currentSessionId = id; }
}
