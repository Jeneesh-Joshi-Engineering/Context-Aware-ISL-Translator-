package com.isl.backend.counter;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.isl.backend.model.MessageEnvelope;
import com.isl.backend.model.TranslatedMessagePayload;
import com.isl.backend.session.SessionService;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.server.ResponseStatusException;

class CounterServiceTest {
    @TempDir Path temp;
    @Test void preservesPrintedIdentityAcrossRestart() throws Exception {
        var broker = mock(SimpMessagingTemplate.class);
        var first = new CounterService(new SessionService(), broker, new ObjectMapper(), temp.resolve("counters.json").toString());
        var counter = first.create("Window 3"); first.start(counter.getCounterId());
        var restored = new CounterService(new SessionService(), broker, new ObjectMapper(), temp.resolve("counters.json").toString());
        assertEquals(counter.getLabel(), restored.get(counter.getCounterId()).getLabel());
        assertEquals(counter.getCreatedAt(), restored.get(counter.getCounterId()).getCreatedAt());
        assertNull(restored.get(counter.getCounterId()).getCurrentSessionId());
    }
    @Test void onlyOneSignerAndEndingNotifiesBothTopics() throws Exception {
        var broker = mock(SimpMessagingTemplate.class); var sessions = new SessionService();
        var service = new CounterService(sessions, broker, new ObjectMapper(), temp.resolve("counters.json").toString());
        var counter = service.create("Window 3"); var session = service.start(counter.getCounterId());
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class, () -> service.start(counter.getCounterId())).getStatusCode());
        service.end(counter.getCounterId(), session.getSessionId());
        assertNull(counter.getCurrentSessionId()); assertNull(sessions.get(session.getSessionId()));
        verify(broker).convertAndSend(eq("/topic/session/" + session.getSessionId()), any(MessageEnvelope.class));
        verify(broker, times(2)).convertAndSend(eq("/topic/counter/" + counter.getCounterId()), any(java.util.Map.class));
        assertNotEquals(session.getSessionId(), service.start(counter.getCounterId()).getSessionId());
    }
    @Test void staleEndCannotCloseTheNextConversation() throws Exception {
        var sessions = new SessionService();
        var service = new CounterService(sessions, mock(SimpMessagingTemplate.class), new ObjectMapper(), temp.resolve("counters.json").toString());
        var counter=service.create("Window 3"); var first=service.start(counter.getCounterId());
        service.endSession(first.getSessionId()); var next=service.start(counter.getCounterId());
        assertThrows(ResponseStatusException.class, () -> service.end(counter.getCounterId(),first.getSessionId()));
        assertEquals(next.getSessionId(),counter.getCurrentSessionId());
        sessions.append(first.getSessionId(),new TranslatedMessagePayload("SIGNER","Late response",""));
        assertNull(sessions.get(first.getSessionId()));
        assertThrows(IllegalArgumentException.class, () -> sessions.joined(first.getSessionId(),"SIGNER"));
    }
}
