<#
.SYNOPSIS
Installs and opens the NSIS package on a disposable GitHub-hosted Windows runner.
.PARAMETER Installer
Absolute or relative path to the NSIS executable.
.NOTES
The installer modifies the runner's per-user registry and shortcuts. Never run on a personal machine.
#>
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Installer)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'This smoke test requires a disposable GitHub-hosted runner.'
}
if (-not $env:RUNNER_TEMP -or -not (Test-Path -LiteralPath $env:RUNNER_TEMP -PathType Container)) {
    throw 'RUNNER_TEMP must be an existing temporary directory.'
}
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf) -or [IO.Path]::GetExtension($installerPath) -ne '.exe') {
    throw 'Installer must be an existing .exe file.'
}
# Avoid silently replacing a preexisting installation on the runner.
$uninstallRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
$existing = @(Get-ItemProperty -Path $uninstallRoot -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'ATUS Desktop' })
if ($existing.Count -ne 0) { throw 'An ATUS Desktop installation already exists.' }
$testRoot = Join-Path $env:RUNNER_TEMP ('atus-installer-' + [guid]::NewGuid().ToString('N'))
$installDir = Join-Path $testRoot 'app'
# NSIS requires /D= last and unquoted; hosted runners normally use a path without spaces.
if ($installDir -match '\s') { throw 'RUNNER_TEMP must not contain whitespace for NSIS /D=.' }
New-Item -ItemType Directory -Path $testRoot | Out-Null
$app = $null
$uninstaller = Join-Path $installDir 'uninstall.exe'
$failure = $null
try {
    $install = Start-Process -FilePath $installerPath -ArgumentList "/S /D=$installDir" -Wait -PassThru
    if ($install.ExitCode -ne 0) { throw "Installer exited with $($install.ExitCode)." }
    $binary = Join-Path $installDir 'atus-desktop.exe'
    if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { throw 'Installed application executable not found.' }
    if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw 'Uninstaller not found.' }
    # Redirect application-specific per-user paths during the smoke test.
    $savedAppData = $env:APPDATA; $savedLocalAppData = $env:LOCALAPPDATA; $savedUserProfile = $env:USERPROFILE
    try {
        $env:APPDATA = Join-Path $testRoot 'appdata'; $env:LOCALAPPDATA = Join-Path $testRoot 'localappdata'; $env:USERPROFILE = Join-Path $testRoot 'profile'
        @($env:APPDATA, $env:LOCALAPPDATA, $env:USERPROFILE) | ForEach-Object { New-Item -ItemType Directory -Path $_ | Out-Null }
        $app = Start-Process -FilePath $binary -PassThru
        $foundWindow = $false
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            Start-Sleep -Milliseconds 500
            $app.Refresh()
            if ($app.HasExited) { throw "Application exited with $($app.ExitCode) before opening a window." }
            if ($app.MainWindowHandle -ne [IntPtr]::Zero) { $foundWindow = $true; break }
        }
        if (-not $foundWindow) { throw 'Application window did not appear within 30 seconds.' }
        Write-Output 'Visible application window detected.'
    } finally {
        $env:APPDATA = $savedAppData; $env:LOCALAPPDATA = $savedLocalAppData; $env:USERPROFILE = $savedUserProfile
    }
} catch { $failure = $_ } finally {
    if ($null -ne $app -and -not $app.HasExited) { Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue; $app.WaitForExit() }
    if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
        try {
            $remove = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
            if ($remove.ExitCode -ne 0) { throw "Uninstaller exited with $($remove.ExitCode)." }
            # NSIS runs the real uninstaller from a temporary copy and can return before it finishes, so wait for the removal.
            for ($attempt = 0; $attempt -lt 60; $attempt++) {
                $remaining = @(Get-ItemProperty -Path $uninstallRoot -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'ATUS Desktop' })
                if (-not (Test-Path -LiteralPath (Join-Path $installDir 'atus-desktop.exe')) -and $remaining.Count -eq 0) { break }
                Start-Sleep -Milliseconds 500
            }
            if (Test-Path -LiteralPath (Join-Path $installDir 'atus-desktop.exe')) { throw 'Application remained installed after uninstall.' }
            if ($remaining.Count -ne 0) { throw 'Application registry entry remained after uninstall.' }
            Write-Output 'Application uninstalled.'
        } catch { if ($null -eq $failure) { $failure = $_ } else { Write-Warning "Uninstall failed: $_" } }
    } elseif (Test-Path -LiteralPath $installDir) {
        if ($null -eq $failure) { $failure = 'Installation directory exists but uninstaller was not found.' }
    }
    if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
if ($null -ne $failure) { throw $failure }
