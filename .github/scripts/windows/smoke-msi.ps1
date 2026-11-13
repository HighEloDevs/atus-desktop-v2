<#
.SYNOPSIS
Installs, opens and removes the MSI package on a disposable GitHub-hosted Windows runner.
.PARAMETER Installer
Absolute or relative path to the .msi file.
.NOTES
The MSI installs for the whole machine and writes to HKLM and Program Files. Never run on a personal machine.
Run it after smoke-nsis.ps1, which removes the per-user installation first.
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
$msi = (Resolve-Path -LiteralPath $Installer).Path
if (-not (Test-Path -LiteralPath $msi -PathType Leaf) -or [IO.Path]::GetExtension($msi) -ne '.msi') {
    throw 'Installer must be an existing .msi file.'
}
function Get-Installed {
    $roots = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    @(Get-ItemProperty -Path $roots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'ATUS Desktop' })
}
if ((Get-Installed).Count -ne 0) { throw 'An ATUS Desktop installation already exists.' }
$testRoot = Join-Path $env:RUNNER_TEMP ('atus-msi-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$log = Join-Path $env:RUNNER_TEMP 'atus-msi-install.log'
$app = $null
$failure = $null
$installed = $false
try {
    $install = Start-Process -FilePath msiexec.exe -ArgumentList @('/i', "`"$msi`"", '/qn', '/norestart', '/l*v', "`"$log`"") -Wait -PassThru
    # 3010 means the install worked but asks for a restart.
    if ($install.ExitCode -ne 0 -and $install.ExitCode -ne 3010) { throw "msiexec /i exited with $($install.ExitCode)." }
    $installed = $true
    if ((Get-Installed).Count -eq 0) { throw 'MSI did not register an ATUS Desktop installation.' }
    $candidates = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA) | Where-Object { $_ } | ForEach-Object { Join-Path $_ 'ATUS Desktop\atus-desktop.exe' }
    $binary = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (-not $binary) { throw "Installed executable not found in: $($candidates -join ', ')" }
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
    if ($installed) {
        try {
            $remove = Start-Process -FilePath msiexec.exe -ArgumentList @('/x', "`"$msi`"", '/qn', '/norestart') -Wait -PassThru
            if ($remove.ExitCode -ne 0 -and $remove.ExitCode -ne 3010) { throw "msiexec /x exited with $($remove.ExitCode)." }
            if ((Get-Installed).Count -ne 0) { throw 'Application registry entry remained after uninstall.' }
            Write-Output 'Application uninstalled.'
        } catch { if ($null -eq $failure) { $failure = $_ } else { Write-Warning "Uninstall failed: $_" } }
    }
    if ($null -ne $failure -and (Test-Path -LiteralPath $log)) { Write-Output '--- msiexec log (tail) ---'; Get-Content -LiteralPath $log -Tail 60 }
    if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
if ($null -ne $failure) { throw $failure }
