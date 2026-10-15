@echo off
rem Start Orbit (backend: 8080 / frontend: 5173)
setlocal
cd /d "%~dp0"

if not defined JAVA_HOME (
  for /d %%d in ("C:\Program Files\Eclipse Adoptium\jdk-21*") do set "JAVA_HOME=%%d"
)
if not defined JAVA_HOME (
  echo [ERROR] JDK 21 was not found. Install it or set JAVA_HOME.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  pushd frontend
  call npm install
  popd
)

start "Orbit backend" /min cmd /k "cd /d ""%~dp0backend"" && .\mvnw.cmd spring-boot:run"
start "Orbit frontend" /min cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo Starting Orbit... the browser will open when ready.
:wait
timeout /t 2 /nobreak >nul
curl -s -o nul http://localhost:8080/api/health || goto wait
start "" http://localhost:5173/
endlocal
