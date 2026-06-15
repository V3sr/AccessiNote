param(
  [Parameter(Mandatory = $true)]
  [string]$ResourceGroup,

  [Parameter(Mandatory = $true)]
  [string]$AcrName,

  [Parameter(Mandatory = $true)]
  [string]$ContainerAppName,

  [Parameter(Mandatory = $true)]
  [string]$EnvironmentName,

  [Parameter(Mandatory = $true)]
  [string]$FrontendOrigin,

  [string]$Location = "eastus",
  [string]$ImageTag = "latest",

  [ValidateSet("BringYourOwnKey", "BackendManaged")]
  [string]$KeyMode = "BringYourOwnKey"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. Install it and sign in before running this script."
  }
}

function Require-Env($Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }
  return $value
}

function Assert-DockerDaemonReady() {
  docker info --format "{{.ServerVersion}}" *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker is installed but the daemon is not running. Start Docker Desktop and rerun this script, or use the GitHub Actions production deploy workflow instead."
  }
}

function Ensure-ProviderRegistered($Namespace) {
  $state = az provider show --namespace $Namespace --query registrationState -o tsv 2>$null
  if ($LASTEXITCODE -eq 0 -and $state -eq "Registered") {
    Write-Host "Azure provider $Namespace is already registered"
    return
  }

  if ([string]::IsNullOrWhiteSpace($state)) {
    Write-Host "Registering Azure provider $Namespace"
  } else {
    Write-Host "Azure provider $Namespace is in state '$state'. Registering or refreshing registration..."
  }

  az provider register --namespace $Namespace --output none
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to register Azure provider $Namespace. Make sure your subscription allows provider registration and try again."
  }

  $deadline = (Get-Date).AddMinutes(10)
  do {
    Start-Sleep -Seconds 10
    $state = az provider show --namespace $Namespace --query registrationState -o tsv 2>$null
  } until ($state -eq "Registered" -or (Get-Date) -ge $deadline)

  if ($state -ne "Registered") {
    throw "Azure provider $Namespace did not finish registering within 10 minutes. Current state: $state"
  }

  Write-Host "Azure provider $Namespace registered"
}

Require-Command "az"
Require-Command "docker"
Assert-DockerDaemonReady

Ensure-ProviderRegistered "Microsoft.ContainerRegistry"
Ensure-ProviderRegistered "Microsoft.App"
Ensure-ProviderRegistered "Microsoft.OperationalInsights"

$secrets = @()
$envVars = @(
  "ACCESSINOTE_CORS_ORIGINS=$FrontendOrigin",
  "ACCESSINOTE_RUNTIME_PROVIDER_SETTINGS=enabled",
  "TRANSCRIPTION_PROVIDER=local",
  "OCR_PROVIDER=local",
  "GENERATION_PROVIDER=local"
)

if ($KeyMode -eq "BackendManaged") {
  $azureSpeechKey = Require-Env "AZURE_SPEECH_KEY"
  $azureSpeechRegion = Require-Env "AZURE_SPEECH_REGION"
  $azureVisionEndpoint = Require-Env "AZURE_VISION_ENDPOINT"
  $azureVisionKey = Require-Env "AZURE_VISION_KEY"
  $azureOpenAiEndpoint = Require-Env "AZURE_OPENAI_ENDPOINT"
  $azureOpenAiKey = Require-Env "AZURE_OPENAI_API_KEY"
  $azureOpenAiDeployment = Require-Env "AZURE_OPENAI_DEPLOYMENT"
  $azureSpeechLanguage = [Environment]::GetEnvironmentVariable("AZURE_SPEECH_LANGUAGE")
  if ([string]::IsNullOrWhiteSpace($azureSpeechLanguage)) {
    $azureSpeechLanguage = "en-US"
  }

  $secrets = @(
    "azure-speech-key=$azureSpeechKey",
    "azure-vision-key=$azureVisionKey",
    "azure-openai-key=$azureOpenAiKey"
  )

  $envVars = @(
    "ACCESSINOTE_CORS_ORIGINS=$FrontendOrigin",
    "ACCESSINOTE_RUNTIME_PROVIDER_SETTINGS=disabled",
    "TRANSCRIPTION_PROVIDER=azure_speech",
    "OCR_PROVIDER=azure_vision",
    "GENERATION_PROVIDER=azure_openai",
    "AZURE_SPEECH_KEY=secretref:azure-speech-key",
    "AZURE_SPEECH_REGION=$azureSpeechRegion",
    "AZURE_SPEECH_LANGUAGE=$azureSpeechLanguage",
    "AZURE_VISION_ENDPOINT=$azureVisionEndpoint",
    "AZURE_VISION_KEY=secretref:azure-vision-key",
    "AZURE_OPENAI_ENDPOINT=$azureOpenAiEndpoint",
    "AZURE_OPENAI_API_KEY=secretref:azure-openai-key",
    "AZURE_OPENAI_DEPLOYMENT=$azureOpenAiDeployment"
  )
}

