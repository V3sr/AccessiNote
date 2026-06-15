param(
  [Parameter(Mandatory = $true)]
  [string]$FrontendUrl,

  [Parameter(Mandatory = $true)]
  [string]$BackendUrl
)

$ErrorActionPreference = "Stop"

function Normalize-Url($Url) {
  return $Url.TrimEnd("/")
}

function Assert-Condition($Condition, $Message) {
  if (-not $Condition) {
    throw $Message
  }
}

$frontend = Normalize-Url $FrontendUrl
$backend = Normalize-Url $BackendUrl

Write-Host "Checking frontend: $frontend"
$frontendResponse = Invoke-WebRequest -UseBasicParsing "$frontend" -TimeoutSec 20
Assert-Condition ($frontendResponse.StatusCode -ge 200 -and $frontendResponse.StatusCode -lt 400) "Frontend did not return a successful HTTP status."

Write-Host "Checking settings page"
$settingsResponse = Invoke-WebRequest -UseBasicParsing "$frontend/settings" -TimeoutSec 20
Assert-Condition ($settingsResponse.StatusCode -ge 200 -and $settingsResponse.StatusCode -lt 400) "Settings page did not return a successful HTTP status."

Write-Host "Checking backend health"
$health = Invoke-RestMethod "$backend/health" -TimeoutSec 20
Assert-Condition ($health.status -eq "ok") "Backend health check failed."

Write-Host "Checking backend capabilities"
$capabilities = Invoke-RestMethod "$backend/api/capabilities" -TimeoutSec 30
Assert-Condition ($capabilities.video_upload_enabled -eq $true) "Video upload is not enabled."
Assert-Condition ($capabilities.image_upload_enabled -eq $true) "Image upload is not enabled."

Write-Host "Checking production readiness"
$production = Invoke-RestMethod "$backend/api/production/status" -TimeoutSec 30
if ($production.ready -ne $true) {
  $production.checks | ForEach-Object {
    Write-Host ("[{0}] {1}: {2}" -f $_.status, $_.label, $_.detail)
  }
  throw "Production readiness failed."
}

Write-Host "Checking demo readiness"
$demo = Invoke-RestMethod "$backend/api/demo/status" -TimeoutSec 30
Assert-Condition ($demo.ready -eq $true) "Demo readiness failed."

Write-Host "Production smoke check passed."
