# AccessiNote

AccessiNote is a local-first lecture accessibility MVP. It turns a permitted lecture
timeline or pasted transcript into timestamped learning formats such as structured notes,
ADHD-friendly study packs, screen-reader notes, plain-language explanations, exam prep, and
notetaker quality reports.

The current demo is intentionally local only. It does not require API keys, Azure services,
video processing, authentication, or a database.

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
- Select an output mode.
- Generate deterministic markdown with timestamps and source references.
- Copy or download the generated markdown.

## Safety

Use only lecture material you are allowed to process. Do not upload private student data,
exams, accommodation records, or unauthorized recordings. Generated outputs may contain
errors and require human review.
