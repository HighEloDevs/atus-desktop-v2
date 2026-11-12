<#
.SYNOPSIS
Runs the opt-in desktop smoke on a disposable GitHub-hosted Windows runner.
.NOTES
Requires a debug binary built with desktop-e2e, Node.js and frontend dependencies.
The test-only WebDriver is unauthenticated; never run this on a shared machine.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:OS -ne 'Windows_NT') {
    throw 'This smoke test requires a disposable GitHub-hosted Windows runner.'
}
if (-not $env:RUNNER_TEMP -or -not (Test-Path -LiteralPath $env:RUNNER_TEMP -PathType Container)) {
    throw 'RUNNER_TEMP must be an existing temporary directory.'
}
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$frontend = Join-Path $root 'src/frontend'
$appPath = Join-Path $root 'src/desktop/target/debug/atus-desktop.exe'
$vitePath = Join-Path $frontend 'node_modules/vite/bin/vite.js'
if (-not (Test-Path -LiteralPath $appPath -PathType Leaf) -or -not (Test-Path -LiteralPath $vitePath -PathType Leaf)) {
    throw 'Build the desktop-e2e debug binary and install frontend dependencies first.'
}
$node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
# Check both loopback ports before starting or contacting any server.
foreach ($port in @(1420, 4455)) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
    try { $listener.Start() } catch { throw "Test port $port is unavailable." } finally { $listener.Stop() }
}
$testDir = Join-Path $env:RUNNER_TEMP ('atus-desktop-e2e-' + [guid]::NewGuid().ToString('N'))
$vite = $null; $app = $null
$vars = @('TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ATUS_DESKTOP_E2E_PROJECT_DIR', 'ATUS_DESKTOP_E2E_URL', 'TAURI_WEBDRIVER_PORT')
$saved = @{}
foreach ($name in $vars) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
function Stop-TestProcess([Diagnostics.Process]$Process) {
    if ($null -eq $Process) { return }
    try {
        $Process.Refresh()
        if (-not $Process.HasExited) { $Process.Kill($true); $Process.WaitForExit() }
    } catch { Write-Warning "Failed to stop test process $($Process.Id): $_" }
}
function Wait-Http([string]$Url, [int]$Port, [Diagnostics.Process]$Process) {
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
        $Process.Refresh()
        if ($Process.HasExited) { throw "Process stopped before $Url was ready." }
        $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
        if ($listeners.Count -gt 0 -and -not ($listeners | Where-Object { $_.OwningProcess -eq $Process.Id })) {
            throw "Test port $Port is owned by an unexpected process."
        }
        if ($listeners.Count -eq 0) { Start-Sleep -Seconds 1; continue }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 1
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { return }
        } catch { }
        Start-Sleep -Seconds 1
    }
    throw "Timed out waiting for $Url."
}
try {
    New-Item -ItemType Directory -Path $testDir | Out-Null
    foreach ($name in @('projects', 'home', 'home/appdata', 'home/localappdata')) {
        New-Item -ItemType Directory -Path (Join-Path $testDir $name) | Out-Null
    }
    $env:TEMP = $testDir; $env:TMP = $testDir
    $env:USERPROFILE = Join-Path $testDir 'home'
    $env:APPDATA = Join-Path $testDir 'home/appdata'
    $env:LOCALAPPDATA = Join-Path $testDir 'home/localappdata'
    $env:ATUS_DESKTOP_E2E_PROJECT_DIR = Join-Path $testDir 'projects'
    $env:ATUS_DESKTOP_E2E_URL = 'http://127.0.0.1:4455'
    $env:TAURI_WEBDRIVER_PORT = '4455'
    $viteLog = Join-Path $testDir 'vite.log'; $viteErr = Join-Path $testDir 'vite.err.log'
    $appLog = Join-Path $testDir 'app.log'; $appErr = Join-Path $testDir 'app.err.log'
    $vite = Start-Process -FilePath $node -WorkingDirectory $frontend -ArgumentList './node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 1420 --strictPort' -RedirectStandardOutput $viteLog -RedirectStandardError $viteErr -PassThru
    Wait-Http 'http://127.0.0.1:1420/' 1420 $vite
    $app = Start-Process -FilePath $appPath -WorkingDirectory $root -RedirectStandardOutput $appLog -RedirectStandardError $appErr -PassThru
    Wait-Http 'http://127.0.0.1:4455/status' 4455 $app
    Push-Location $frontend
    try {
        & $node --test 'tests/desktop/smoke.e2e.mjs'
        if ($LASTEXITCODE -ne 0) { throw "Desktop smoke test failed with exit code $LASTEXITCODE." }
    } finally { Pop-Location }
} catch {
    foreach ($name in @('vite.log', 'vite.err.log', 'app.log', 'app.err.log')) {
        $path = Join-Path $testDir $name
        if (Test-Path -LiteralPath $path -PathType Leaf) { Write-Error "${name}:`n$(Get-Content -LiteralPath $path -Raw)" -ErrorAction Continue }
    }
    throw
} finally {
    Stop-TestProcess $app
    Stop-TestProcess $vite
    foreach ($name in $vars) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
    if (Test-Path -LiteralPath $testDir) { Remove-Item -LiteralPath $testDir -Recurse -Force }
}
