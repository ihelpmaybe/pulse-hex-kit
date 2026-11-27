@echo off
setlocal
cd /d "%~dp0"
if not exist config.env (
  echo Copy config.example.env to config.env and set BOT_TOKEN + CHAT_ID
  echo Or run: python alert.py --dry-run --once
  copy /Y config.example.env config.env >nul
  echo Created config.env — edit it, then re-run START.cmd
  pause
  exit /b 1
)
python alert.py
endlocal
