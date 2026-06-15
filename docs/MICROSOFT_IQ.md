# Microsoft IQ Integration

AccessiNote satisfies the Microsoft IQ requirement through an optional Azure-backed intelligence layer.
The local demo remains available without keys, but a hosted hackathon demo can run Azure-first with
server-side provider secrets.

## IQ Routes

| AccessiNote capability | Microsoft IQ route | Product value |
| --- | --- | --- |
| Caption generation | Azure AI Speech | Turns uploaded lecture audio into timed transcript segments and captions. |
| Slide and frame OCR | Azure AI Vision | Extracts readable text from screenshots, slides, board work, and selected video frames. |
| Accessible output generation | Azure OpenAI | Converts grounded timeline evidence into structured notes, ADHD study packs, screen-reader notes, exam prep, and plain-language outputs. |

## How The App Exposes It

- `/settings` lets local users select Azure providers and enter session-only keys.
- Hosted deployments can disable runtime key edits with `ACCESSINOTE_RUNTIME_PROVIDER_SETTINGS=disabled`.
- `/api/capabilities` reports selected provider names, configuration status, and required environment variables.
- `/api/demo/status` includes provider readiness in the demo checklist.
- `/api/production/status` checks CORS, Azure provider selection, Azure provider configuration, hosted key safety, backend storage, and local fallback tools.
- The `/settings` page shows Azure AI Speech, Azure AI Vision, Azure OpenAI, production readiness, and bring-your-own-key setup links at a glance.

## Demo Positioning

Use this phrasing in the submission video:

> AccessiNote integrates Microsoft IQ through Azure AI Speech for captions, Azure AI Vision for OCR,
> and Azure OpenAI for grounded accessible output generation. The app keeps local fallbacks so the
> demo is reliable, but the public production configuration keeps Azure keys server-side.

## Safety Notes

- Do not call Azure directly from the browser.
- Do not show keys, full endpoints, private resource names, `.env`, or CI secrets in the demo video.
- Use synthetic or permitted lecture material only.
- Generated captions, OCR, and study outputs require human review before academic or accessibility use.
