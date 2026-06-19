@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ========================================
echo   状态同步（只需要开这一个窗口）
echo   关掉窗口 = 停止同步
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-status-sync.ps1"

echo.
echo 正在启动同步（每 5 秒检测，换软件后约 8 秒内上传）...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-status.ps1" -Loop -Post -IntervalSeconds 5

pause
