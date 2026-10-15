@echo off
rem Stop mytask-manager windows opened by start.bat (backend and frontend)
taskkill /FI "WINDOWTITLE eq mytask-manager backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq mytask-manager frontend*" /T /F >nul 2>&1
echo mytask-manager stopped.
