<#
.SYNOPSIS
Presses the quick analysis shortcut (Ctrl+Win+B) with synthetic keyboard input.
.NOTES
Used only by the desktop integration test, on a disposable runner with an interactive desktop.
#>
$ErrorActionPreference = 'Stop'
Add-Type -Namespace Atus -Name Keyboard -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, System.UIntPtr extra);'
$ctrl = 0x11; $win = 0x5B; $b = 0x42; $keyUp = 0x2
foreach ($key in @($ctrl, $win, $b)) { [Atus.Keyboard]::keybd_event($key, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40 }
foreach ($key in @($b, $win, $ctrl)) { [Atus.Keyboard]::keybd_event($key, 0, $keyUp, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40 }
