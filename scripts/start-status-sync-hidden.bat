@echo off
cd /d "%~dp0.."
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0sync-status.ps1" -Loop -Push
