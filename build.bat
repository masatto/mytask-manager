@echo off
rem Build Orbit as a single app (app\orbit.jar) from the frontend (npm) and backend (Maven).
rem Run this again after updating the code. Building needs Node.js and JDK 21.
rem   build.bat              build, restarting Orbit if it was running
rem   build.bat --no-pause   do not wait for a key at the end (used by start.bat)
setlocal
cd /d "%~dp0"

if not defined JAVA_HOME (
  for /d %%d in ("C:\Program Files\Eclipse Adoptium\jdk-21*") do set "JAVA_HOME=%%d"
)
if not defined JAVA_HOME (
  echo [ERROR] JDK 21 was not found. Install it or set JAVA_HOME.
  if /i not "%~1"=="--no-pause" pause
  exit /b 1
)
if not defined SERVER_PORT set "SERVER_PORT=8080"

echo [1/3] Building the screens (frontend)...
pushd frontend
if not exist node_modules call npm install
call npm run build
if errorlevel 1 goto fail_popd
popd

echo [2/3] Building the app (backend)...
pushd backend
call .\mvnw.cmd -q -Papp -DskipTests clean package
if errorlevel 1 goto fail_popd
popd

echo [3/3] Installing app\orbit.jar...
rem The running app locks the jar, so stop it first and start it again afterwards
set "WAS_RUNNING="
curl -sf -o nul http://127.0.0.1:%SERVER_PORT%/index.html
if not errorlevel 1 set "WAS_RUNNING=1"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' or Name='java.exe'\" | Where-Object { $_.CommandLine -like '*orbit.jar*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Wait-Process -Id $_.ProcessId -Timeout 15 -ErrorAction SilentlyContinue }"
if not exist app mkdir app
copy /y "backend\target-app\orbit.jar" "app\orbit.jar" >nul
if errorlevel 1 goto fail
if defined WAS_RUNNING (
  echo Restarting Orbit...
  call "%~dp0start.bat" --background
)
echo Done. Run start.bat to use Orbit.
if /i not "%~1"=="--no-pause" pause
exit /b 0

:fail_popd
popd
:fail
echo [ERROR] The build failed. See the messages above.
if /i not "%~1"=="--no-pause" pause
exit /b 1
