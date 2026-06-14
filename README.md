# AccessiNote

AccessiNote is a local-first lecture accessibility workbench. It turns a permitted lecture
timeline or pasted transcript into timestamped learning formats such as structured notes,
ADHD-friendly study packs, screen-reader notes, plain-language explanations, exam prep, and
notetaker quality reports.

The current demo is intentionally local only. It does not require API keys, Azure services,
authentication, or a database.

## Run Locally

Start the backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Local MVP

- Load a synthetic sample lecture timeline.
- Paste a custom transcript and create an approximate timeline.
- Upload a slide, screenshot, or board image and scan it with local OCR.
- Upload a permitted video and create a local timeline.
- Attach optional `.txt`, `.srt`, or `.vtt` transcript/caption files to video uploads.
- Generate local captions from video audio with faster-whisper when no transcript/caption file is attached.
- Process video uploads through a local staged job flow with visible progress.
- Select video frames from early coverage, scene changes, transcript keywords, transcript coverage points, and periodic visual coverage.
- OCR original and preprocessed frame variants with bundled local RapidOCR, or Tesseract OCR when installed.
- Preserve a timed caption track and export WebVTT captions.
- Show frame-level OCR confidence, evidence flags, weak chunks, and scan coverage.
- Reopen recent locally generated timelines from `data/outputs`.
- Select an output mode for structured notes, ADHD study support, screen-reader notes, exam prep, plain-language review, or quality reporting.
- Generate deterministic markdown, WebVTT captions, raw evidence JSON, or plain transcript exports.
- Copy or download the generated output.

## Generated Outputs

AccessiNote outputs are designed for review, not clutter. Normal study formats keep source
grounding concise and move long evidence trails into the timeline and Evidence JSON export.

- Structured Notes summarize the lecture focus, key takeaways, definitions, timestamped review
  anchors, and compact source coverage.
- ADHD Study Pack provides a short start path, must-know ideas, a 10-minute review plan, quick
  checks, and overwhelm-recovery steps.
- Screen Reader Notes present the lecture linearly with timestamped visual descriptions, readable
  OCR text, and review warnings for low-confidence visual content.
- Exam Prep builds source-backed flashcards, practice prompts, likely mistakes, and a short review
  plan.
- Plain Language explains the lecture in simpler words with a small set of timestamped stops.
- Notetaker Quality Report scores transcript, OCR, confidence, and weak-evidence coverage so a
  human reviewer can decide what needs attention before sharing.

## Local Video/OCR

Image and video upload work without cloud services. Still-image uploads are treated as one visual
timeline chunk and scanned directly with local OCR when an OCR engine is available. If OCR is not
available, AccessiNote still saves the image and creates a reviewable timeline with a clear note.

Video uploads use a Python-packaged ffmpeg fallback for keyframe extraction when system `ffmpeg` is
not on PATH. Optional `.txt`, `.srt`, or `.vtt` caption files are parsed and used as timed transcript
evidence. If no timed transcript is provided, AccessiNote can generate local captions from the video
audio with faster-whisper. The default model is `tiny.en`; set `ACCESSINOTE_WHISPER_MODEL` to choose
another faster-whisper model. First use may download the selected model before all processing stays
local.

Frame scanning does not use a fixed 30-second stride. AccessiNote starts at `0s`, samples dense
early coverage, detects visual scene changes, then selects timestamps from transcript keywords,
transcript coverage points, and a periodic visual backbone. The default scan budget is 72 selected
timestamps per upload; set `ACCESSINOTE_MAX_VIDEO_FRAMES` to tune it locally. Set
`ACCESSINOTE_SCENE_THRESHOLD` to tune scene-change sensitivity. If frames cannot be extracted,
AccessiNote still creates a fallback timeline from caption/transcript evidence when present.

Video processing exposes local job progress through:

- `POST /api/jobs/media`
- `GET /api/jobs?active=true`
- `GET /api/jobs/{job_id}`
- `POST /api/jobs/{job_id}/cancel`

The older synchronous upload endpoints still work for compatibility.

If local faster-whisper transcription stalls or takes too long for a demo machine, AccessiNote
continues with visual frame scanning after `ACCESSINOTE_TRANSCRIPTION_TIMEOUT_SECONDS` seconds
(default: 180). Jobs that stop reporting progress are marked failed after
`ACCESSINOTE_JOB_STALE_SECONDS` seconds (default: 900), and the frontend will resume active jobs
after a page reload.

RapidOCR runs locally through ONNX Runtime and is installed with the backend requirements. Tesseract
is optional and can be used as a fallback local OCR engine:

```powershell
winget install UB-Mannheim.TesseractOCR
```

## Safety

Use only lecture material you are allowed to process. Do not upload private student data,
exams, accommodation records, or unauthorized recordings. Generated outputs may contain
errors and require human review.
