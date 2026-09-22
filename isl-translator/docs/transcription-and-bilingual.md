# Transcription and bilingual finishing pass

**Current update:** see [mentor refinements](mentor-suggestions.md) for the new recorded-audio option, verified `gemini-3.6-flash` configuration, Android HTTPS launcher and the latest verification limits. The original browser-dictation checks below remain relevant to that selectable mode.

## Diagnosis

The old official client left `continuous` at its single-result default, read only `event.results[event.resultIndex]`, overwrote the reply field, and immediately sent each final fragment. It had no restart after a speech-service end and only used `en-IN`. These are confirmed code defects that can truncate speech at pauses or lose result segments. They do not prove which browser, permission or microphone condition caused a particular user's failed attempt.

The new toggle controller collects all results, keeps final segments across bounded restarts, retains interim text for review, and waits for stop completion. It never sends partial speech automatically. Choose English (India) or Hindi, press Listen, speak with pauses, press Stop, review/edit and Send. Permission denial, missing microphone, no speech, unsupported language and speech-service network errors have specific messages. Ending/changing a conversation invalidates old callbacks.

In the embedded browser the real speech API started listening, then returned a network error. Automated speech events test accumulation and transport but are not a substitute for a successful physical microphone test in Chrome/Edge.

## Bilingual contract

Both signer glosses and official replies now use the server-side Gemini client with a JSON schema requiring `englishText` and `hindiText`. The prompt distinguishes gloss restructuring from faithful reply translation. Empty/malformed provider responses are rejected. A session queue prevents asynchronous provider calls from reversing message order. Both chat views show language labels and `lang=en` / `lang=hi` text.

Three known signs have real local Hindi fallbacks. Supported offline official phrases are: “Please go to platform three”, “Please wait here”, “Please show me your ticket”, “How can I help you?”, “The ticket counter is on your left”, “The train arrives soon”, and “Thank you”, plus their Hindi equivalents. Punctuation/case/extra spacing are normalized. Offline phrases are marked in chat. Arbitrary replies require the configured translation provider; on failure the original is preserved with an explicit translation-unavailable label. Empty or fabricated Hindi is never labeled as a successful translation.

## Configure Gemini locally

Copy root `.env.example` to `.env`, set `GEMINI_API_KEY` locally and restart the server. Spring reads the file from the root or from the backend working directory. `.env` is ignored by Git. `GEMINI_TIMEOUT_MS=12000` allows more time for bilingual replies. The UI's configured status describes configuration, not successful provider authentication.

## Verification

- `npm test`: production speech-controller events (pause/restart, final/interim, Hindi, denial, network/audio errors, stop timeout, late callbacks) plus original model regression tests.
- `mvn -f isl-translator/backend/pom.xml test`: bilingual HTTP adapter against a local mock provider, malformed output rejection, ordered delayed replies, Hindi/English fallback, end-session guards, and existing backend tests.
- `npm run test:integration` against the running server: actual BiLSTM → gloss → bilingual message; simulated multi-segment speech → final reply → bilingual backend; matching payloads on two real WebSocket clients; counter and manual workflows.
- `/diagnostics.html`: actual browser model outputs with both language lines. Run a separate human microphone check before presenting: say “Please go” (pause) “to platform three”, Stop, Send, and verify the whole reply on both screens. Repeat with Hindi selected.

API references: [SpeechRecognition lifecycle and browser limitations](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [continuous recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/continuous), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).

See [path to market](path-to-market.md) for the faculty punch list.
