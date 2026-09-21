# Run and record the word-only demonstration

The active model is `words_v4` (12 words plus idle). The alphabet experiment is archived. Recognition remains a prototype: 39/49 development holdout clips were correct, with weak Help, Security, When and idle recognition. Rehearse live with your actual signer before recording.

## Start

```powershell
cd "C:\BE Project demonstration"
.\Start-ISLBridge.ps1 -Port 8083
```

Wait for Spring's Started message. Open http://localhost:8083/official.html in Chrome or Edge. If the server is already running on this port, use that page rather than starting a second server. Keep the server terminal open. After changing model files, restart the server and refresh both browser tabs.

## Record a short demonstration

1. Create a counter on the official screen, then choose Open signer device. Show the Hello / नमस्ते / नमस्कार greeting page if joining manually.
2. Allow the camera. Confirm Camera, Recognition and Connection show readiness. Use good lighting, hands fully visible, and one sign at a time.
3. Try Ticket or Train, followed by Counter, Entrance, Exit, Money or Receipt. Lower hands between repetitions. Both screens should show the bilingual message.
4. On the official screen, type “Please wait here.” and send it. This phrase has a known English/Hindi offline fallback. Speech input is optional: choose English or Hindi, Listen, Stop, review the transcript, then Send.
5. End the session and show the counter returning to ready for the next visitor.
6. Optionally open http://localhost:8083/diagnostics.html and run the model-to-backend check. Explain that this uses recorded training examples through the actual model; it is not a live accuracy test.

If a word is misrecognized, report it honestly and rehearse another supported word. No current claim is made about continuous sign sentences, alphabet recognition or Marathi translation; Marathi is a greeting on the page.

## Verification completed for this build

- All six JavaScript model/speech tests passed when run directly.
- All 15 Java tests passed; Maven verify completed and produced the application package.
- TensorFlow.js matched Python on all 49 held-out inputs (maximum difference 2.384185791015625e-7).
- The integration test passed all 12 actual classifier outputs through the running backend and both WebSocket clients, plus English/Hindi replies, busy state, session ending, next signer and manual sessions.
- Server health vocabulary matched the deployed metadata. Served model weights matched the local SHA-256. Signer, official and diagnostic pages returned HTTP 200.
- Gemini configuration was reported present; this does not prove successful provider calls, since supported messages may use fallback. Actual physical-camera recognition and microphone transcription were not verified in this automated run.

See [per-class results](word-model-results.md), [48-hour collection plan](dataset-plan-48-hours.md), and [archive notes](../model-training/archive/alphabet-expanded-v3/README.md).
