# Demo Script

AccessiNote demo target: Microsoft Agents League Creative Apps + Accessibility.

Aim for a clear 3 to 4 minute recording. The official limit is 5 minutes, but the demo does not need
to fill the full time. Before recording, run through `docs/DEMO_PREP.md`, review
`docs/SUBMISSION.md`, and add the public GitHub plus YouTube/Vimeo links after upload.

## Core Message

Say this near the beginning:

> AccessiNote helps students, notetakers, and accessibility support staff turn permitted lecture
> materials into reviewable accessible study notes. It creates drafts for screen-reader notes,
> ADHD/focus support, plain-language review, visual descriptions, captions, and notetaker quality
> checks. Every output stays tied to timestamps and evidence, and every draft requires human review.

## Must-Hit Points

- Accessibility-first product: not a generic summarizer.
- Permitted materials only; no private student data, exams, or unauthorized recordings.
- Local-first workflow, with optional user-provided Azure keys through **API keys**.
- Microsoft IQ layer: Azure Speech, Azure AI Vision, and Azure OpenAI can be used when configured.
- Evidence timeline: transcript, captions, OCR, keyframes, warnings, and confidence stay reviewable.
- Outputs are drafts: the user reviews before exporting.

## Recommended 3-4 Minute Flow

### 0:00-0:25 - What AccessiNote Is

Click: open `http://localhost:3000`.

Show: homepage headline, upload panel, safety banner.

Say:

> AccessiNote turns permitted lecture recordings, transcripts, slides, and notes into accessible
> study formats. The key idea is not just generating notes. The key idea is creating reviewable
> drafts with timestamps, warnings, and source evidence so a student, notetaker, or support staff
> member can check the material before using it.

Point out:

- **Draft - human review required**
- Safety banner
- Supported sources in the upload panel

### 0:25-0:55 - Optional API Keys And Microsoft IQ

Click: **API keys** in the header.

Show: provider dropdowns and key slots. Do not reveal real key values.

Say:

> AccessiNote works locally without API keys, but users can bring their own provider keys here.
> For the Microsoft IQ layer, Azure Speech can generate captions, Azure AI Vision can scan slides
> and video frames, and Azure OpenAI can improve the accessible study outputs. Keys are handled
> through the backend session and are not shown again in the browser.

Click: **Back to workspace**.

Optional cut: If the demo is running long, show this page for only 10 seconds.

### 0:55-1:25 - Load A Reliable Baseline

Click: **Try sample lecture** or **Load sample lecture**.

Show: review workspace, lecture timeline, source chunks.

Say:

> I am starting with a sample lecture so the workflow is easy to see. The app creates a timeline
> first. That timeline is the source of truth for every output: transcript text, visual evidence,
> OCR text, concepts, confidence, and warnings all stay attached to timestamps.

Point out:

- Lecture timeline
- Chunks/timestamps
- Review checklist

### 1:25-2:05 - Show Upload Or Processing

Option A, fastest: use the sample and briefly show the upload panel.

Say:

> In a live workflow, a user can upload a permitted recording, captions, transcript, slide image, or
> notes. Video processing runs as staged local jobs: extracting audio, transcribing or using uploaded
> captions, finding visual changes, running OCR, and aligning the evidence into the timeline.

Option B, if you have a short video ready: click **Recording**, select the file, then click
**Add recording**.

Say:

> This job view matters for reliability. The user can see what stage is running, and if something
> fails, the app reports a reviewable warning instead of silently inventing clean notes.

Point out if visible:

- Processing stage
- OCR/caption warnings
- Scan report

### 2:05-2:45 - Generate Accessible Outputs

Click: **ADHD/Focus Study Pack**, then **Generate draft**.

Say:

> The ADHD/focus pack is intentionally short and action-oriented. It starts with what to read first,
> the must-know ideas, quick checks, and recovery steps for when the lecture feels overwhelming.
> This is different from dumping a long summary onto the learner.

Click: **Screen-reader Notes**, then **Generate draft**.

Say:

> Screen-reader notes use a linear reading order. Visual content and OCR evidence are included in a
> way that can be reviewed, rather than hidden inside an image or treated as decoration.

Optional: click **Notetaker Quality Review** if you have time.

Say:

> For notetakers or support staff, the quality report highlights weak evidence, missing captions,
> unclear OCR, and places where a person should verify the output.

### 2:45-3:25 - Evidence And Export

Show: source references, timeline, warnings, and export buttons.

Say:

> The important safety feature is that the output is not detached from the source. The user can
> inspect evidence, timestamps, OCR, captions, and warnings before exporting. AccessiNote can export
> notes, WebVTT captions, plain transcript text, or the evidence timeline as JSON.

Click: **WebVTT Captions** or **Source Timeline**, generate if needed, then show download/copy.

Say:

> The final result is a draft package for review, not an accommodation decision or a perfect
> transcript. The user stays in the loop.

### 3:25-3:45 - Closing Line

Say:

> AccessiNote is built for accessibility workflows: students get study formats that are easier to
> use, notetakers get quality checks, instructors and support staff get evidence they can review,
> and the whole process keeps safety warnings visible. It is local-first, Microsoft IQ-ready, and
> designed around human review.

Stop recording here if everything important has been shown.

## 90-Second Backup Version

Use this if the full video feels too long or if upload processing is slow.

1. Open homepage.
2. Say the core message.
3. Click **API keys** and show optional provider slots.
4. Load sample lecture.
5. Generate **ADHD/Focus Study Pack**.
6. Generate **Screen-reader Notes**.
7. Show evidence timeline and warnings.
8. Show WebVTT or Evidence JSON export.
9. Close with: "Every output is a draft, grounded in timestamps and evidence, and requires human review."

## What Not To Show

- Real API keys.
- Full private endpoints if you want resource names private.
- `.env` files.
- Private student data.
- Exams, accommodation records, or unauthorized recordings.
- A long wait for video processing. Use sample data or a short pre-tested clip if processing is slow.

## Judging Alignment Talking Points

- Accuracy and relevance: outputs are grounded in transcript, caption, OCR, keyframe, and confidence evidence.
- Reasoning: the pipeline ingests material, creates or uses captions, detects visual changes, scans OCR, aligns evidence, and flags weak chunks.
- Creativity: the project treats lecture accessibility as evidence review, not just summarization.
- UX: the workflow goes from source intake to review, output generation, warnings, and export in one screen.
- Reliability and safety: local fallback, optional Azure providers, explicit warnings, permitted-use policy, and human review.
- Accessibility: ADHD/focus packs, screen-reader notes, plain-language output, captions, visual descriptions, and notetaker quality checks are first-class formats.

## Recording Checklist

- Backend running on `http://localhost:8000`.
- Frontend running on `http://localhost:3000`.
- `scripts/check-hackathon-readiness.ps1` passes with no failures.
- `/settings` opens from the **API keys** button.
- Sample lecture loads.
- At least one output mode generates successfully.
- Export buttons are visible.
- Safety/human-review message is visible or stated.
