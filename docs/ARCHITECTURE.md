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
- `GET /api/lectures/{lecture_id}/frames/{filename}`

Generation is deterministic and local. Video upload uses local tooling only:

- System `ffmpeg` or the Python `imageio-ffmpeg` fallback extracts up to 10 keyframes at 30-second intervals.
- RapidOCR scans extracted keyframes locally when available; Tesseract OCR can be used as a fallback.
- Optional `.txt`, `.srt`, or `.vtt` caption files are cleaned and merged into the video timeline.
- If video frames cannot be extracted, the backend returns a fallback timeline with explicit warnings.
- Recent local timelines are listed by reading JSON files in `data/outputs`; no database is used.

No Azure services, auth, database, or external API calls are used in the MVP.
