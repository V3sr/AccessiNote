# Hackathon Submission

## Project Description

AccessiNote is a local-first lecture accessibility workbench with optional Microsoft IQ provider
support. It turns permitted lecture videos, slides, screenshots, captions, or transcripts into
reviewable evidence timelines and accessible learning outputs for different study needs.

The app focuses on the Microsoft Agents League Creative Apps + Accessibility path and the
Accessibility Award: it prioritizes multimodal extraction quality, transparent source grounding,
human review, and a polished local demo that does not require external API keys.

## Required Submission Fields

Use this section to fill the contest platform submission.

| Required item | AccessiNote artifact | Status |
| --- | --- | --- |
| Project description | This file, `README.md`, and the "Project Description" section above | Ready |
| Features, functionality, problem solved, technologies used | "What It Does" and "Technologies Used" below | Ready |
| Demo video link on YouTube or Vimeo | Record with `docs/DEMO.md`, then paste the URL here | Pending: add URL before submission |
| Public GitHub repository | Make the repo public, then paste the URL here | Pending: add URL before submission |
| Architecture diagram | `docs/ARCHITECTURE.md` Mermaid diagram | Ready |
| Microsoft IQ usage | Azure AI Speech, Azure AI Vision, Azure OpenAI; GitHub Copilot if actually used by the team | Ready, with Copilot truthfulness note |
| Team member information | Add Microsoft Learn usernames in the contest platform if submitting as a team | Pending if applicable |

Demo video URL: `TODO`

Public GitHub repository URL: `TODO`

Team / Microsoft Learn usernames: `TODO if applicable`

## What It Does

- Loads a synthetic sample lecture for a reliable demo baseline.
- Accepts pasted transcripts and creates timestamped local timelines.
- Uploads images/slides and scans them with local OCR.
- Uploads permitted videos through a staged local media job flow.
- Generates local captions with faster-whisper when captions are not uploaded.
- Selects video frames from early coverage, scene changes, transcript keywords, coverage points, and periodic visual coverage.
- Runs OCR on original and preprocessed frames with RapidOCR and optional Tesseract.
- Aligns transcript/caption, OCR, keyframe, concept, confidence, and warning evidence into one timeline.
- Generates structured notes, ADHD study packs, screen-reader notes, exam prep, plain-language notes, notetaker quality reports, WebVTT captions, Evidence JSON, and plain transcripts.
- Shows a demo-readiness panel for local tools, recent video processing, exports, and optional Microsoft provider configuration.
- Lets users enter their own Azure provider keys through a session-only UI without exposing secrets to the browser.

## Technologies Used

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui-style primitives, lucide icons.
- Backend: FastAPI, Pydantic, local JSON storage.
- Media processing: ffmpeg or imageio-ffmpeg.
- Local transcription: faster-whisper.
- Local OCR: RapidOCR, ONNX Runtime, optional Tesseract OCR.
- Microsoft IQ providers: Azure AI Speech, Azure AI Vision Read OCR, and Azure OpenAI generation with local fallbacks.
- AI-assisted development: name GitHub Copilot in the final contest submission only if the team used it during the submitted build.

## Microsoft IQ Requirement

AccessiNote integrates the required Microsoft IQ intelligence layer in three places:

- Azure AI Speech transcribes uploaded lecture audio into timed caption and transcript segments.
- Azure AI Vision scans uploaded images and selected video frames for OCR evidence.
- Azure OpenAI generates accessible learning outputs from grounded timeline evidence.

These providers are visible in `/settings`, `/api/capabilities`, and `/api/demo/status`. The app can
run with backend-managed Azure keys or browser-session BYOK keys for the local demo while preserving
local fallback behavior if a provider is unavailable.

## Microsoft Integration Story

AccessiNote keeps local fallback for reliability and safety, but can use Azure-backed provider routes
when configured:

- `TRANSCRIPTION_PROVIDER=local|azure_speech`
- `OCR_PROVIDER=local|azure_vision`
- `GENERATION_PROVIDER=local|azure_openai`

`GET /api/capabilities` reports each selected provider, whether it is configured, and which
environment variables are required. `GET /api/demo/status` surfaces provider readiness without
exposing keys to the browser. If Azure Speech, Azure AI Vision, or Azure OpenAI fails during the
demo, AccessiNote falls back to local transcription, local OCR, or deterministic generation.
The `/settings` page also includes bring-your-own-key slots, provider dropdowns, and official setup
links so judges or local users can bring their own Azure resources without editing source code.

## Judging Alignment

- Accuracy and relevance: outputs are built from timestamped transcript, caption, OCR, keyframe, and confidence evidence.
- Reasoning and multi-step thinking: the pipeline ingests media, transcribes audio with Azure Speech or local fallback, finds visual changes, scans OCR with Azure AI Vision or local fallback, aligns evidence, and flags weak chunks.
- Creativity and originality: the app treats lecture accessibility as source-grounded multimodal review instead of generic summarization.
- User experience and presentation: the workbench shows processing progress, readiness, scan metrics, timeline review, and export actions in one flow.
- Reliability and safety: the demo can use Azure providers without exposing keys, keeps local fallback, stores local timelines explicitly, warns about weak evidence, and keeps humans in the review loop.
- Community vote: the demo story is easy to understand: upload lecture material, inspect evidence, generate accessible study formats.

## Accessibility Award Fit

AccessiNote supports multiple access needs directly:

- ADHD study packs reduce overload with a start path, must-know ideas, quick checks, and recovery steps.
- Screen-reader notes provide a linear reading order with visual descriptions and OCR review notes.
- Plain-language output makes lecture material easier to approach.
- Captions and WebVTT export support audio access.
- Notetaker quality reports expose weak areas before material is shared.

## Screenshot And Video Checklist

- First viewport with AccessiNote branding and local upload desk.
- Demo readiness panel showing pass/warn/fail checks.
- Video job progress stages.
- Scan report with candidate frames, selected frames, OCR frames, caption source, and weak chunks.
- Evidence timeline with keyframe, transcript, collapsed OCR details, collapsed visual review, and warning flags.
- ADHD Study Pack output.
- Screen Reader Notes output.
- WebVTT caption export.
- Evidence JSON export.
- Safety/human-review message.
- Optional provider readiness with endpoints and keys redacted.

## Final Verification

Final tested commit: record the final public submission SHA after the last release-ready commit.

Checks completed on June 14, 2026:

- Backend compile: `python -m compileall backend/app`.
- Frontend typecheck: `npm run typecheck`.
- Frontend lint: `npm run lint`.
- Frontend build: `npm run build`.
- Hackathon readiness script: `.\scripts\check-hackathon-readiness.ps1` for local recording.
- Backend smoke tests: health, capabilities, demo status, sample lecture, transcript creation, ADHD/screen-reader generation, WebVTT generation, image media job, video media job with uploaded captions, and job cancellation.
- Provider settings API: session-only Azure key settings save, report configured status without returning secrets, and clear back to local providers.
