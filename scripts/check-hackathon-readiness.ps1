param(
  [string]$FrontendUrl = "http://127.0.0.1:3000",
  [string]$BackendUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Normalize-Url($Url) {
  return $Url.TrimEnd("/")
}

function Add-Check($Status, $Label, $Detail) {
  $line = "[{0}] {1}: {2}" -f $Status, $Label, $Detail
  Write-Host $line
  if ($Status -eq "fail") {
    $failures.Add($line)
  }
  if ($Status -eq "warn") {
    $warnings.Add($line)
  }
}

function Invoke-Json($Url, $Label) {
  try {
    return Invoke-RestMethod $Url -TimeoutSec 30
  } catch {
    Add-Check "fail" $Label $_.Exception.Message
    return $null
  }
}

function Test-Page($Url, $Label) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 30
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
      Add-Check "pass" $Label ("HTTP {0}" -f $response.StatusCode)
      return
    }
    Add-Check "fail" $Label ("HTTP {0}" -f $response.StatusCode)
  } catch {
    Add-Check "fail" $Label $_.Exception.Message
  }
}

function Get-ProviderStatus($Capabilities, $Name) {
  if ($null -eq $Capabilities -or $null -eq $Capabilities.providers) {
    return $null
  }
  return $Capabilities.providers.$Name
}

$frontend = Normalize-Url $FrontendUrl
$backend = Normalize-Url $BackendUrl

Write-Host "AccessiNote hackathon readiness"
Write-Host "Frontend: $frontend"
Write-Host "Backend:  $backend"
Write-Host ""

$requiredDocs = @(
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/AZURE.md",
  "docs/DEMO.md",
  "docs/SAFETY.md",
  "docs/ATTRIBUTION.md",
  "docs/MICROSOFT_IQ.md",
  "docs/SUBMISSION.md"
)

foreach ($doc in $requiredDocs) {
  if (Test-Path $doc) {
    Add-Check "pass" "Doc $doc" "Found."
  } else {
    Add-Check "fail" "Doc $doc" "Missing required project documentation."
  }
}

if (Test-Path "docs/SUBMISSION.md") {
  $submission = Get-Content "docs/SUBMISSION.md" -Raw
  if ($submission -match 'Demo video URL: `TODO`' -or $submission -match 'Public GitHub repository URL: `TODO`') {
    Add-Check "warn" "Submission URLs" "Fill demo video and public GitHub URLs before final submission."
  } else {
    Add-Check "pass" "Submission URLs" "Submission URLs are filled."
  }
}

Write-Host ""
Test-Page $frontend "Frontend home"
Test-Page "$frontend/settings" "Frontend settings"

$health = Invoke-Json "$backend/health" "Backend health"
if ($null -ne $health -and $health.status -eq "ok") {
  Add-Check "pass" "Backend health" "API returned ok."
}

$capabilities = Invoke-Json "$backend/api/capabilities" "Capabilities API"
if ($null -ne $capabilities) {
  if ($capabilities.video_upload_enabled -eq $true -and $capabilities.image_upload_enabled -eq $true) {
    Add-Check "pass" "Upload APIs" "Image and video upload are enabled."
  } else {
    Add-Check "fail" "Upload APIs" "Image or video upload is disabled."
  }

  $iqReady = $true
  foreach ($providerName in @("transcription", "ocr", "generation")) {
    $provider = Get-ProviderStatus $capabilities $providerName
    if ($null -eq $provider -or -not ($provider.name -like "azure*") -or $provider.configured -ne $true) {
      $iqReady = $false
    }
  }
  if ($iqReady) {
    Add-Check "pass" "Microsoft IQ" "Azure Speech, Azure AI Vision, and Azure OpenAI are selected and configured."
  } else {
    Add-Check "warn" "Microsoft IQ" "Optional Azure providers are not all configured. Local fallback remains available."
  }
}

$demo = Invoke-Json "$backend/api/demo/status" "Demo readiness API"
if ($null -ne $demo) {
  if ($demo.ready -eq $true) {
    Add-Check "pass" "Demo readiness" "Demo checks are ready."
  } else {
    Add-Check "fail" "Demo readiness" "One or more demo checks failed."
  }
}

Write-Host ""
Write-Host ("Summary: {0} failure(s), {1} warning(s)." -f $failures.Count, $warnings.Count)
if ($failures.Count -gt 0) {
  exit 1
}
