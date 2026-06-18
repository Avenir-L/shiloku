@echo off
chcp 65001 >nul
cd /d "%~dp0.."

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":8765 .*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

if not exist "%~dp0secrets.local.json" (
    echo.
    echo [提示] AI 小助手需要 API Key
    echo        复制 secrets.local.json.example 为 secrets.local.json
    echo        并填入 deepseekApiKey
    echo.
)

echo ========================================
echo   Shiloku 本地预览
echo   http://localhost:8765/index.html
echo ========================================
echo.
echo 关闭此窗口即停止预览
echo.

C:\Users\LunaFolia\AppData\Local\Programs\Python\Python312\python.exe "%~dp0local-preview-server.py"
pause
