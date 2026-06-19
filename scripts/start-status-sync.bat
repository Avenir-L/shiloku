@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if not "%1"=="auto" (
    echo ========================================
    echo   Shiloku 在线状态同步
    echo   - 网易云歌名 / 游戏状态
    echo   - 自动推送到网站
    echo ========================================
    echo.
    echo 关闭此窗口将停止同步
    echo.
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-status.ps1" -Loop -Push -IntervalSeconds 15

if not "%1"=="auto" pause
