<# Verifies input guards without running an installer; execute only on Windows. #>
$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '..\ci\smoke-windows-installer.ps1'
$savedActions = $env:GITHUB_ACTIONS; $savedEnvironment = $env:RUNNER_ENVIRONMENT; $savedTemp = $env:RUNNER_TEMP
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('atus-smoke-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $path = Join-Path $testRoot 'dummy.txt'
    Set-Content -LiteralPath $path -Value 'not an installer'
    $env:GITHUB_ACTIONS = 'false'; $env:RUNNER_ENVIRONMENT = 'github-hosted'; $env:RUNNER_TEMP = $testRoot
    $blocked = $false
    try { & $scriptPath -Installer $path } catch { $blocked = $_.Exception.Message -match 'disposable GitHub-hosted' }
    if (-not $blocked) { throw 'Non-runner execution was not rejected.' }
    $env:GITHUB_ACTIONS = 'true'
    $blocked = $false
    try { & $scriptPath -Installer $path } catch { $blocked = $_.Exception.Message -match 'existing .exe file' }
    if (-not $blocked) { throw 'Non-executable installer was not rejected.' }
    $blocked = $false
    try { & $scriptPath -Installer (Join-Path $testRoot 'missing.exe') } catch { $blocked = $true }
    if (-not $blocked) { throw 'Missing installer was not rejected.' }
    if ((Get-ChildItem -LiteralPath $testRoot).Count -ne 1) { throw 'Guard failures created unexpected files.' }
    Write-Output 'Windows installer smoke input guards passed.'
} finally {
    $env:GITHUB_ACTIONS = $savedActions; $env:RUNNER_ENVIRONMENT = $savedEnvironment; $env:RUNNER_TEMP = $savedTemp
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
