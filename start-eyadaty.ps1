$ErrorActionPreference = 'SilentlyContinue'
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:ADMIN_PASSWORD = 'Error404'
$env:ADMIN_EMAIL = 'admin@example.com'

$running = $false
try { Invoke-WebRequest 'http://127.0.0.1:4000/api/health' -TimeoutSec 2 | Out-Null; $running = $true } catch {}

if (-not $running) {
  $node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
  Start-Process -FilePath $node -ArgumentList ('"{0}\local-server.cjs"' -f $appDir) -WorkingDirectory $appDir -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

Start-Process 'http://127.0.0.1:4000/'
