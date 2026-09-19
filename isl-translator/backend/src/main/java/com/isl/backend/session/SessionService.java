package com.isl.backend.session;

import com.isl.backend.model.SessionStatusPayload;
import com.isl.backend.model.TranslatedMessagePayload;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class SessionService {
    private static final char[] CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private final ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ClientPresence> clientPresences = new ConcurrentHashMap<>();
    public Session create() { String id; do { id = code(); } while (sessions.containsKey(id)); Session session = new Session(id); sessions.put(id, session); return session; }
    public Session getOrCreate(String id) { return sessions.computeIfAbsent(normalize(id), Session::new); }
    public Session get(String id) { return sessions.get(normalize(id)); }
    public List<TranslatedMessagePayload> history(String id) { Session s = get(id); return s == null ? null : s.getMessages(); }
    public SessionStatusPayload status(String id) { Session s = get(id); return s == null ? null : new SessionStatusPayload(s.isSignerConnected(), s.isOfficialConnected()); }
    public void joined(String id, String role) { Session s = get(id); if (s == null) throw new IllegalArgumentException("Session has ended"); s.setConnected(role, true); }
    public void left(String id, String role) { Session s = get(id); if (s != null) s.setConnected(role, false); }
    public void rememberClient(String websocketId, String sessionId, String role) { clientPresences.put(websocketId, new ClientPresence(normalize(sessionId), role)); }
    public ClientPresence forgetClient(String websocketId) { return clientPresences.remove(websocketId); }
    public boolean hasClient(String sessionId, String role) { return clientPresences.values().stream().anyMatch(p -> p.sessionId().equalsIgnoreCase(sessionId) && p.role().equals(role)); }
    public void append(String id, TranslatedMessagePayload message) { Session s = get(id); if (s != null) s.addMessage(message); }
    public void end(String id) { sessions.remove(normalize(id)); }
    @Scheduled(fixedDelay = 60000)
    public void evictIdleSessions() { Instant cutoff = Instant.now().minus(Duration.ofMinutes(30)); sessions.entrySet().removeIf(e -> !e.getValue().hasConnections() && e.getValue().getLastActivity().isBefore(cutoff)); }
    private String code() { StringBuilder result = new StringBuilder(6); for (int i = 0; i < 6; i++) result.append(CODE[ThreadLocalRandom.current().nextInt(CODE.length)]); return result.toString(); }
    private String normalize(String id) { if (id == null || !id.matches("[A-Za-z0-9]{6}")) throw new IllegalArgumentException("sessionId must be a 6-character alphanumeric code"); return id.toUpperCase(); }
    public record ClientPresence(String sessionId, String role) { }
}
