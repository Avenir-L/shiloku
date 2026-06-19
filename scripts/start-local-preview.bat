@echo off

chcp 65001 >nul

cd /d "%~dp0.."



echo 正在检查 8765 端口...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kill-port.ps1" -Port 8765 >nul 2>&1



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

echo 若端口仍被占用，请先运行 stop-local-preview.bat

echo.



set "PY=C:\Users\LunaFolia\AppData\Local\Programs\Python\Python312\python.exe"

if not exist "%PY%" set "PY=python"



"%PY%" "%~dp0local-preview-server.py"

if errorlevel 1 (

    echo.

    echo [错误] 预览服务未能启动。可先运行 stop-local-preview.bat 再重试。

    echo.

)

pause

