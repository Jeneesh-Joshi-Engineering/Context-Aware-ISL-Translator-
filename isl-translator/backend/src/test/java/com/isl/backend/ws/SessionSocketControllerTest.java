package com.isl.backend.ws;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import com.isl.backend.model.*;
import com.isl.backend.session.SessionService;
import com.isl.backend.translation.GeminiClient;
import com.isl.backend.translation.BilingualText;
import com.isl.backend.translation.TemplateFallbackAgent;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class SessionSocketControllerTest {
    @Test void officialRepliesAreBilingualAndStayOrderedAfterSlowTranslation() {
        var sessions = new SessionService(); var session = sessions.create();
        var gemini = mock(GeminiClient.class); var broker = mock(SimpMessagingTemplate.class);
        var first = new CompletableFuture<BilingualText>();
        when(gemini.bilingual(eq("Please wait here."), anyString(), eq(true), anyList())).thenReturn(first);
        when(gemini.bilingual(eq("धन्यवाद।"), eq("hi-IN"), eq(true), anyList())).thenReturn(CompletableFuture.failedFuture(new IllegalStateException("offline")));
        var controller = new SessionSocketController(sessions, broker, gemini, new TemplateFallbackAgent());
        var one = new SpeechTranscriptPayload(); one.text="Please wait here."; one.language="en-IN";
        var two = new SpeechTranscriptPayload(); two.text="धन्यवाद।"; two.language="hi-IN";
        controller.transcript(session.getSessionId(), new MessageEnvelope<>("SPEECH_TRANSCRIPT", session.getSessionId(), "OFFICIAL", one));
        controller.transcript(session.getSessionId(), new MessageEnvelope<>("SPEECH_TRANSCRIPT", session.getSessionId(), "OFFICIAL", two));
        assertTrue(sessions.history(session.getSessionId()).isEmpty());
        verify(gemini, never()).bilingual(eq("धन्यवाद।"), anyString(), anyBoolean(), anyList());
        first.complete(new BilingualText("Please wait here.", "कृपया यहाँ प्रतीक्षा करें।", "gemini"));
        var history=sessions.history(session.getSessionId()); assertEquals(2,history.size());
        assertEquals("Please wait here.",history.get(0).englishText); assertEquals("कृपया यहाँ प्रतीक्षा करें।",history.get(0).hindiText);
        assertEquals("Thank you.",history.get(1).englishText); assertEquals("धन्यवाद।",history.get(1).hindiText);
        assertEquals("offline-phrase", history.get(1).translationMode);
    }
    @Test void unsupportedOfflineTextPreservesSourceWithoutFakeHindi() {
        var fallback = new TemplateFallbackAgent();
        var english = fallback.bilingual("A completely different reply.", "en-IN", true);
        assertEquals("unavailable",english.mode()); assertEquals("A completely different reply.",english.englishText());assertEquals("",english.hindiText());
        var hindi = fallback.bilingual("यह एक अलग जवाब है।", "hi-IN", true);
        assertEquals("यह एक अलग जवाब है।",hindi.hindiText()); assertEquals("",hindi.englishText());
    }
    @Test void predictedGlossBecomesSentenceAndIdleIsIgnored() {
        var sessions=new SessionService(); var session=sessions.create();
        var gemini=mock(GeminiClient.class); var broker=mock(SimpMessagingTemplate.class);
        when(gemini.bilingual(eq("Help"),eq("en-IN"),eq(false),anyList())).thenReturn(CompletableFuture.failedFuture(new IllegalStateException("offline")));
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
        var future=new CompletableFuture<BilingualText>();when(gemini.bilingual(anyString(),anyString(),anyBoolean(),anyList())).thenReturn(future);
        var controller=new SessionSocketController(sessions,broker,gemini,new TemplateFallbackAgent());
        var payload=new KeywordInputPayload();payload.keyword="Train";
        controller.keyword(session.getSessionId(),new MessageEnvelope<>("KEYWORD_INPUT",session.getSessionId(),"SIGNER",payload));
        sessions.end(session.getSessionId()); future.complete(new BilingualText("I need train information.", "मुझे ट्रेन की जानकारी चाहिए।", "gemini"));
        assertNull(sessions.get(session.getSessionId()));verifyNoInteractions(broker);
    }
}