$imageName = "accessinote-backend:$ImageTag"
$imageRef = "$AcrName.azurecr.io/$imageName"

Write-Host "Creating resource group $ResourceGroup in $Location"
az group create --name $ResourceGroup --location $Location --output none

Write-Host "Creating or updating Azure Container Registry $AcrName"
az acr create --resource-group $ResourceGroup --name $AcrName --sku Basic --admin-enabled true --output none

Write-Host "Fetching Azure Container Registry access token for $AcrName"
$acrLogin = az acr login --name $AcrName --expose-token --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($acrLogin.accessToken)) {
  throw "Failed to get an Azure Container Registry access token for $AcrName."
}

Write-Host "Logging into Azure Container Registry $AcrName with token"
Write-Output $acrLogin.accessToken | docker login $acrLogin.loginServer -u 00000000-0000-0000-0000-000000000000 --password-stdin
if ($LASTEXITCODE -ne 0) {
  throw "Failed to log into Azure Container Registry $AcrName."
}

Write-Host "Building backend image locally: $imageRef"
docker build -f Dockerfile.backend -t $imageRef .
if ($LASTEXITCODE -ne 0) {
  throw "Docker build failed for $imageRef."
}

Write-Host "Pushing backend image to ACR: $imageRef"
docker push $imageRef
if ($LASTEXITCODE -ne 0) {
  throw "Docker push failed for $imageRef."
}

Write-Host "Creating Container Apps environment $EnvironmentName"
$environmentExists = az containerapp env show --name $EnvironmentName --resource-group $ResourceGroup --query name -o tsv 2>$null
if (-not $environmentExists) {
  az containerapp env create --name $EnvironmentName --resource-group $ResourceGroup --location $Location --output none
}

$appExists = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query name -o tsv 2>$null
if ($appExists) {
  Write-Host "Updating Container App $ContainerAppName"
  if ($secrets.Count -gt 0) {
    az containerapp update `
      --name $ContainerAppName `
      --resource-group $ResourceGroup `
      --image $imageRef `
      --secrets $secrets `
      --set-env-vars $envVars `
      --output none
  } else {
    az containerapp update `
      --name $ContainerAppName `
      --resource-group $ResourceGroup `
      --image $imageRef `
      --set-env-vars $envVars `
      --output none
  }
} else {
  Write-Host "Creating Container App $ContainerAppName"
  if ($secrets.Count -gt 0) {
    az containerapp create `
      --name $ContainerAppName `
      --resource-group $ResourceGroup `
      --environment $EnvironmentName `
      --image $imageRef `
      --registry-server "$AcrName.azurecr.io" `
      --target-port 8000 `
      --ingress external `
      --min-replicas 1 `
      --max-replicas 1 `
      --cpu 2 `
      --memory 4Gi `
      --secrets $secrets `
      --env-vars $envVars `
      --output none
  } else {
    az containerapp create `
      --name $ContainerAppName `
      --resource-group $ResourceGroup `
      --environment $EnvironmentName `
      --image $imageRef `
      --registry-server "$AcrName.azurecr.io" `
      --target-port 8000 `
      --ingress external `
      --min-replicas 1 `
      --max-replicas 1 `
      --cpu 2 `
      --memory 4Gi `
      --env-vars $envVars `
      --output none
  }
}

$fqdn = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv
Write-Host "Backend deployed: https://$fqdn"
Write-Host "Set NEXT_PUBLIC_API_BASE_URL=https://$fqdn in Vercel."
Write-Host "Key mode: $KeyMode"
