package com.isl.backend.translation;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import com.isl.backend.session.SessionService;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class TranscriptionControllerTest {
    private MockHttpServletRequest audio(String mime, byte[] bytes) {
        var request = new MockHttpServletRequest(); request.setContentType(mime); request.setContent(bytes); return request;
    }
    @Test void boundedAudioRequiresLiveOfficialAndSupportedLanguageAndFormat() throws Exception {
        var client=mock(GeminiClient.class);when(client.configured()).thenReturn(true);
        var sessions=new SessionService();var id=sessions.create().getSessionId();var controller=new TranscriptionController(client,sessions);
        assertEquals(409,controller.transcribe(id,"en-IN",audio("audio/webm",new byte[3])).join().getStatusCode().value());
        sessions.rememberClient("socket",id,"OFFICIAL");
        assertEquals(400,controller.transcribe(id,"xx",audio("audio/webm",new byte[3])).join().getStatusCode().value());
        assertEquals(415,controller.transcribe(id,"hi-IN",audio("text/plain",new byte[3])).join().getStatusCode().value());
        assertEquals(400,controller.transcribe(id,"hi-IN",audio("audio/webm",new byte[0])).join().getStatusCode().value());
        assertEquals(413,controller.transcribe(id,"hi-IN",audio("audio/webm",new byte[4*1024*1024+1])).join().getStatusCode().value());
        verify(client,never()).transcribe(any(),anyString(),anyString());
    }
    @Test void oneInFlightPerSessionAndEndedConversationCannotReceiveLateText() throws Exception {
        var client=mock(GeminiClient.class);when(client.configured()).thenReturn(true);
        var future=new CompletableFuture<String>();when(client.transcribe(any(),eq("audio/webm"),eq("hi-IN"))).thenReturn(future);
        var sessions=new SessionService();var id=sessions.create().getSessionId();sessions.rememberClient("socket",id,"OFFICIAL");
        var controller=new TranscriptionController(client,sessions);
        var pending=controller.transcribe(id,"hi-IN",audio("audio/webm;codecs=opus",new byte[3]));
        assertEquals(429,controller.transcribe(id,"hi-IN",audio("audio/webm",new byte[3])).join().getStatusCode().value());
        sessions.end(id);future.complete("कृपया यहाँ प्रतीक्षा करें।");assertEquals(410,pending.join().getStatusCode().value());
    }
    @Test void returnsReviewableTextWithoutAddingChatAndDoesNotExposeProviderErrors() throws Exception {
        var client=mock(GeminiClient.class);when(client.configured()).thenReturn(true);
        var sessions=new SessionService();var id=sessions.create().getSessionId();sessions.rememberClient("socket",id,"OFFICIAL");
        var controller=new TranscriptionController(client,sessions);
        when(client.transcribe(any(),anyString(),anyString())).thenReturn(CompletableFuture.completedFuture("Please wait here."));
        var response=controller.transcribe(id,"en-IN",audio("audio/wav",new byte[3])).join();
        assertEquals("Please wait here.",response.getBody().get("transcript"));assertTrue(sessions.history(id).isEmpty());
        when(client.transcribe(any(),anyString(),anyString())).thenReturn(CompletableFuture.failedFuture(new RuntimeException("secret-provider-detail")));
        var failure=controller.transcribe(id,"en-IN",audio("audio/wav",new byte[3])).join();
        assertEquals(502,failure.getStatusCode().value());assertFalse(failure.getBody().toString().contains("secret-provider-detail"));
        when(client.transcribe(any(),anyString(),anyString())).thenReturn(CompletableFuture.completedFuture(""));
        assertEquals(422,controller.transcribe(id,"en-IN",audio("audio/wav",new byte[3])).join().getStatusCode().value());
    }
}
