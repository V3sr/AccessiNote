# Safety

AccessiNote is designed for permitted lecture materials only.

Do not use this local MVP with:

- private student data
- exams or answer keys
- accommodation records
- unauthorized lecture recordings
- unrelated personal information

Generated outputs are deterministic local summaries, not verified accommodations or academic
advice. Review generated notes before using them for study, teaching, or accessibility support.

## Human Review

AccessiNote intentionally keeps evidence visible. Reviewers should inspect timeline chunks, source
confidence, OCR details, captions, and scan warnings before sharing outputs with students or using
them as accessibility support.

Video upload is local, but users still need permission to process the recording. Review extracted
frames and OCR text before relying on generated notes, especially when slides contain equations,
small text, names, or sensitive material.

Generated captions are not official transcripts. Review WebVTT output against the original lecture,
especially for names, technical vocabulary, accents, low-quality audio, or overlapping speech.

OCR and scene-change detection are assistive signals, not proof that every slide, board note, diagram,
or equation was captured. Treat low-confidence chunks and "no readable OCR" flags as review prompts.

Uploaded files and generated timelines are stored in ignored local folders under `data/uploads` and
`data/outputs`. Clear those folders manually when you no longer need local test material.

## Optional Providers

The default demo path does not send lecture material to Microsoft/Azure or any external provider.
Optional provider configuration can report Azure Speech, Azure AI Vision, or Azure OpenAI readiness,
but those integrations are disabled unless a user explicitly selects and configures them in the local
environment. Missing optional provider keys are demo-readiness warnings, not blockers.

If cloud providers are implemented later, the app should show provider selection clearly, document
what data leaves the machine, and require users to confirm they have permission to process the
material through that provider.
