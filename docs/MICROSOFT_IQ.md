# Microsoft IQ Integration

AccessiNote satisfies the Microsoft IQ requirement through an optional Azure-backed intelligence
layer. The app still works locally without keys, but users can enter their own Azure provider values
through the settings page when they want cloud-backed processing.

## IQ Routes

| AccessiNote capability | Microsoft IQ route | Product value |
| --- | --- | --- |
| Caption generation | Azure AI Speech | Turns uploaded lecture audio into timed transcript segments and captions. |
| Slide and frame OCR | Azure AI Vision | Extracts readable text from screenshots, slides, board work, and selected video frames. |
| Accessible output generation | Azure OpenAI | Converts grounded timeline evidence into structured notes, ADHD study packs, screen-reader notes, exam prep, and plain-language outputs. |

## How The App Exposes It

- `/settings` lets local users select Azure providers and enter session-only keys.
- `/api/capabilities` reports selected provider names, configuration status, and required environment variables.
- `/api/demo/status` includes provider readiness in the demo checklist.
- The `/settings` page shows Azure AI Speech, Azure AI Vision, Azure OpenAI, and bring-your-own-key setup links at a glance.

## Demo Positioning

Use this phrasing in the submission video:

> AccessiNote integrates Microsoft IQ through Azure AI Speech for captions, Azure AI Vision for OCR,
> and Azure OpenAI for grounded accessible output generation. The app keeps local fallbacks so the
> demo is reliable, and users can add their own Azure keys when they want cloud-backed processing.

## Safety Notes

- Do not call Azure directly from the browser.
- Do not show keys, full endpoints, private resource names, `.env`, or CI secrets in the demo video.
- Use synthetic or permitted lecture material only.
- Generated captions, OCR, and study outputs require human review before academic or accessibility use.
