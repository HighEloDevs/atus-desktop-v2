<# Verify safety guards without launching Vite or the desktop application. #>
$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '../desktop-e2e/run-windows.ps1'
$names = @('GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'RUNNER_TEMP')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:GITHUB_ACTIONS = 'false'; $env:RUNNER_ENVIRONMENT = 'github-hosted'
    $blocked = $false
    try { & $scriptPath } catch { $blocked = $_.Exception.Message -match 'disposable GitHub-hosted Windows runner' }
    if (-not $blocked) { throw 'Non-GitHub execution was not rejected.' }
    $env:GITHUB_ACTIONS = 'true'; $env:RUNNER_ENVIRONMENT = 'self-hosted'
    $blocked = $false
    try { & $scriptPath } catch { $blocked = $_.Exception.Message -match 'disposable GitHub-hosted Windows runner' }
    if (-not $blocked) { throw 'Self-hosted execution was not rejected.' }
    $env:RUNNER_ENVIRONMENT = 'github-hosted'; $env:RUNNER_TEMP = Join-Path ([IO.Path]::GetTempPath()) ('atus-missing-' + [guid]::NewGuid().ToString('N'))
    $blocked = $false
    try { & $scriptPath } catch { $blocked = $_.Exception.Message -match 'RUNNER_TEMP must be an existing temporary directory' }
    if (-not $blocked) { throw 'Missing temporary directory was not rejected.' }
    Write-Output 'Windows desktop runner guards passed.'
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
