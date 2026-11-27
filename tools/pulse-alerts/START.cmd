@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo Python not found. Install Python 3, then re-run.
  pause
  exit /b 1
)

if not exist config.env (
  echo No config.env yet. Run SETUP.cmd first.
  pause
  exit /b 1
)

findstr /B /C:"BOT_TOKEN=" config.env | findstr /V /C:"BOT_TOKEN=$" | findstr /V /C:"BOT_TOKEN= $" >nul
if errorlevel 1 (
  echo BOT_TOKEN empty. Run SETUP.cmd or edit config.env
  echo Or test without Telegram:  python alert.py --dry-run --once
  pause
  exit /b 1
)

findstr /B /C:"CHAT_ID=" config.env | findstr /V /C:"CHAT_ID=$" | findstr /V /C:"CHAT_ID= $" >nul
if errorlevel 1 (
  echo CHAT_ID empty. Message your bot, then:  python alert.py --chat-id
  pause
  exit /b 1
)

echo Starting pulse-alerts (Ctrl+C to stop)...
python alert.py
endlocal
