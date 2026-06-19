@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ========================================
echo   状态同步（只需要开这一个窗口）
echo   关掉窗口 = 停止同步
echo ========================================
echo.

REM 关掉之前残留的同步进程，避免重复上传
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -match 'sync-status.ps1' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo 正在启动同步（每 5 秒检测，有变化才上传）...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-status.ps1" -Loop -Post -IntervalSeconds 5

pause
