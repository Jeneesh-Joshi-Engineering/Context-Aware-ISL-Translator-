# Mentor refinements: speech and signer phones

## Start on the laptop

Open PowerShell at the repository root and run:

```powershell
.\Start-ISLBridge.ps1
```

Wait for `Started`. Open `http://localhost:8080/official.html` in Chrome or Edge. Create or reclaim your counter. If you use another port, use the same `-Port` in both launchers.

For phone access, open a second PowerShell window in the repository root:

```powershell
.\Start-PhoneAccess.ps1
```

This downloads the official Cloudflare utility into `.cache` on first use and verifies its GitHub release SHA256 digest before running it. It does not install a system service or change firewall rules. A trusted `https://…trycloudflare.com` address appears in the terminal.

Either open that address followed by `/official.html` on the laptop, or expand **Use a signer's phone / set phone link** on the local official screen and paste only the HTTPS base address. Click **Update phone QR**. Reclaiming the same counter code on the HTTPS official page is necessary because browser storage belongs to each origin.

Scan the QR with the Android phone camera and **open in Chrome**, not an embedded QR/WhatsApp browser. Tap **Start / retry camera**, allow camera permission, and keep the page visible. Camera, Recognition and Connection should become ready. Keep hands and upper body in frame, prop the phone upright, and use good lighting. A kiosk is not required; the laptop/server and an official still need to be online.

Keep both PowerShell windows open. Ctrl+C stops the corresponding server or sharing process. The temporary HTTPS URL changes each time the tunnel starts: update/re-scan the QR after restarting. The counter code itself persists on the backend. For permanent station signage, use a stable HTTPS deployment or named tunnel with authentication, not a temporary quick tunnel. Temporary access is intended only for invited demonstration participants; this prototype is not an authenticated public service.

`localhost` on a phone means the phone itself. A laptop LAN address over plain HTTP may load HTML but cannot provide the secure context Android Chrome requires for its camera. The UI now hides the unusable phone QR for such origins; the desktop link still works.

## Official speech and translation

1. Connect a signer and select the actual speaking language: **English (India)** or **Hindi**.
2. When a Gemini key is configured, **Record with Gemini** is selected by default. Press **Listen**, allow microphone permission, speak a short reply (maximum 45 seconds), then **Stop**. Audio goes to the backend and Gemini for transcription; it is not stored as a file by the application. **Cancel** stops waiting during transcription.
3. Review/edit the complete transcript in the multiline reply box. Check names, platform numbers, times and negation. Press **Send**. Translation then follows the existing ordered conversation path; both screens receive the same English/Hindi message. The original-language text is preserved exactly.
4. **Browser dictation** remains available, including when no Gemini key is configured. It accumulates text across pauses but depends on the browser's speech service. If it reports a network error, switch to **Record with Gemini**, record again, or type.

Microphone audio in recorded mode is transmitted only after Stop/automatic completion, not continuously. Existing drafts survive denial, provider failure and cancelled transcription. Ending or changing the conversation invalidates late results. Camera images still remain local to the signer browser.

The server accepts only supported audio types, up to 4 MiB, for a session with a connected official. It limits concurrent transcription requests and rejects duplicate in-flight requests per session. This is a resource guard, not production authentication. Silence/unintelligible output produces an explicit retry message, never an invented reply. Speech recognition is probabilistic: review remains necessary.

## Gemini configuration and reliability

The local ignored `.env` file holds `GEMINI_API_KEY`. Do not put it in the frontend, screenshots or Git. Restart the backend after configuration changes.

On 22 September 2026, the API rejected this project's `gemini-2.5-flash` configuration with HTTP 404 and explicitly recommended `gemini-3.6-flash`. The recommended replacement was tested successfully. `.env.example` and the application default now use that model. Existing clones must update their own `GEMINI_MODEL=gemini-3.6-flash`; application defaults do not override an existing `.env` value.

Text translation has a configurable overall timeout (12 seconds by default); recorded-audio transcription has a 30-second provider timeout. Transient network/408/429/5xx failures get at most two retries within those overall deadlines. Authentication and unavailable-model errors are not retried. Sustained failures retain the original message and explicitly mark translation unavailable, or use a labelled supported offline phrase. A configured-key badge is not a claim of service availability.

Live testing also encountered HTTP 503 (high demand) and HTTP 429 (rate/quota limit), including failed combined audio-and-translation runs. Successful individual audio and bilingual tests do not establish uninterrupted provider availability. Recorded mode uses one provider request for transcription and another after Send for translation; browser dictation uses the provider only for translation. If limits recur, wait for the account limit to reset, use browser dictation/typed supported offline phrases, or review the account quota. No billing changes were made. Backend warnings log only the failure category/status, never recordings, message bodies or keys.

## Verification

```powershell
npm test
mvn -f isl-translator/backend/pom.xml test
npm run test:integration
# Optional real-provider check (uses your configured key):
node scripts/verify-live-speech.mjs
# Add an explicit short WAV fixture to verify real audio transcription:
node scripts/verify-live-speech.mjs path-to-sample.wav en-IN
```

Set `ISL_BACKEND` to a different local or HTTPS origin to test that deployment. The live-provider script requires `translationMode=gemini`; it fails if the result is merely a fallback. The existing model integration suite intentionally also covers fallback operation.

Verified during this change:

- 11 JavaScript tests: model regression, speech events, phone-link validation and recorder cancellation/failure/late-permission handling.
- 18 Java tests: existing flows plus bounded transcription requests, concurrent/ended-session behavior, source preservation, audio payload parsing and transient-provider retry.
- Real BiLSTM fixtures through the backend to two WebSocket clients, busy/next-visitor/manual-session checks.
- Actual Gemini transcription of a locally synthesized English WAV. This checks real audio handling, not a physical microphone or speaker-independent speech accuracy.
- Actual English-to-Hindi and Hindi-to-English provider responses on both clients, including platform numbers and negation.
- HTTPS endpoint and signer assets reachable through the real tunnel; 390-pixel responsive layout checked without horizontal overflow.
- The user tested Android Chrome on the HTTPS counter link and reported that it recognized and translated well. This is a functional trial, not a measured mobile accuracy/latency benchmark.

Not established: physical official-microphone accuracy, Hindi-audio transcription accuracy, iPhone/Safari acceptance, a general speech error rate, provider uptime or production deployment readiness. No new model training or recognition-threshold changes are included.

References for deployment/API behavior: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/), [camera secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [Gemini audio](https://ai.google.dev/gemini-api/docs/audio), [Generate Content API](https://ai.google.dev/api/generate-content).
