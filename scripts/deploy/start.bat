@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 光子文化官网
echo.
echo  Starting Guanzi site...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 (
  echo.
  echo Failed. See 使用说明.txt
  pause
)
