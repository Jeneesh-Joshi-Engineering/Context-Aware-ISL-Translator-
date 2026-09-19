package com.isl.backend.ws;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import com.isl.backend.model.*;
import com.isl.backend.session.SessionService;
import com.isl.backend.translation.GeminiClient;
import com.isl.backend.translation.TemplateFallbackAgent;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class SessionSocketControllerTest {
    @Test void predictedGlossBecomesSentenceAndIdleIsIgnored() {
        var sessions=new SessionService(); var session=sessions.create();
        var gemini=mock(GeminiClient.class); var broker=mock(SimpMessagingTemplate.class);
        when(gemini.generate(eq("Help"),anyList())).thenReturn(CompletableFuture.failedFuture(new IllegalStateException("offline")));
        var controller=new SessionSocketController(sessions,broker,gemini,new TemplateFallbackAgent());
        var payload=new KeywordInputPayload();payload.keyword="Help";
        controller.keyword(session.getSessionId(),new MessageEnvelope<>("KEYWORD_INPUT",session.getSessionId(),"SIGNER",payload));
        assertEquals("I need help, please.",sessions.history(session.getSessionId()).getFirst().englishText);
        verify(broker).convertAndSend(eq("/topic/session/"+session.getSessionId()),any(MessageEnvelope.class));
        payload.keyword="No_Gesture";
        controller.keyword(session.getSessionId(),new MessageEnvelope<>("KEYWORD_INPUT",session.getSessionId(),"SIGNER",payload));
        assertEquals(1,sessions.history(session.getSessionId()).size());
    }
    @Test void lateGeminiCompletionCannotReviveEndedSession() {
        var sessions=new SessionService();var session=sessions.create();var broker=mock(SimpMessagingTemplate.class);var gemini=mock(GeminiClient.class);
        var future=new CompletableFuture<String>();when(gemini.generate(anyString(),anyList())).thenReturn(future);
        var controller=new SessionSocketController(sessions,broker,gemini,new TemplateFallbackAgent());
        var payload=new KeywordInputPayload();payload.keyword="Train";
        controller.keyword(session.getSessionId(),new MessageEnvelope<>("KEYWORD_INPUT",session.getSessionId(),"SIGNER",payload));
        sessions.end(session.getSessionId()); future.complete("I need train information.");
        assertNull(sessions.get(session.getSessionId()));verifyNoInteractions(broker);
    }
}
