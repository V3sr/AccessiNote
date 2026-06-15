# Demo Prep

Use this checklist when you are ready to fill in your own keys and record the demo video.

## 1. Start AccessiNote Locally

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm.cmd run dev
```

Open `http://localhost:3000`.

## 2. Fill In Optional API Keys

Open `http://localhost:3000/settings`, or click **API keys** in the top-right header.

Use the dropdowns to choose the providers you want:

- Speech transcription: `Azure Speech`
- OCR: `Azure AI Vision`
- Study output generation: `Azure OpenAI`

Paste the matching values:

- Azure Speech: key, region, language
- Azure AI Vision: endpoint, key
- Azure OpenAI: endpoint, key, deployment name

Click **Save settings**. The saved keys are scoped to this browser session on the backend and are not
shown again by the frontend.

## 3. Run A Local Readiness Check

With both servers running:

```powershell
.\scripts\check-hackathon-readiness.ps1 -FrontendUrl http://localhost:3000 -BackendUrl http://localhost:8000
```

Warnings about missing optional Azure providers are okay if you plan to use local fallback. For the
Microsoft IQ demo story, configure at least one Azure route before recording.

## 4. Demo Recording Flow

1. Show the homepage and safety banner.
2. Click **API keys** and show the key slots without revealing real keys.
3. Load the sample lecture.
4. Upload a short permitted video or slide image.
5. Show processing progress, scan report, timeline evidence, and warnings.
6. Generate ADHD/focus study pack and screen-reader notes.
7. Export WebVTT captions or Evidence JSON.
8. Close by saying outputs are drafts and require human review.

## 5. Do Not Show

- Real API keys.
- Full private endpoints if you want to keep resource names private.
- `.env` files.
- Private student data, exams, accommodation records, or unauthorized recordings.
