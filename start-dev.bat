@echo off
rem Start Orbit in development mode (backend: 8080 / frontend: 5173, screen changes apply instantly)
rem For everyday use, run start.bat instead.
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

rem The everyday app (start.bat) uses the same port 8080; the dev backend cannot start while it runs
curl -sf -o nul http://127.0.0.1:8080/index.html
if not errorlevel 1 (
  echo [ERROR] The everyday version of Orbit ^(start.bat^) is running. Run stop.bat first.
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
rem Wait 2 seconds (ping works even without an interactive console, unlike timeout)
ping -n 3 127.0.0.1 >nul
curl -s -o nul http://127.0.0.1:8080/api/health || goto wait
start "" http://127.0.0.1:5173/
endlocal
