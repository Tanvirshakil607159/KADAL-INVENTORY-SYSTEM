@echo off
title KADAL Inventory - Build and Deploy
echo ============================================
echo   KADAL Inventory - Build ^& Deploy
echo ============================================
echo.

:: Kill running instances
echo [1/5] Closing running KADAL instances...
taskkill /IM "KADAL Inventory.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

:: Clean old release
echo [2/5] Cleaning old build...
rd /s /q "release" >nul 2>&1

:: Build frontend
echo [3/5] Building frontend...
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)

:: Build portable app
echo [4/5] Packaging portable app...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --dir --win

:: Create version.json with build timestamp
echo [5/5] Creating version info...
for /f "tokens=*" %%a in ('node -e "const p=require('./package.json'); const d=new Date().toISOString(); console.log(JSON.stringify({version:p.version,buildTime:d,description:p.description},null,2))"') do (
    echo %%a >> "release\win-unpacked\version.json"
)
:: Also create in root for reference
copy "release\win-unpacked\version.json" "release\version.json" >nul 2>&1

echo.
echo ============================================
echo   BUILD COMPLETE!
echo ============================================
echo.
echo   Portable App: release\win-unpacked\
echo.

:: Ask to deploy to cloud sync folder
echo Do you want to deploy this update to Cloud Sync folder?
echo (Other PCs will auto-update on next launch)
echo.
set /p DEPLOY=Deploy to cloud? (Y/N): 

if /i "%DEPLOY%"=="Y" (
    set /p SYNC_FOLDER=Enter sync folder path (e.g. G:\My Drive\KADAL-Sync): 
    
    if not "!SYNC_FOLDER!"=="" (
        echo.
        echo Deploying to: %SYNC_FOLDER%\app-update\
        
        :: Create update folder
        mkdir "%SYNC_FOLDER%\app-update" >nul 2>&1
        
        :: Clean old update
        rd /s /q "%SYNC_FOLDER%\app-update\win-unpacked" >nul 2>&1
        
        :: Copy new build
        echo Copying files... (this may take a moment)
        xcopy "release\win-unpacked" "%SYNC_FOLDER%\app-update\win-unpacked\" /E /I /Q /Y
        copy "release\win-unpacked\version.json" "%SYNC_FOLDER%\app-update\version.json" /Y >nul
        
        echo.
        echo ============================================
        echo   DEPLOYED TO CLOUD!
        echo ============================================
        echo   Google Drive will sync to other PCs.
        echo   They will see the update on next launch.
        echo ============================================
    )
)

echo.
pause
