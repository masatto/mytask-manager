@echo off
rem Stop Orbit windows opened by start.bat (backend and frontend)
taskkill /FI "WINDOWTITLE eq Orbit backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Orbit frontend*" /T /F >nul 2>&1
rem Windows started before the app was renamed to Orbit
taskkill /FI "WINDOWTITLE eq mytask-manager backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq mytask-manager frontend*" /T /F >nul 2>&1
echo Orbit stopped.
