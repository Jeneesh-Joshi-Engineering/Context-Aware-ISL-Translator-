# Codex Prompt — Contextual Generation Layer: Spring Boot WebSocket + Gemini API (ISL Translation System)

Copy everything below the line into Codex as a single prompt.

---

## Project Context

I am building the **Contextual Generation Layer** for a real-time Indian Sign Language (ISL) translation system. This layer sits between a browser-based frontend (which detects sign-language keywords using an in-browser ML model — not part of this task) and produces natural, grammatically correct sentences using a generative AI API, delivered in real time over WebSocket. **Build only this backend layer.** Do not build any frontend UI, any ML/model code, or the Speech-to-Text feedback logic — those are separate layers built independently.

This backend must be fully testable and runnable **on its own**, without any real frontend connected — I will test it using a simple manual WebSocket client before the rest of the system is ready, so it must not assume a specific frontend implementation, only the message contract defined below.

## Tech Stack (use exactly this)

- Java 17+
- Spring Boot 3.x
- Maven (not Gradle)
- `spring-boot-starter-web`
- `spring-boot-starter-websocket`
- Spring's `WebClient` (from `spring-boot-starter-webflux`, used just for the reactive HTTP client — not to make the whole app reactive) for calling the Gemini API asynchronously, so a slow Gemini response never blocks the WebSocket thread.
- Jackson for JSON (comes with Spring Boot by default).
- `dotenv-java` or standard Spring `application.properties` + environment variable substitution for API key management.

## Project Structure to Create

```
backend/
├── pom.xml
├── src/main/java/com/isl/backend/
│   ├── IslBackendApplication.java          # main entry point
│   ├── config/
│   │   └── WebSocketConfig.java             # registers the WebSocket endpoint
│   ├── websocket/
│   │   ├── SessionManager.java              # tracks connected clients and pairs "deaf-user" + "official" roles into a shared conversation session
│   │   └── ConversationWebSocketHandler.java # handles incoming messages, routes responses
│   ├── gemini/
│   │   ├── GeminiClient.java                # wraps the Gemini API HTTP calls
│   │   └── GeminiRequestBuilder.java        # builds the prompt sent to Gemini
│   ├── model/
│   │   ├── IncomingMessage.java             # DTO for messages from frontend
│   │   ├── OutgoingMessage.java             # DTO for messages sent back to frontend
│   │   └── MessageType.java                 # enum of message types (see contract below)
│   └── logging/
│       └── KpiLogger.java                   # logs context-generation-time KPI per request
├── src/main/resources/
│   └── application.properties
├── src/test/java/com/isl/backend/
│   ├── gemini/GeminiClientTest.java         # tests with a mocked Gemini response, no real API calls
│   └── websocket/ConversationWebSocketHandlerTest.java
└── test-client/
    └── test-client.html                      # a minimal standalone HTML+JS page for manually testing the WebSocket without any other layer
```

## Message Contract (define and implement exactly this — this is the interface the whole team agreed on)

All messages, both directions, are JSON text frames over the WebSocket connection.

**From frontend → backend, when a keyword is recognized:**
```json
{
  "type": "KEYWORD_DETECTED",
  "sessionId": "abc123",
  "role": "deaf_user",
  "keyword": "Help",
  "confidence": 0.91,
  "timestamp": "2026-08-04T10:15:30Z"
}
```
- The frontend may also send a short buffer of multiple keywords in one message (e.g., `"keywords": ["Bank", "Account", "Help"]`) — support **both** a single `keyword` string and a `keywords` array field; if both are absent, reject the message with a clear error response rather than crashing.

**From backend → frontend, once Gemini has generated a sentence:**
```json
{
  "type": "SENTENCE_GENERATED",
  "sessionId": "abc123",
  "originalKeywords": ["Help"],
  "generatedSentence": "I need urgent assistance, please help me immediately.",
  "generationTimeMs": 812,
  "timestamp": "2026-08-04T10:15:31Z"
}
```

**From official's client → backend (transcribed speech, for the bidirectional layer to later hook into — just define and route this message type, don't implement speech-to-text itself):**
```json
{
  "type": "OFFICIAL_RESPONSE",
  "sessionId": "abc123",
  "role": "official",
  "transcribedText": "Sure, please come to counter 3.",
  "timestamp": "2026-08-04T10:16:00Z"
}
```
The backend should simply relay `OFFICIAL_RESPONSE` messages to the other participant(s) in the same `sessionId` without modification — no Gemini processing needed on this direction for this task.

**Error response format (used any time an incoming message is malformed or a downstream call fails):**
```json
{
  "type": "ERROR",
  "sessionId": "abc123",
  "errorMessage": "Missing required field: keyword or keywords",
  "timestamp": "2026-08-04T10:15:30Z"
}
```

## Functional Requirements

