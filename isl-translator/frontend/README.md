# Browser application

The Spring backend serves this directory. Start from the repository-root launcher and open `/official.html`. No frontend development server is required.

- `official.html`: permanent counter setup, printable QR, automatic visitor connection, speech/typed replies.
- `index.html?counter=CTR-…`: signer automatic join, busy recovery, camera, live landmarks, BiLSTM and shared chat.
- `diagnostics.html`: real recorded-input model-to-backend check and separate physical camera/tracking check.
- `about.html`: supported prototype scope.

Run root `npm ci` then `npm run assets` to generate pinned local JavaScript, MediaPipe WASM/task assets and recorded diagnostic fixtures. Generated `vendor/` and `fixtures/` are not tracked. The trained `model/` files are tracked.

Camera capture requires localhost or trusted HTTPS plus browser permission. Chrome/Edge are the intended demonstration browsers. An HTTP LAN-IP URL will not work for camera capture on a phone. The permanent counter QR uses the current page's origin, so deploy at the final HTTPS origin before printing for multiple devices.

Landmarks are normalized into 126 coordinates per frame. Thirty frames feed a two-layer bidirectional LSTM. Only stable Help, Ticket or Train predictions reach the backend; No_Gesture is idle. The browser does not send camera video to the server. The official speech API may use the browser's speech service; typed replies remain available if speech recognition is unsupported.

Use the three separate indicators to diagnose problems: Camera (capture), Recognition (tracker/model), Connection (backend/session). Errors offer explicit retry controls. A model-ready badge alone does not mean camera permission has been granted.
