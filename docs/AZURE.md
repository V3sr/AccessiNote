# Azure Integration

AccessiNote can run as an Azure-first demo while preserving local fallbacks.

## Providers

Use the **AI provider keys** panel in the AccessiNote workbench for the easiest setup. The panel lets
users choose local or Azure providers and paste Azure keys into the running backend session. Session
keys are not returned to the browser and are cleared when the backend restarts or when **Use local
only** is clicked.

For repeatable local demos, set these switches in a private `.env` file instead:

```powershell
TRANSCRIPTION_PROVIDER=azure_speech
OCR_PROVIDER=azure_vision
GENERATION_PROVIDER=azure_openai
```

Required Azure configuration:

```powershell
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...
AZURE_SPEECH_LANGUAGE=en-US

AZURE_VISION_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
AZURE_VISION_KEY=...

AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=<deployment-name>
```

Do not commit `.env`. The repository only includes `.env.example` with blank values. UI-entered keys
are runtime overrides and are not written to `.env`.

## What Azure Does

- Azure Speech transcribes uploaded video audio when no captions are supplied.
- Azure AI Vision Read OCR extracts text from uploaded images and selected video frames.
- Azure OpenAI rewrites grounded timeline evidence into accessible study outputs.

Captions, Evidence JSON, and plain transcript exports remain deterministic because those formats
should preserve source data exactly.

## Fallback Behavior

AccessiNote keeps local fallback for demo reliability:

- If Azure Speech is unavailable, the backend falls back to faster-whisper.
- If Azure AI Vision OCR fails or finds no text, the backend falls back to local RapidOCR/Tesseract.
- If Azure OpenAI generation fails, the backend returns the deterministic local output.

The frontend Demo readiness panel and AI provider keys panel report whether Azure providers are
selected and configured.

## Safe Demo Guidance

- Never show `.env`, Azure keys, or full resource endpoints in the demo video.
- Do not call Azure directly from the browser. AccessiNote routes provider calls through the FastAPI
  backend so secrets stay server-side.
- Use the UI key panel for live setup if you want judges to see that any local user can bring their
  own Azure resources without editing source code.
- Redact Azure resource names in screenshots if they appear in portal pages.
- Use synthetic or permitted lecture material only.
- Clear `data/uploads` and `data/outputs` before publishing screenshots if they contain private test
  material.

If "IP" means intellectual property, the contest requires a public GitHub repository for the
submission. Keep secrets, private notes, generated media, and nonessential handoff files out of the
repo, but assume submitted source code is public.

## Official References

- Azure OpenAI Responses API: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses
- Azure OpenAI chat completions: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/chatgpt
- Azure AI Vision OCR overview: https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-ocr
- Azure Image Analysis Python SDK: https://learn.microsoft.com/en-us/python/api/overview/azure/ai-vision-imageanalysis-readme
- Azure Speech to text: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-to-text
