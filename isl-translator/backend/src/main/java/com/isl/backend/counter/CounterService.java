package com.isl.backend.counter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.isl.backend.model.MessageEnvelope;
import com.isl.backend.session.Session;
import com.isl.backend.session.SessionService;
import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CounterService {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final Map<String, Counter> counters = new ConcurrentHashMap<>();
    private final SessionService sessions;
    private final SimpMessagingTemplate broker;
    private final ObjectMapper mapper;
    private final Path store;

    public CounterService(SessionService sessions, SimpMessagingTemplate broker, ObjectMapper mapper,
            @Value("${counter.store:data/counters.json}") String path) throws IOException {
        this.sessions = sessions; this.broker = broker; this.mapper = mapper;
        store = Path.of(path).toAbsolutePath();
        if (Files.exists(store)) {
            for (var row : mapper.readTree(store.toFile())) {
                var counter = new Counter(row.path("counterId").asText(), row.path("label").asText(), row.path("createdAt").asText());
                counters.put(counter.getCounterId(), counter);
            }
        }
    }

    public synchronized Counter create(String label) throws IOException {
        String clean = label == null ? "Service counter" : label.trim();
        if (clean.length() > 80) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Label must be at most 80 characters");
        String id;
        do {
            var code = new StringBuilder("CTR-");
            for (int i = 0; i < 4; i++) code.append(ALPHABET.charAt(ThreadLocalRandom.current().nextInt(ALPHABET.length())));
            id = code.toString();
        } while (counters.containsKey(id));
        var counter = new Counter(id, clean, null);
        counters.put(id, counter);
        try { save(); } catch (IOException error) { counters.remove(id); throw error; }
        return counter;
    }

    public Counter get(String id) {
        Counter counter = counters.get(id.toUpperCase(Locale.ROOT));
        if (counter == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Counter not found");
        return counter;
    }

    public synchronized Session start(String id) {
        Counter counter = get(id);
        if (counter.getCurrentSessionId() != null && sessions.get(counter.getCurrentSessionId()) != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Counter is busy");
        Session session = sessions.create();
        counter.setCurrentSessionId(session.getSessionId());
        publish(counter, "SESSION_STARTED", session.getSessionId());
        return session;
    }

    public synchronized void end(String counterId, String sessionId) {
        Counter counter = get(counterId);
        if (!sessionId.equalsIgnoreCase(counter.getCurrentSessionId()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This conversation has already ended");
        endSession(sessionId);
    }

    public synchronized void endSession(String sessionId) {
        String id = sessionId.toUpperCase(Locale.ROOT);
        if (sessions.get(id) == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session has ended");
        sessions.end(id);
        broker.convertAndSend("/topic/session/" + id, new MessageEnvelope<>("SESSION_ENDED", id, "SYSTEM", Map.of()));
        counters.values().stream().filter(c -> id.equals(c.getCurrentSessionId())).forEach(c -> {
            c.setCurrentSessionId(null);
            publish(c, "SESSION_ENDED", id);
        });
    }

    @Scheduled(fixedDelay = 60000)
    public synchronized void releaseExpiredSessions() {
        counters.values().stream().filter(c -> c.getCurrentSessionId() != null)
            .filter(c -> sessions.get(c.getCurrentSessionId()) == null).forEach(c -> {
                String id = c.getCurrentSessionId(); c.setCurrentSessionId(null); publish(c, "SESSION_ENDED", id);
            });
    }

    private void save() throws IOException {
        Files.createDirectories(store.getParent());
        Path temp = store.resolveSibling(store.getFileName() + ".tmp");
        var rows = counters.values().stream().map(c -> Map.of("counterId", c.getCounterId(), "label", c.getLabel(), "createdAt", c.getCreatedAt())).toList();
        mapper.writeValue(temp.toFile(), rows);
        Files.move(temp, store, StandardCopyOption.REPLACE_EXISTING);
    }
    private void publish(Counter counter, String type, String id) {
        broker.convertAndSend("/topic/counter/" + counter.getCounterId(),
            Map.of("type", type, "sessionId", id, "counterId", counter.getCounterId(), "sender", "SYSTEM", "timestamp", Instant.now().toString()));
    }
}
