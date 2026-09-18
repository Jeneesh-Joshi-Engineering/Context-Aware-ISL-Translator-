package com.isl.backend.model;

import java.time.Instant;

/** The single STOMP message shape shared by both devices. */
public class MessageEnvelope<T> {
    public String type;
    public String sessionId;
    public String sender;
    public T payload;
    public String timestamp;

    public MessageEnvelope() { }
    public MessageEnvelope(String type, String sessionId, String sender, T payload) {
        this.type = type;
        this.sessionId = sessionId;
        this.sender = sender;
        this.payload = payload;
        this.timestamp = Instant.now().toString();
    }
}
