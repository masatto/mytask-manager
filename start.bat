@echo off
rem Start Orbit as a single background app (no console window): http://127.0.0.1:8080/
rem   start.bat               start (if needed) and open the browser
rem   start.bat --background  start without opening the browser (for autostart at login)
rem For development with instant screen updates, use start-dev.bat instead.
setlocal
cd /d "%~dp0"

rem Settings (environment variables override them; Spring Boot reads SERVER_PORT and LOGGING_FILE_NAME)
if not defined SERVER_PORT set "SERVER_PORT=8080"
if not defined LOGGING_FILE_NAME set "LOGGING_FILE_NAME=%USERPROFILE%\.mytask-manager\logs\orbit.log"
set "HEALTH=http://127.0.0.1:%SERVER_PORT%/api/health"

rem Already running?
curl -s -o nul %HEALTH%
if not errorlevel 1 goto running

if not defined JAVA_HOME (
  for /d %%d in ("C:\Program Files\Eclipse Adoptium\jdk-21*") do set "JAVA_HOME=%%d"
)
if not defined JAVA_HOME (
  echo [ERROR] JDK 21 was not found. Install it or set JAVA_HOME.
  pause
  exit /b 1
)

if not exist "app\orbit.jar" (
  echo Orbit has not been built yet. Building it now, this takes a few minutes the first time...
  call "%~dp0build.bat" --no-pause
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

start "" "%JAVA_HOME%\bin\javaw.exe" -Xmx512m -jar "%~dp0app\orbit.jar"
echo Starting Orbit...
set /a tries=0
:wait
rem Wait 1 second (ping works even without an interactive console, unlike timeout)
ping -n 2 127.0.0.1 >nul
curl -s -o nul %HEALTH%
if not errorlevel 1 goto open
set /a tries+=1
if %tries% lss 90 goto wait
echo [ERROR] Orbit did not start. See the log: %LOGGING_FILE_NAME%
pause
exit /b 1

:running
rem The development backend (start-dev.bat) also answers on this port, but it has no screens built in
curl -sf -o nul http://127.0.0.1:%SERVER_PORT%/index.html
if not errorlevel 1 goto open
echo [ERROR] The development version (start-dev.bat) is running on port %SERVER_PORT%. Run stop.bat first.
pause
exit /b 1

:open
if /i "%~1"=="--background" exit /b 0
start "" http://127.0.0.1:%SERVER_PORT%/
endlocal
