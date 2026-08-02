# ISL Data Acquisition Layer

This folder contains the browser-only webcam capture layer for building a hand landmark dataset.

## Run It

Serve the `frontend/` folder with any static server, for example:

```bash
npx serve .
```

Open `index.html` through the server URL, not `file://`. Some browsers block camera permissions or ES module imports from local files.

## Record A Session

1. Enter the current sign label.
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
      "label": "Hello",
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
