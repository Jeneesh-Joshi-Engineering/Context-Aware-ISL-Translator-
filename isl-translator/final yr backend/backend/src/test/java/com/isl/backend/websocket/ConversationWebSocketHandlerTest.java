package com.isl.backend.websocket;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.isl.backend.gemini.GeminiClient;
import com.isl.backend.logging.KpiLogger;
import java.net.URI;
import java.util.HashMap;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@ExtendWith(MockitoExtension.class)
class ConversationWebSocketHandlerTest {
    @Test void keywordMessageBroadcastsGeneratedSentence() throws Exception {
        GeminiClient gemini = mock(GeminiClient.class); when(gemini.generate(any())).thenReturn(CompletableFuture.completedFuture("Please help me."));
        ConversationWebSocketHandler handler = new ConversationWebSocketHandler(new SessionManager(), gemini, mock(KpiLogger.class), new ObjectMapper());
        WebSocketSession deaf = session("one", "deaf_user"), official = session("two", "official"); handler.afterConnectionEstablished(deaf); handler.afterConnectionEstablished(official);
        handler.handleMessage(deaf, new TextMessage("{\"type\":\"KEYWORD_DETECTED\",\"sessionId\":\"abc\",\"role\":\"deaf_user\",\"keyword\":\"Help\"}"));
        ArgumentCaptor<TextMessage> capture = ArgumentCaptor.forClass(TextMessage.class); verify(deaf).sendMessage(capture.capture()); verify(official).sendMessage(capture.capture());
        org.junit.jupiter.api.Assertions.assertTrue(capture.getAllValues().get(0).getPayload().contains("SENTENCE_GENERATED"));
    }
    @Test void malformedMessageSendsError() throws Exception {
        ConversationWebSocketHandler handler = new ConversationWebSocketHandler(new SessionManager(), mock(GeminiClient.class), mock(KpiLogger.class), new ObjectMapper());
        WebSocketSession deaf = session("one", "deaf_user"); handler.afterConnectionEstablished(deaf);
        handler.handleMessage(deaf, new TextMessage("{\"type\":\"KEYWORD_DETECTED\",\"sessionId\":\"abc\",\"role\":\"deaf_user\"}"));
        ArgumentCaptor<TextMessage> capture = ArgumentCaptor.forClass(TextMessage.class); verify(deaf).sendMessage(capture.capture());
        org.junit.jupiter.api.Assertions.assertTrue(capture.getValue().getPayload().contains("Missing required field"));
    }
    private WebSocketSession session(String id, String role) {
        WebSocketSession session = mock(WebSocketSession.class); when(session.getId()).thenReturn(id); when(session.isOpen()).thenReturn(true); when(session.getUri()).thenReturn(URI.create("ws://localhost/ws/conversation?sessionId=abc&role=" + role)); when(session.getAttributes()).thenReturn(new HashMap<>()); return session;
    }
}
