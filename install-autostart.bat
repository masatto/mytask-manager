@echo off
rem Start Orbit automatically when you sign in to Windows (no browser window; started minimized).
rem Creates a shortcut "Orbit" in your Startup folder that runs "start.bat --background".
rem Undo with uninstall-autostart.bat.
setlocal
set "ORBIT_DIR=%~dp0"
powershell -NoProfile -Command "$dir = if ($env:ORBIT_STARTUP_DIR) { $env:ORBIT_STARTUP_DIR } else { [Environment]::GetFolderPath('Startup') }; $s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $dir 'Orbit.lnk')); $s.TargetPath = (Join-Path $env:ORBIT_DIR 'start.bat'); $s.Arguments = '--background'; $s.WorkingDirectory = $env:ORBIT_DIR; $s.WindowStyle = 7; $s.Description = 'Start Orbit in the background'; $s.Save(); Write-Host ('Created: ' + (Join-Path $dir 'Orbit.lnk'))"
if errorlevel 1 (
  echo [ERROR] Could not create the shortcut.
  if /i not "%~1"=="--no-pause" pause
  exit /b 1
)
echo Orbit will start automatically the next time you sign in.
if /i not "%~1"=="--no-pause" pause
endlocal
