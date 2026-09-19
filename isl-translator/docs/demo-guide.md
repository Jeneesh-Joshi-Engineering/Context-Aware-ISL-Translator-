# Faculty demonstration guide

## Start

Open PowerShell in the repository root. Run `.\Start-ISLBridge.ps1`. Wait for Spring's Started message. Open `http://localhost:8080/official.html` in Chrome or Edge. If port 8080 is occupied, use `-Port 8081` and change the URL accordingly. Keep the server terminal open.

Create one counter, for example Railway Enquiry — Window 3. Its permanent QR starts a fresh conversation for each visitor. Use **Open signer device** for a same-laptop demonstration. A real second device needs a trusted HTTPS server URL; a localhost QR points back to the phone itself.

## Preflight

1. Open `/diagnostics.html`, run the model-to-backend check, and confirm PASS for Help, Ticket and Train. This uses actual recorded landmarks and deployed model weights. Explain that this verifies integration rather than live recognition accuracy.
2. Click **Check live camera + tracking**, approve camera access and hold a hand in view. Confirm both the camera-open and 126-coordinate messages. Stop the diagnostic camera before starting the signer screen.
3. Open the counter's signer link. Verify Camera, Recognition and Connection independently. Position hands fully in view with good lighting. Perform the trained gesture, then return to idle before repeating it.
4. Show the official receiving the sentence. Type a reply and show it on the signer screen. Speech input is optional and browser-dependent.
5. Open another signer tab to show Busy. End the active conversation and show the next visitor being admitted automatically with the same QR.

## Explain the pipeline

Camera → MediaPipe hand landmarks → wrist-centered normalization → 30 × 126 feature sequence → trained BiLSTM → stable gloss → STOMP WebSocket → backend sentence generator → shared chat.

The model recognizes Help, Ticket, Train and an idle No_Gesture class. It does not support arbitrary ISL sentences. Without a configured Gemini key, sentences come from deterministic local templates and the interface labels that mode. Do not describe that fallback as a successful Gemini call.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Page/backend unavailable | Keep launcher running; check the exact port and `/api/health`. |
| Port already in use | Stop your earlier server with Ctrl+C or launch with `-Port 8081`. |
| PowerShell blocks the script | Run `npm ci`, `npm run assets`, then `mvn -f isl-translator/backend/pom.xml spring-boot:run` from the root. |
| Camera permission pending/denied | Open in Chrome/Edge, allow camera for this origin, check Windows Camera privacy settings and retry. |
| Camera busy | Close other camera apps/tabs and stop the diagnostic camera. |
| Camera blocked on phone | Use trusted HTTPS; plain HTTP over LAN does not permit camera capture. |
| Model or tracker asset error | Run `npm run assets`, restart server, reload. First asset setup needs internet. |
| Model ready but no predictions | Confirm camera and landmarks first. Keep hands in frame, perform only the trained vocabulary, and return to idle between repeated signs. |
| Counter busy | End the active official conversation. Reloading the same signer tab can resume its session. |
| Speech recognition unavailable | Use the typed reply field. |
| Gemini fails | Local sentences remain available; verify the server environment/key/provider separately. |

Counter codes persist locally, but chat history and active sessions reset after backend restart. Keep the backend working directory consistent. End the conversation and stop the server with Ctrl+C after the showcase.
