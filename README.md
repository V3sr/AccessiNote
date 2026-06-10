# AccessiNote

AccessiNote is a local-first lecture accessibility MVP. It turns a permitted lecture
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
- Upload a permitted video and create a local timeline.
- Extract video keyframes when `ffmpeg` is installed.
- OCR extracted frames with bundled local RapidOCR, or Tesseract OCR when installed.
- Show frame-level OCR confidence and scan coverage.
- Select an output mode.
- Generate deterministic markdown with timestamps and source references.
- Copy or download the generated markdown.

## Local Video/OCR

Video upload works without cloud services. The backend uses a Python-packaged ffmpeg fallback for
keyframe extraction when system `ffmpeg` is not on PATH. If no ffmpeg executable is available,
AccessiNote saves the video and creates a placeholder timeline explaining that frames could not be
extracted.

RapidOCR runs locally through ONNX Runtime and is installed with the backend requirements. Tesseract
is optional and can be used as a fallback local OCR engine:

```powershell
winget install UB-Mannheim.TesseractOCR
```

## Safety

Use only lecture material you are allowed to process. Do not upload private student data,
exams, accommodation records, or unauthorized recordings. Generated outputs may contain
errors and require human review.
