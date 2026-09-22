# ISL Bridge — counter-based sign assistance

A Spring Boot server serves both browser screens, REST APIs and WebSocket messaging. The signer browser runs MediaPipe and the trained BiLSTM locally. Recognized glosses travel to the backend, which returns English sentences to both participants.

## Run on Windows

Install JDK 25, Maven 3.9+, and Node.js 22+ with npm. Check `java -version`, `mvn -version`, and `node --version` in a new PowerShell window. Maven must report Java 25 or newer.

From this repository's root:

```powershell
.\Start-ISLBridge.ps1
```

Wait for Spring's **Started** message, then open http://localhost:8080/official.html in Chrome or Edge. The first run needs internet to install dependencies and download MediaPipe assets. Later runs use local assets; the included sentence fallback works without a Gemini key. If port 8080 is occupied, use `.\Start-ISLBridge.ps1 -Port 8081` and open port 8081 instead. Keep that terminal open; Ctrl+C stops the application.

No Live Server, Python server, separate ML server, or separate frontend server is needed. Do not open the HTML files directly.

## Demonstrate

1. On the official screen, create a counter with a label. Keep its permanent `CTR-…` code and QR sign.
2. Click **Open signer device** for a same-computer demonstration. The official screen opens the conversation automatically. Allow camera access on the signer screen.
3. Keep both hands within view and perform a recorded vocabulary sign such as **Help**, **Ticket**, **Train**, **Counter**, **Entrance**, **Exit**, **Money**, **Receipt**, **Security**, **Police**, **Where**, or **When**. The model uses 30 landmark frames, requires stable confidence, and sends each held sign once. Return to idle before repeating the same sign.
4. Watch the Camera, Recognition and Connection indicators separately. Both screens receive the same English message. The official can type a reply or select English/Hindi, press Listen, speak, Stop, review and Send. Both screens show English and Hindi. Browser speech recognition may need internet.
5. End the conversation. The official screen returns to Ready; the same counter QR can serve the next visitor. A second visitor sees Busy until the counter is free.

For a signer on Android Chrome, keep the server running and run `.\Start-PhoneAccess.ps1` in a second PowerShell window. Open the generated HTTPS address with `/official.html`, or paste its base address into **Use a signer's phone / set phone link** on the local official screen. Scan the updated QR, tap **Start / retry camera**, and allow access. Keep both terminals open; the temporary URL changes after restarting the tunnel. `localhost` and plain HTTP LAN addresses cannot provide phone camera access. See the [phone and speech guide](isl-translator/docs/mentor-suggestions.md) for complete steps and permanent-deployment limits.

## Verify before presenting

Open http://localhost:8080/diagnostics.html and click **Run model → backend check**. It runs actual recorded landmark sequences through the deployed weights and checks returned chat messages. Expected fallback output:

| Model gloss | Backend sentence |
| --- | --- |
| Help | I need help, please. |
| Ticket | I need help with my ticket. |
| Train | I need information about the train. |
| No_Gesture | Suppressed; no sentence sent |

Use **Check live camera + tracking** separately and hold a hand in view. A recorded-input pass does not establish that your physical camera is allowed or that live signs will be classified correctly.

Automated checks from the root (start the server before the integration check):

```powershell
npm ci
npm run assets
npm test
mvn -f isl-translator/backend/pom.xml verify
$env:ISL_BACKEND = 'http://localhost:8080'
npm run test:integration
```

## Sentence engine and model limits

Without `GEMINI_API_KEY`, the app explicitly shows **offline sentences** and uses deterministic templates. To enable Gemini, set that environment variable in the terminal before starting the server; optional settings are `GEMINI_MODEL` and `GEMINI_TIMEOUT_MS`. Alternatively copy `.env.example` to `.env` at the repository root and set the key there; startup reads this local file. Never place a key in frontend code or commit it. Provider failures fall back to templates.

The active model is `words_v5`: 23 service words plus No_Gesture (24 classes), with a 60% confidence gate. Previous models are archived. It recognizes individual glosses; it does not interpret unrestricted ISL sentences. Current development-test accuracy is **68/87 (78.16%)**. Flight, Pay and When had zero recall on their small test subsets; live reliability needs further data. The chronological split is not signer-independent. See [per-class results](isl-translator/docs/word-model-results.md), [model provenance](isl-translator/frontend/model/README.md), and the [48-hour collection plan](isl-translator/docs/dataset-plan-48-hours.md).

## Hosted prototype

The Dockerfile and Render configuration deploy this same application behind HTTPS from `prototype-in-deployment`. Read the [deployment and handover guide](isl-translator/docs/prototype-deployment.md) for access codes, server-side Gemini configuration, phone use, verification and free-host limitations. Local launch instructions above remain valid. General translation can be unavailable when Gemini returns a rate/quota error; supported word phrase translations still work.

Counter identifiers persist in `isl-translator/backend/data/counters.json` when using the launcher. Conversation history is in memory and resets when the server restarts. Runtime data, installed dependencies and generated browser assets are intentionally excluded from Git; source code, the lockfile, trained browser weights and asset preparation scripts are tracked.

See the [faculty demo guide](isl-translator/docs/demo-guide.md) for troubleshooting and the [backend guide](isl-translator/backend/README.md) for endpoints and packaging.

## Faculty finishing pass

The [mentor refinements guide](isl-translator/docs/mentor-suggestions.md) covers Android phone access, microphone recording through Gemini, browser dictation, and verification results. With a configured key, recorded Gemini speech is selected by default; review the transcript before sending. The verified model default is now `gemini-3.6-flash` because the API rejected the previous model for this account. Update existing `.env` files and restart; keys stay local and ignored.

See [speech and bilingual setup/verification](isl-translator/docs/transcription-and-bilingual.md) and the [path-to-market punch list](isl-translator/docs/path-to-market.md). Arbitrary bilingual replies require a working Gemini configuration. The offline phrasebook supports the listed counter phrases; unsupported messages preserve the source and explicitly show translation unavailable.
