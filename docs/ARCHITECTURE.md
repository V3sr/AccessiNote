# Architecture

AccessiNote currently runs as a local two-process app:

- `backend/`: FastAPI API with Pydantic models and local JSON storage.
- `frontend/`: Next.js App Router UI for loading timelines, creating transcript timelines, and rendering generated markdown.
- `data/samples/`: synthetic demo lecture timeline.
- `data/outputs/`: ignored local generated timelines.
- `data/uploads/`: reserved ignored local upload folder.

The backend exposes:

- `GET /health`
- `GET /api/lectures/sample`
- `GET /api/lectures`
- `POST /api/lectures`
- `GET /api/lectures/{lecture_id}`
- `POST /api/lectures/{lecture_id}/generate`
- `GET /api/capabilities`
- `POST /api/videos/upload`
- `POST /api/images/upload`
- `GET /api/lectures/{lecture_id}/frames/{filename}`

Generation is deterministic and local. Video upload uses local tooling only:

- System `ffmpeg` or the Python `imageio-ffmpeg` fallback extracts selected keyframes from the uploaded video.
- RapidOCR scans extracted keyframes locally when available; Tesseract OCR can be used as a fallback.
- Optional `.txt`, `.srt`, or `.vtt` caption files are parsed and merged into the video timeline.
- When no caption/transcript file is supplied, faster-whisper can generate local timed captions from the video audio.
- Frame selection starts at `0s` and combines early coverage, transcript keyword points, transcript coverage points, and periodic visual coverage instead of a fixed 30-second stride.
- The default frame selection budget is 72 timestamps and can be tuned with `ACCESSINOTE_MAX_VIDEO_FRAMES`.
- Generated or uploaded caption segments are stored on the local timeline as `caption_segments` and can be exported as WebVTT.
- If video frames cannot be extracted, the backend returns a fallback timeline with explicit warnings.
- Recent local timelines are listed by reading JSON files in `data/outputs`; no database is used.

No Azure services, auth, database, or external processing APIs are used in the MVP. The first
faster-whisper run may download the selected model artifact before local transcription runs.
