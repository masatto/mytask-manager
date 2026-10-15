@echo off
rem Stop starting Orbit automatically at sign-in (removes the "Orbit" shortcut from your Startup folder).
setlocal
powershell -NoProfile -Command "$dir = if ($env:ORBIT_STARTUP_DIR) { $env:ORBIT_STARTUP_DIR } else { [Environment]::GetFolderPath('Startup') }; $lnk = Join-Path $dir 'Orbit.lnk'; if (Test-Path $lnk) { Remove-Item $lnk; Write-Host ('Removed: ' + $lnk) } else { Write-Host 'Autostart was not set up.' }"
if /i not "%~1"=="--no-pause" pause
endlocal
