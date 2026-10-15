@echo off
rem Stop Orbit, however it was started
rem The app started by start.bat (javaw running orbit.jar)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' or Name='java.exe'\" | Where-Object { $_.CommandLine -like '*orbit.jar*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Wait-Process -Id $_.ProcessId -Timeout 15 -ErrorAction SilentlyContinue }"
rem The windows opened by start-dev.bat
taskkill /FI "WINDOWTITLE eq Orbit backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Orbit frontend*" /T /F >nul 2>&1
rem Windows started before the app was renamed to Orbit
taskkill /FI "WINDOWTITLE eq mytask-manager backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq mytask-manager frontend*" /T /F >nul 2>&1
echo Orbit stopped.
