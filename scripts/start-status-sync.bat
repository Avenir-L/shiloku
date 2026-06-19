@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if not "%1"=="auto" (
    echo ========================================
    echo   Shiloku Status Sync
    echo   - music / game activity to website
    echo   - auto push to GitHub
    echo ========================================
    echo.
    echo Close this window to stop sync.
    echo.
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-status.ps1" -Loop -Push -IntervalSeconds 15

if not "%1"=="auto" pause
