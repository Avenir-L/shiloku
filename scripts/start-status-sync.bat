@echo off
cd /d "%~dp0.."
echo Shiloku status sync - close this window to stop
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-status-sync.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-status.ps1" -Loop -Post -IntervalSeconds 5
pause
