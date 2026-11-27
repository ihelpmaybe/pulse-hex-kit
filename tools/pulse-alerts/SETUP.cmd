@echo off
setlocal
cd /d "%~dp0"
echo.
echo  Pulse alerts — setup
echo  --------------------
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo  Python not found. Install Python 3 from python.org and re-run.
  pause
  exit /b 1
)

if not exist config.env (
  copy /Y config.example.env config.env >nul
  echo  [1/3] Created config.env
) else (
  echo  [1/3] config.env already exists
)

echo  [2/3] Dry-run against public PulseX feed...
python alert.py --dry-run --once
if errorlevel 1 (
  echo  Dry-run failed. Check internet / Python.
  pause
  exit /b 1
)

echo.
echo  [3/3] Add Telegram credentials when YOU want alerts:
echo        - BotFather /newbot  →  BOT_TOKEN= in config.env
echo        - Message your bot, then:  python alert.py --chat-id
echo        - Put that number in CHAT_ID=
echo        - Then run START.cmd
echo.
echo  Opening config.env in Notepad...
notepad config.env
echo.
echo  Done. START.cmd runs the live loop once token + chat id are set.
pause
endlocal
