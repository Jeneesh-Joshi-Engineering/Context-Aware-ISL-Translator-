package com.isl.backend.websocket;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class SessionManager {
    private final ConcurrentHashMap<String, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();
    public void add(String sessionId, WebSocketSession session) { sessions.computeIfAbsent(sessionId, ignored -> ConcurrentHashMap.newKeySet()).add(session); }
    public void remove(String sessionId, WebSocketSession session) {
        sessions.computeIfPresent(sessionId, (key, clients) -> { clients.remove(session); return clients.isEmpty() ? null : clients; });
    }
    public void broadcast(String sessionId, TextMessage message) {
        Set<WebSocketSession> clients = sessions.getOrDefault(sessionId, Set.of());
        for (WebSocketSession client : clients) send(client, message);
    }
    public void relayToOthers(String sessionId, WebSocketSession sender, TextMessage message) {
        for (WebSocketSession client : sessions.getOrDefault(sessionId, Set.of())) if (!client.getId().equals(sender.getId())) send(client, message);
    }
    private void send(WebSocketSession session, TextMessage message) {
        try { if (session.isOpen()) synchronized (session) { session.sendMessage(message); } }
        catch (IOException ignored) { }
    }
}
