@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if not "%1"=="auto" (
    echo ========================================
    echo   Shiloku Status Sync
    echo   - music / game activity to website
    echo   - auto post to website API (no Git push)
    echo ========================================
    echo.
    echo Close this window to stop sync.
    echo.
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-status.ps1" -Loop -Post -IntervalSeconds 10

if not "%1"=="auto" pause
