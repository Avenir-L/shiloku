@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在释放 %~dp0 预览服务占用的 8765 端口...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kill-port.ps1" -Port 8765

if exist "%~dp0.preview-server.pid" del /f /q "%~dp0.preview-server.pid" >nul 2>&1

echo.
echo 8765 端口已清理。需要预览时请运行 start-local-preview.bat
echo.
pause
