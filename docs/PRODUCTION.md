# Production Deployment

AccessiNote can be launched as a public production demo with a Vercel frontend and an Azure-hosted
FastAPI backend. Keep the media backend on Azure because video upload, OCR, ffmpeg, and transcription
jobs need a long-running Python process.

## Recommended Architecture

- Frontend: Next.js on Vercel from the `frontend` project root.
- Backend: FastAPI container on Azure Container Apps or Azure App Service for Containers.
- AI services: Azure Speech, Azure AI Vision, and Azure OpenAI configured as backend secrets.
- Storage for a short demo: local container filesystem is acceptable if you clear uploads regularly.
- Storage for a real public product: move `data/uploads` and `data/outputs` to durable Azure storage.

Do not deploy Azure keys to Vercel. Vercel only needs `NEXT_PUBLIC_API_BASE_URL`.

## Frontend on Vercel

1. Import the GitHub repository into Vercel.
2. Set the Vercel project root directory to `frontend`.
3. Use the included `frontend/vercel.json` defaults.
4. Add this environment variable in Vercel:

```text
NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
```

5. Deploy the frontend.

Vercel environment variables are configured outside source code and can be scoped by deployment
environment. See the official Vercel environment variable documentation.

## GitHub Actions Deployment

The repository includes:

- `.github/workflows/ci.yml` for backend compile plus frontend typecheck, lint, and build.
- `.github/workflows/production-deploy.yml` for a manual production deploy to Azure Container Apps
  and Vercel, followed by the smoke check script.

Required GitHub repository secrets:

```text
AZURE_CREDENTIALS
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION
AZURE_VISION_ENDPOINT
AZURE_VISION_KEY
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Optional GitHub variable:

```text
AZURE_SPEECH_LANGUAGE=en-US
```

`AZURE_CREDENTIALS` should be a service-principal JSON value accepted by `azure/login`. Run the
manual **Production Deploy** workflow with your Vercel frontend URL as `frontend_origin`.

## Backend on Azure Container Apps

The quickest repeatable backend path is the deployment script:

```powershell
$env:AZURE_SPEECH_KEY="<secret>"
$env:AZURE_SPEECH_REGION="<region>"
$env:AZURE_SPEECH_LANGUAGE="en-US"
$env:AZURE_VISION_ENDPOINT="https://<resource>.cognitiveservices.azure.com/"
$env:AZURE_VISION_KEY="<secret>"
$env:AZURE_OPENAI_ENDPOINT="https://<resource>.openai.azure.com/"
$env:AZURE_OPENAI_API_KEY="<secret>"
$env:AZURE_OPENAI_DEPLOYMENT="<deployment-name>"

.\scripts\deploy-backend-azure-containerapp.ps1 `
  -ResourceGroup "<resource-group>" `
  -AcrName "<unique-acr-name>" `
  -ContainerAppName "accessinote-api" `
  -EnvironmentName "accessinote-env" `
  -FrontendOrigin "https://<your-vercel-domain>"
```

The script builds `Dockerfile.backend` in Azure Container Registry, deploys the FastAPI backend to
Azure Container Apps, stores Azure keys as container app secrets, disables runtime provider edits,
and prints the backend URL for Vercel.

Manual container build from the repository root:

```powershell
docker build -f Dockerfile.backend -t accessinote-backend:latest .
```

Push that image to Azure Container Registry, then run it in Azure Container Apps or Azure App Service
for Containers with port `8000`.

Set these backend environment variables or secrets:

```text
ACCESSINOTE_CORS_ORIGINS=https://<your-vercel-domain>
ACCESSINOTE_RUNTIME_PROVIDER_SETTINGS=disabled

TRANSCRIPTION_PROVIDER=azure_speech
OCR_PROVIDER=azure_vision
GENERATION_PROVIDER=azure_openai

AZURE_SPEECH_KEY=<secret>
AZURE_SPEECH_REGION=<region>
AZURE_SPEECH_LANGUAGE=en-US

AZURE_VISION_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
AZURE_VISION_KEY=<secret>

AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
AZURE_OPENAI_API_KEY=<secret>
AZURE_OPENAI_DEPLOYMENT=<deployment-name>
```

Azure Container Apps supports runtime environment variables and app-level secrets that can be
referenced by environment variables.

`ACCESSINOTE_RUNTIME_PROVIDER_SETTINGS=disabled` keeps `/settings` read-only for public visitors.
Use `enabled` only for a controlled bring-your-own-key demo.

## Smoke Test

After deployment:

1. Open `https://<backend-domain>/health` and confirm `{"status":"ok"}`.
2. Open `https://<backend-domain>/api/capabilities` and confirm Azure providers are selected and configured.
3. Open `https://<backend-domain>/api/production/status` and confirm `ready` is `true`.
4. Open the Vercel frontend.
5. Open `/settings` and confirm runtime and production readiness.
6. Upload a short permitted video and verify captions, OCR, generated notes, and exports.

If `/api/production/status` is not ready, it will list the missing CORS origin, provider switch, or
backend secret without exposing secret values.

You can run the smoke check script after both deployments:

```powershell
.\scripts\check-production.ps1 `
  -FrontendUrl "https://<your-vercel-domain>" `
  -BackendUrl "https://<backend-domain>"
```

## Public Demo Safety

- Never show `.env`, Azure keys, or full secret values in the demo video.
- Use permitted or synthetic lecture material only.
- Clear uploaded private media before making screenshots.
- Keep local fallback enabled so the app remains usable if one Azure service is unavailable.
- Do not market this as an academic accommodation replacement. It is a review and accessibility
  support tool that requires human verification.

## Official References

- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel Next.js deployment: https://vercel.com/docs/frameworks/full-stack/nextjs
- Azure Container Apps environment variables: https://learn.microsoft.com/en-us/azure/container-apps/environment-variables
- Azure Container Apps secrets: https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets
- Azure App Service FastAPI deployment: https://learn.microsoft.com/en-us/azure/app-service/quickstart-python
