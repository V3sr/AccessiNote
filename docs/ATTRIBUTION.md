# Attribution

The bundled sample lecture timeline is synthetic demo content about linear algebra
transformations. It is not copied from a real lecture transcript.

User-created transcript timelines are generated locally from pasted text supplied by the user.
Users are responsible for ensuring they have permission to process that material.

Video timelines are generated locally from user-uploaded files. Keyframes and OCR text, when
available, are derived from that uploaded material.

Local processing uses these open-source/runtime components when installed through the backend
requirements:

- FastAPI and Pydantic for the local API and typed data models.
- imageio-ffmpeg or system ffmpeg for frame extraction, scene-change detection, and audio extraction.
- faster-whisper for local speech-to-text caption generation.
- RapidOCR and ONNX Runtime for local OCR.
- Tesseract OCR as an optional user-installed fallback OCR engine.

Optional Microsoft provider configuration is exposed for future integration, but the current demo
does not call Azure services. If enabled later, the intended provider seams are:

- Azure AI Speech for transcription.
- Azure AI Vision for OCR.
- Azure OpenAI for generation.

AccessiNote does not ship real lecture content. Demo material should remain synthetic or
user-provided with permission.
