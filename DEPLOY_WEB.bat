@echo off
echo ============================================================
echo           KADAL INVENTORY - ONE-CLICK WEB DEPLOY
echo ============================================================
echo.
echo This will automatically:
echo 1. Extract Supabase settings to public config
echo 2. Build the production web bundle with clean URLs
echo 3. Deploy the site to Firebase Hosting
echo.
echo [System] Starting build process...
call npm run build:web

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [Error] Build failed! Aborting deployment.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [System] Deploying to Firebase Hosting...
call firebase deploy --only hosting

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [Error] Firebase deployment failed! 
  echo Make sure you have logged in using 'firebase login' in CMD.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo ============================================================
echo [Success] Web app deployed successfully to Firebase!
echo Verification Portal is live!
echo ============================================================
echo.
pause
