@echo off
setlocal
set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
set "APP_DIR=%~dp0"

if not exist "%NODE_EXE%" (
  echo Node.js was not found at %NODE_EXE%
  pause
  exit /b 1
)

schtasks.exe /Create /TN "Eyadaty Server" /TR "\"%NODE_EXE%\" \"%APP_DIR%server.js\"" /SC ONLOGON /RL LIMITED /F
if errorlevel 1 (
  echo Could not install the automatic startup task.
  pause
  exit /b 1
)

echo Eyadaty will start automatically when you sign in to Windows.
echo To start it now, double-click start-eyadaty.cmd
pause
endlocal
