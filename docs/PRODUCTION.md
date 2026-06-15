# Production Deployment

AccessiNote can be launched as a public production demo with a Vercel frontend and an Azure-hosted
FastAPI backend. Keep the media backend on Azure because video upload, OCR, ffmpeg, and transcription
jobs need a long-running Python process.

## Recommended Architecture

- Frontend: Next.js on Vercel from the `frontend` project root.
- Backend: FastAPI container on Azure Container Apps or Azure App Service for Containers.
- AI services: Azure Speech, Azure AI Vision, and Azure OpenAI either provided by each visitor on
  `/settings` or configured as backend secrets.
- Storage for a short demo: local container filesystem is acceptable if you clear uploads regularly.
- Storage for a real public product: move `data/uploads` and `data/outputs` to durable Azure storage.

Do not deploy Azure keys to Vercel. Vercel only needs `NEXT_PUBLIC_API_BASE_URL`.

## Key Modes

AccessiNote supports two hosted demo modes:

- **BringYourOwnKey**: public visitors open `/settings`, choose Azure providers from dropdowns, and
  paste their own Azure keys. Keys are scoped to that browser session on the backend, never returned
  to the frontend, and cleared when the session is reset or the backend restarts.
- **BackendManaged**: the deployed backend owns the Azure keys through private host secrets.
  `/settings` becomes read-only and visitors cannot change provider settings.

Use **BringYourOwnKey** when you want judges or interviewers to try their own Azure resources. Use
**BackendManaged** when you want the public demo to work immediately with your own Azure resources.

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

### Vercel Import Troubleshooting

If Vercel shows the repository tree with both `frontend` and `backend`, click **Edit** beside
**Root Directory** and choose `frontend`. Do not leave the root directory as `./`.

Use these Vercel settings for the frontend project:

```text
Root Directory: frontend
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

If the deployed URL shows `404: NOT_FOUND`, the most likely cause is that Vercel deployed the repo
root instead of the `frontend` Next.js app. Change the project root directory to `frontend`, add the
environment variables above, and redeploy.

## GitHub Actions Deployment

The repository includes:

- `.github/workflows/ci.yml` for backend compile plus frontend typecheck, lint, and build.
- `.github/workflows/production-deploy.yml` for a manual production deploy to Azure Container Apps
  and Vercel, followed by the smoke check script.

For the fastest hosted demo path, use the GitHub Actions deploy workflow. It builds and pushes the
backend image on the runner, registers the needed Azure resource providers, and then creates or
updates the Container App. The Azure portal wizard is useful once an image already exists in ACR,
but it is not the easiest path when your local machine cannot run Docker.

Required GitHub repository secrets for all production deploys:

```text
AZURE_CREDENTIALS
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Additional GitHub repository secrets for `BackendManaged` key mode:

```text
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION
AZURE_VISION_ENDPOINT
AZURE_VISION_KEY
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT
```

Optional GitHub variable:

```text
AZURE_SPEECH_LANGUAGE=en-US
```

`AZURE_CREDENTIALS` should be a service-principal JSON value accepted by `azure/login`. Run the
manual **Production Deploy** workflow with your Vercel frontend URL as `frontend_origin`. Select
`BringYourOwnKey` if users will paste their own keys on `/settings`, or `BackendManaged` if GitHub
secrets should power the hosted demo.

## Backend on Azure Container Apps

The quickest repeatable backend path is the deployment script:

```powershell
.\scripts\deploy-backend-azure-containerapp.ps1 `
  -ResourceGroup "<resource-group>" `
  -AcrName "<unique-acr-name>" `
  -ContainerAppName "accessinote-api" `
  -EnvironmentName "accessinote-env" `
  -FrontendOrigin "https://<your-vercel-domain>" `
  -KeyMode BringYourOwnKey
```

For backend-managed keys, set the Azure key environment variables before running the script and pass
`-KeyMode BackendManaged`.

The script builds `Dockerfile.backend` in Azure Container Registry, deploys the FastAPI backend to
Azure Container Apps, configures either BYOK or backend-managed key mode, and prints the backend URL
for Vercel. It gets an ACR access token with `--expose-token`, builds the image locally, and pushes
it to the registry instead of depending on ACR Tasks, which avoids the registry-task permissions
issue some subscriptions hit.

The manual script still needs Docker Desktop or another running Docker engine for the local build
and push step. If Docker is installed but stopped, the script now fails with a direct message before
the build starts.

If you do not want to run Docker locally, use the repository's manual **Production Deploy** GitHub
workflow instead. That path builds and pushes the backend image on a GitHub runner and does not
depend on your machine's Docker daemon.

If your subscription has not yet registered the needed Azure resource providers, the script now
tries to register them automatically before it creates the registry or Container App. The main
providers it needs are `Microsoft.ContainerRegistry`, `Microsoft.App`, and
`Microsoft.OperationalInsights`. If registration fails, your Azure account likely does not have
permission to register providers in that subscription.

Manual container build from the repository root:

```powershell
docker build -f Dockerfile.backend -t accessinote-backend:latest .
```

Push that image to Azure Container Registry, then run it in Azure Container Apps or Azure App Service
for Containers with port `8000`.

Set these backend environment variables or secrets:

```text
ACCESSINOTE_CORS_ORIGINS=https://<your-vercel-domain>
ACCESSINOTE_RUNTIME_PROVIDER_SETTINGS=enabled

TRANSCRIPTION_PROVIDER=local
OCR_PROVIDER=local
GENERATION_PROVIDER=local
```

For backend-managed keys, use:

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

## Smoke Test

After deployment:

1. Open `https://<backend-domain>/health` and confirm `{"status":"ok"}`.
2. Open `https://<backend-domain>/api/capabilities` and confirm upload APIs are enabled.
3. Open `https://<backend-domain>/api/production/status`. In BYOK mode, provider checks will wait
   for the current browser session to paste keys on `/settings`.
4. Open the Vercel frontend.
5. Open `/settings` and confirm runtime and production readiness.
6. Upload a short permitted video and verify captions, OCR, generated notes, and exports.

If `/api/production/status` is not ready, it will list the missing CORS origin, provider switch, or
backend secret without exposing secret values.

## Azure Provider Registration Errors

If Azure reports `MissingSubscriptionRegistration` for `Microsoft.App` or
`Microsoft.ContainerRegistry`, register the provider once for the subscription and rerun the
deployment:

```powershell
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.OperationalInsights
```

You can check the current state with:

```powershell
az provider show --namespace Microsoft.App --query registrationState -o tsv
```

You can run the smoke check script after both deployments:

```powershell
.\scripts\check-production.ps1 `
  -FrontendUrl "https://<your-vercel-domain>" `
  -BackendUrl "https://<backend-domain>" `
  -ByokMode
```

Run the full hackathon readiness check before recording or submitting:

```powershell
.\scripts\check-hackathon-readiness.ps1 `
  -FrontendUrl "https://<your-vercel-domain>" `
  -BackendUrl "https://<backend-domain>" `
  -PublicMode `
  -ByokMode
```

## Public Demo Safety

- Never show `.env`, Azure keys, or full secret values in the demo video.
- In BYOK mode, make clear that visitors need their own Azure resources for Azure-backed processing.
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
