@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-status-invisible.ps1" %*
