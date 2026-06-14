# Demo Script

AccessiNote demo target: Microsoft Agents League Creative Apps + Accessibility.

Before recording, review `docs/SUBMISSION.md` and fill in the public GitHub repository URL and
YouTube/Vimeo demo URL after upload. The official demo limit is 5 minutes.

## Five-Minute Flow

0:00-0:30 - Local readiness

1. Open `http://localhost:3000`.
2. Point to the Demo readiness panel.
3. Say: AccessiNote checks sample data, ffmpeg, OCR, transcription, exports, recent video status, and optional Microsoft provider configuration before the demo starts.
4. If Azure providers are configured, call out Azure Speech, Azure AI Vision, and Azure OpenAI as selected providers. If not, call out that local fallback keeps the demo reliable.

0:30-1:10 - Baseline sample

1. Click **Load sample lecture**.
2. Scroll to the Evidence timeline.
3. Show timestamped transcript chunks, concepts, OCR/visual evidence slots, and source confidence.
4. Say: every generated format is grounded in the same reviewable timeline.

1:10-2:15 - Video processing

1. In the upload desk, click the **Video** tab.
2. Choose a short permitted lecture clip.
3. Optionally attach `.vtt`, `.srt`, or `.txt` captions; otherwise allow local faster-whisper captions.
4. Click **Upload video**.
5. Narrate the staged job flow: upload received, extracting audio, transcribing with Azure Speech or local fallback, finding visual changes, running Azure Vision OCR or local fallback, aligning timeline, ready for review.

2:15-3:10 - Evidence review

1. In **Scan report**, show candidate frames, selected frames, OCR frames, caption source, weak chunks, and warnings.
2. In **Evidence timeline**, expand one OCR details drawer and one visual review drawer.
3. Point out review flags for low-confidence or missing evidence.
4. Say: raw evidence stays available for audit, while student-facing outputs stay concise.

3:10-4:20 - Accessibility outputs

1. Select **ADHD Study Pack** and click **Generate output**.
2. Show the start path, must-know ideas, quick checks, and overwhelm-recovery section.
3. Select **Screen Reader Notes** and click **Generate output**.
4. Show linear reading order, visual descriptions, OCR review notes, and compact source coverage.
5. Select **Quality Report** and click **Generate output**.
6. Show transcript, OCR, source-confidence, and weak-evidence scores.

4:20-5:00 - Exports and safety

1. Select **WebVTT Captions**, click **Generate output**, then click **Download .vtt**.
2. Select **Evidence JSON**, click **Generate output**, and show the transparent source trail.
3. Close on the safety posture: permitted materials only, generated captions and OCR need human review, local storage is explicit, Azure keys stay server-side, and local fallback protects the demo.

## Judging Alignment

- Accuracy and relevance: timeline chunks preserve transcript, OCR, keyframes, and confidence.
- Reasoning and multi-step thinking: local pipeline extracts audio, detects visual changes, scans OCR, aligns evidence, and flags weak chunks.
- Creativity and originality: lecture accessibility is treated as multimodal evidence review, not just summarization.
- User experience and presentation: the workbench shows progress, scan metrics, concise source grounding, and export controls in one flow.
- Reliability and safety: demo readiness diagnostics, no required external API keys, explicit warnings, local storage, and human-in-the-loop review.
- Accessibility: ADHD study packs, screen-reader notes, captions, plain-language output, exam prep, and notetaker quality reporting are first-class outputs.

## Demo Data Guidance

Use synthetic or explicitly permitted lecture material. Avoid private student data, exams, accommodation records, or copyrighted lecture recordings without permission.

## Recording Checklist

- Browser opened to `http://localhost:3000`.
- Backend running on `http://localhost:8000`.
- Demo readiness panel visible near the start.
- One short permitted video available locally.
- Optional caption file ready if local transcription is slow on the recording machine.
- Azure resource names, keys, and endpoints redacted if the Azure portal or `.env` is ever shown.
- Download actions shown for `.vtt` and Evidence JSON.
- Safety and human-review language stated in the final 20 seconds.
