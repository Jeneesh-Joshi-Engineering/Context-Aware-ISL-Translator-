# Backend

Use the repository-root `Start-ISLBridge.ps1` launcher. JDK 25 and Maven 3.9+ are required. Spring serves the frontend, model, REST and SockJS/STOMP from one origin. Run `npm ci` and `npm run assets` at the root before building.

## Package and run

From this directory:

```powershell
mvn verify
java -jar target/isl-contextual-backend-0.0.1-SNAPSHOT.jar
```

Default port: 8080; override with `SERVER_PORT`. Open `/official.html`, `/index.html` or `/diagnostics.html`. A packaged JAR includes the prepared browser dependencies. Rebuild after frontend changes; during Maven development, `mvn resources:resources` refreshes static files.

## HTTP contract

| Method and path | Purpose |
| --- | --- |
| GET /api/health | Server health, configured sentence mode, vocabulary |
| POST /api/counters | Create permanent counter; optional JSON `{"label":"Window 3"}` |
| GET /api/counters/{id} | Counter details and currentSessionId |
| POST /api/counters/{id}/sessions | Create active conversation; 409 if busy |
| POST /api/counters/{id}/sessions/{sessionId}/end | End matching conversation |
| POST /api/sessions | Create manual conversation |
| GET /api/sessions/{id}/status | Participant presence |
| GET /api/sessions/{id}/history | Ordered translated messages |
| POST /api/sessions/{id}/end | End manual or counter conversation |

Unknown resources return 404. Connect STOMP using SockJS `/ws`; subscribe to `/topic/session/{id}` and, for the official counter listener, `/topic/counter/{id}`. Client destinations are `/app/session/{id}/join`, `/keyword` and `/transcript`. See `frontend/js/shared.js` for exact message envelopes and `scripts/integration.mjs` for an executable client.

Counters persist to `data/counters.json` relative to the process working directory; override Spring `counter.store` to change it. Sessions and chat history are transient. This faculty prototype has no user authentication; counter/session codes are routing identifiers, not production access controls.

Set `GEMINI_API_KEY` before startup for optional remote sentence generation. Default model is configured in `application.properties`; a missing key, timeout or provider failure uses the local template fallback. Health reports configuration, not proof that the provider accepted a request. Keys stay server-side.
