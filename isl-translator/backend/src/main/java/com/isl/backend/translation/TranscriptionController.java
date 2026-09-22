package com.isl.backend.translation;

import com.isl.backend.session.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Short, in-memory audio requests. The reviewed transcript uses the normal message path. */
@RestController
public class TranscriptionController {
    static final int MAX_AUDIO_BYTES = 4 * 1024 * 1024;
    private final GeminiClient gemini;
    private final SessionService sessions;
    private final Set<String> pending = ConcurrentHashMap.newKeySet();
    private final Semaphore capacity = new Semaphore(4);
    public TranscriptionController(GeminiClient gemini, SessionService sessions) { this.gemini = gemini; this.sessions = sessions; }

    @PostMapping("/api/sessions/{id}/transcribe")
    public CompletableFuture<ResponseEntity<Map<String, String>>> transcribe(@PathVariable String id,
            @RequestParam String language, HttpServletRequest request) throws IOException {
        if (!id.matches("[A-Za-z0-9]{6}") || sessions.get(id) == null) return error(404, "The conversation has ended.");
        if (!sessions.hasClient(id, "OFFICIAL")) return error(409, "Connect the official to this conversation first.");
        if (!language.equals("en-IN") && !language.equals("hi-IN")) return error(400, "Choose English or Hindi.");
        if (!gemini.configured()) return error(503, "Gemini is not configured. Use browser dictation or type your reply.");
        String mime = request.getContentType() == null ? "" : request.getContentType().split(";")[0].trim().toLowerCase(java.util.Locale.ROOT);
        if (!Set.of("audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "audio/mpeg").contains(mime)) return error(415, "This audio format is unsupported. Use browser dictation.");
        if (request.getContentLengthLong() > MAX_AUDIO_BYTES) return error(413, "Recording is too large. Keep each reply under 45 seconds.");
        String sessionKey = id.toUpperCase(java.util.Locale.ROOT);
        if (!pending.add(sessionKey)) return error(429, "A recording is already being transcribed for this conversation.");
        if (!capacity.tryAcquire()) { pending.remove(sessionKey); return error(429, "Speech service is busy. Please retry shortly."); }
        try {
            byte[] audio = request.getInputStream().readNBytes(MAX_AUDIO_BYTES + 1);
            if (audio.length == 0 || audio.length > MAX_AUDIO_BYTES) {
                capacity.release(); pending.remove(sessionKey);
                return error(audio.length == 0 ? 400 : 413, "Record a short spoken reply before transcribing.");
            }
            var session = sessions.get(id);
            return gemini.transcribe(audio, mime, language).handle((text, failure) -> {
                if (sessions.get(id) != session || session == null) return ResponseEntity.status(410).body(Map.of("message", "The conversation has ended."));
                if (failure != null) return ResponseEntity.status(502).body(Map.of("message", "Audio transcription failed. Check the Gemini key, quota and connection, or use browser dictation. Your existing draft is preserved."));
                if (text.isBlank()) return ResponseEntity.unprocessableEntity().body(Map.of("message", "No clear speech was detected. Please record again closer to the microphone."));
                return ResponseEntity.ok(Map.of("transcript", text, "language", language));
            }).whenComplete((value, failure) -> { capacity.release(); pending.remove(sessionKey); });
        } catch (IOException | RuntimeException error) { capacity.release(); pending.remove(sessionKey); throw error; }
    }
    private CompletableFuture<ResponseEntity<Map<String, String>>> error(int status, String message) {
        return CompletableFuture.completedFuture(ResponseEntity.status(status).body(Map.of("message", message)));
    }
}
