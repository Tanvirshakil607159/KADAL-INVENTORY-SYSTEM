@echo off
echo ============================================================
echo           KADAL INVENTORY - ONE-CLICK UPDATE
echo ============================================================
echo.
echo This will automatically:
echo 1. Increment the system version
echo 2. Commit your local changes
echo 3. Push a new release tag to GitHub
echo 4. Trigger GitHub Actions to automatically build and release
echo.
echo [System] Starting update push...

node scripts/publish-update.js

echo.
echo ============================================================
echo Process Finished.
