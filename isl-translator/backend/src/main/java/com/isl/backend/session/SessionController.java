package com.isl.backend.session;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "*")
public class SessionController {
    private final SessionService sessions;
    public SessionController(SessionService sessions) { this.sessions = sessions; }
    @PostMapping public Map<String, String> create() { return Map.of("sessionId", sessions.create().getSessionId()); }
    @GetMapping("/{sessionId}/history") public Map<String, Object> history(@PathVariable String sessionId) { try { var messages = sessions.history(sessionId); if (messages == null) throw notFound(); return Map.of("messages", messages); } catch (IllegalArgumentException ex) { throw notFound(); } }
    @GetMapping("/{sessionId}/status") public Object status(@PathVariable String sessionId) { try { var status = sessions.status(sessionId); if (status == null) throw notFound(); return status; } catch (IllegalArgumentException ex) { throw notFound(); } }
    private ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"); }
}
