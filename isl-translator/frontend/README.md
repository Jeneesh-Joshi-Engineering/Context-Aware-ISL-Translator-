# ISL Bridge Frontend

This folder now contains two synchronized static apps for the session-broker backend:

- `index.html` — signer device: creates a session, shares its QR/code, then starts the camera and BiLSTM translation view after the official joins.
- `official.html` — official device: scans or enters a session code, receives the same chat stream, and sends voice or typed responses.

Both pages use `js/shared.js` for STOMP-over-SockJS transport, session-history backfill, reconnect status, and the shared bilingual chat renderer. The backend is expected at port `8080` on the same host name as the static app.

## Run It

Serve the `frontend/` folder with any static server, for example:

```bash
npx serve .
```

Open `index.html` and `official.html` through the server URL, not `file://`. Some browsers block camera permissions, QR scanning, or ES module imports from local files. Start the Spring Boot backend first, then open the two pages (on separate devices if desired).

## Record A Session

1. Type any sign label you want to collect. The label is saved exactly as typed after trimming extra spaces.
2. Adjust the recording duration if needed.
3. Press `Start Recording` or hit `Space`.
4. Hold the gesture until the countdown ends, or press `Space` again to stop early.
5. Use `Discard Last Sequence` if you want to remove the most recent capture.

## Export Format

### JSON

The JSON download is named `isl_dataset_<timestamp>.json` and uses this schema:

```json
{
  "schema": "isl.data-acquisition.v1",
  "exportedAt": "2026-08-01T00:00:00.000Z",
  "sequenceCount": 1,
  "targetFrameCount": 30,
  "frameVectorLength": 126,
  "sequences": [
    {
      "label": "Train_Ticket",
      "timestamp": "2026-08-01T00:00:00.000Z",
      "handedness": ["Right"],
      "frames": 30 arrays of 126 numeric values
    }
  ]
}
```

Each `frames` entry is exactly 30 arrays long, and each frame contains 126 numeric values.

### CSV

The CSV export is flattened for pandas-style loading. Each row represents one frame and includes:

- `sequence_id`
- `label`
- `frame_index`
- `hand1_x0` through `hand2_z20`
- `handedness1`
- `handedness2`

## Privacy

Raw video frames are never exported. Only numeric landmark vectors and metadata are stored or downloaded.
