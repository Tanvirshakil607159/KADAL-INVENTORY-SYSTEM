@echo off
echo ============================================================
echo           KADAL INVENTORY - ONE-CLICK UPDATE
echo ============================================================
echo.
echo This will automatically:
echo 1. Increment the system version
echo 2. Build the latest code
echo 3. Upload to GitHub for all other users
echo 4. Save the installer to the 'installers' folder
echo.
echo [System] Forcing full release...
set GH_RELEASE_TYPE=release

node scripts/publish-update.js

echo.
echo ============================================================
echo Process Finished.
