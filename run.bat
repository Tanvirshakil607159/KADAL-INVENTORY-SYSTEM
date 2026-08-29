@echo off
title KADAL Inventory System
cd /d "%~dp0"
echo ==========================================
echo    KA Design Accessories LTD - KADAL
echo ==========================================
echo.
echo Starting Dev Servers (React + Electron)...
echo.
cmd /c "npm run dev"
pause
