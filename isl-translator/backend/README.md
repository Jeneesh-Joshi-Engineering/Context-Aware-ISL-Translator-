# ISL Contextual Generation Backend

This standalone Spring Boot service turns ISL keyword messages into polite contextual sentences through Gemini and delivers all messages over a raw WebSocket endpoint.

## Run

Use Java 17 or later and Maven. Set a Gemini API key, then start the service:

```powershell
$env:GEMINI_API_KEY = "your-key"
cd backend
mvn spring-boot:run
```

The service fails at startup with a clear error if `GEMINI_API_KEY` is not supplied. Optional configuration environment variables are `SERVER_PORT` (default `8080`), `GEMINI_TIMEOUT_MS` (default `5000`), `GEMINI_MODEL`, and `GEMINI_ENDPOINT`.

## WebSocket contract

Connect to `ws://localhost:8080/ws/conversation?sessionId=abc123&role=deaf_user`. Valid roles are `deaf_user`, `official`, and read-only `observer`. Clients only receive messages belonging to their own `sessionId`.

Send a keyword message such as:

```json
{"type":"KEYWORD_DETECTED","sessionId":"abc123","role":"deaf_user","keyword":"Help","timestamp":"2026-08-04T10:15:30Z"}
```

`keywords` may be supplied as an array instead of `keyword`. `OFFICIAL_RESPONSE` messages from an `official` are relayed unchanged to the other clients in that session.

## Manual test page

With the backend running, open `test-client/test-client.html` in a browser. It connects as `deaf_user` in session `test1`, lets you submit a keyword, and prints every response. Open a second WebSocket client as `official` or `observer` with the same session ID to see broadcasts.

## Tests

```powershell
mvn test
```

Tests mock Gemini-related behavior and make no external API requests.
