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

## Azure Providers

The default demo path does not send lecture material to Microsoft/Azure or any external provider.
Azure Speech, Azure AI Vision, and Azure OpenAI are used only when a user explicitly selects and
configures them in the local environment. Missing provider keys are demo-readiness warnings, not
blockers.

When Azure providers are enabled, lecture audio, selected frames, OCR inputs, and compact timeline
evidence may be sent to the configured Azure resources. The frontend never receives Azure keys; all
provider calls run through the backend. Demo videos and screenshots should not show `.env`, resource
keys, or full Azure endpoints.