### 1. WebSocket Endpoint & Session Management
- Expose a WebSocket endpoint at `/ws/conversation` (raw Spring `WebSocketHandler`, not STOMP — keep this simple).
- Each client connects with a `sessionId` and `role` query parameter (e.g., `/ws/conversation?sessionId=abc123&role=deaf_user`). Roles are `deaf_user`, `official`, or `observer` (observer is for testing/demo — receives all messages but doesn't send).
- `SessionManager` must group connected clients by `sessionId` so a message from one participant is only routed to others in the **same** session — never broadcast across unrelated sessions. This must be built as a thread-safe in-memory map (e.g., `ConcurrentHashMap<String, Set<WebSocketSession>>`), since multiple conversations may run concurrently during a demo/testing.
- On disconnect, clean up the session properly — no memory leak from stale session entries.

### 2. Handling `KEYWORD_DETECTED` Messages
- On receiving this message type, immediately:
  1. Validate the message against the contract (missing fields → send back an `ERROR` message to the sender, do not crash the connection).
  2. Start a timer (for the `generationTimeMs` KPI).
  3. Call the Gemini API asynchronously via `GeminiClient` (see below) — do not block the WebSocket I/O thread while waiting.
  4. On success, stop the timer, build a `SENTENCE_GENERATED` message, and broadcast it to **every** client in that `sessionId` (both the deaf user's and official's screens should see the generated sentence).
  5. On Gemini failure (timeout, API error, rate limit), send an `ERROR` message back with a clear, human-readable reason — never let the WebSocket connection silently hang or drop on a Gemini failure.

### 3. Gemini API Integration (`GeminiClient`, `GeminiRequestBuilder`)
- Read the Gemini API key from an environment variable (`GEMINI_API_KEY`) via `application.properties` (`gemini.api.key=${GEMINI_API_KEY}`) — **never hardcode the key anywhere in source code**, and add a startup check that fails fast with a clear error message if the environment variable is missing, rather than failing confusingly on the first request.
- `GeminiRequestBuilder` constructs the prompt sent to Gemini. Use a system-style instruction along these lines (adjust wording as needed, but preserve the intent):
  > "You are converting isolated Indian Sign Language keywords into a single, natural, polite, grammatically correct sentence appropriate for a banking or public-transit customer service context. Keywords, in the order signed: {keywords}. Respond with ONLY the sentence — no explanation, no quotation marks, no preamble."
- Call the Gemini 2.5 Flash model's REST endpoint using `WebClient`, with a configurable timeout (default 5 seconds) and **1 retry** on transient failure (network error, 5xx) before giving up and returning an error to the caller. Do not retry on 4xx errors (e.g., invalid API key) — surface those immediately.
- Parse the Gemini response and extract just the generated sentence text; handle the case where Gemini's response is empty, malformed, or the sentence looks suspiciously like it includes extra commentary — trim/clean the output before sending it onward.
- `GeminiClient` must be unit-testable **without any real network call** — structure it so the actual HTTP call can be mocked/stubbed in tests (e.g., accept an injected `WebClient` or use an interface).

### 4. KPI Logging (`KpiLogger`)
- Log, for every successfully generated sentence: `sessionId`, original keyword(s), generation time in ms, and timestamp — write these as structured log lines (simple, parseable format, e.g., key=value pairs) so they can later be aggregated into the project's "Context Generation Time" KPI evidence.
- Also log every `ERROR` event (validation failures, Gemini failures) with enough detail to debug later, tagged clearly as `KPI_ERROR` so error-rate can be measured separately from the success-path latency numbers.

### 5. Standalone Test Client (`test-client/test-client.html`)
- Build a minimal, dependency-free HTML+JS page (no frameworks, just plain JS) that:
  - Connects to `ws://localhost:8080/ws/conversation?sessionId=test1&role=deaf_user`.
  - Has a text input + button to manually send a `KEYWORD_DETECTED` message with a typed keyword.
  - Displays every incoming message (formatted, readable) in a log area on the page.
  - This file exists specifically so I can fully test and demo this backend layer **before** the frontend/ML layers are finished — it must work standing completely alone, just needs the backend running locally.

### 6. Error Handling & Resilience
- The server must never crash or drop unrelated client connections because one client sent a malformed message or one Gemini call failed.
- Add basic input sanitization on the `keyword`/`keywords` fields (reject absurdly long strings, strip unexpected characters) before including them in the Gemini prompt — this is a lightweight prompt-injection safeguard, not a full security review, but do not skip it.
- Log (but do not crash on) any unexpected exception in the WebSocket handler — wrap the core message-handling logic in a try/catch that always results in either a normal response or a well-formed `ERROR` message back to the sender.

### 7. Configuration
- `application.properties` should expose, all overridable via environment variables:
  - Server port (default 8080)
  - Gemini API key (required, no default)
  - Gemini request timeout (default 5000ms)
  - Gemini model name/endpoint (so it can be swapped later without code changes)

## Tests

- `GeminiClientTest`: verify prompt construction is correct given sample keywords, and verify the client correctly parses a mocked successful Gemini response as well as correctly surfaces an error on a mocked failure response — no real API calls in tests.
- `ConversationWebSocketHandlerTest`: verify that a valid `KEYWORD_DETECTED` message results in a `SENTENCE_GENERATED` broadcast to all session participants (using a mocked `GeminiClient`), and that a malformed message results in an `ERROR` response rather than a dropped connection.

## Deliverable

A fully runnable Spring Boot application (`mvn spring-boot:run` starts it cleanly given a valid `GEMINI_API_KEY` environment variable), plus the standalone `test-client.html` that lets me manually verify the entire flow — connect, send a fake keyword, see a real Gemini-generated sentence come back over the WebSocket — with zero dependency on any other project layer being finished. Include a `README.md` in `backend/` explaining how to set the API key, run the server, and use the test client.

Do not implement the frontend UI, MediaPipe/BiLSTM code, or Speech-to-Text — this prompt covers the Spring Boot + Gemini backend layer only.
