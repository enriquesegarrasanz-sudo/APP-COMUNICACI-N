$ErrorActionPreference = "Stop"

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 3000
$url = "http://localhost:$port"

function Test-AppSpeakingReady {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-AppSpeakingReady)) {
  $serverCommand = "title APP SPEAKING && cd /d `"$projectPath`" && npm.cmd run dev -- -H 127.0.0.1 -p $port"

  Start-Process `
    -FilePath $env:ComSpec `
    -ArgumentList @("/k", $serverCommand) `
    -WorkingDirectory $projectPath `
    -WindowStyle Minimized

  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    if (Test-AppSpeakingReady) {
      break
    }

    Start-Sleep -Milliseconds 750
  }
}

$edgePaths = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$edgePath = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($edgePath) {
  Start-Process -FilePath $edgePath -ArgumentList "--app=$url"
} else {
  Start-Process $url
}
