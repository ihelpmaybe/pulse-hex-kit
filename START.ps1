# Pulse HEX launch kit — local static server + open hub
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8787
$Url = "http://127.0.0.1:$Port/"

function Test-Up {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

Set-Location -LiteralPath $Root

if (-not (Test-Up)) {
  $py = Get-Command python -ErrorAction SilentlyContinue
  if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
  if (-not $py) {
    Write-Host "Python not found. Open index.html directly, or install Python and re-run START."
    Start-Process -FilePath (Join-Path $Root "index.html")
    exit 1
  }
  Write-Host "Starting local server on $Url"
  Start-Process -FilePath $py.Source `
    -ArgumentList "-m","http.server","$Port","--bind","127.0.0.1" `
    -WorkingDirectory $Root `
    -WindowStyle Minimized
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (Test-Up) { break }
  }
}

if (Test-Up) {
  Write-Host "Hub: $Url"
  Start-Process $Url
} else {
  Write-Host "Server did not come up — opening index.html file instead."
  Start-Process -FilePath (Join-Path $Root "index.html")
}
