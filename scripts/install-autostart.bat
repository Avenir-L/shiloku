@echo off
cd /d "%~dp0"
echo Installing Shiloku status autostart...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-shortcuts.ps1"
echo.
echo Done. Sync will start ~20s after each login.
pause
