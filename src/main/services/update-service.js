const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');

// Configure autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

// Force the correct GitHub provider config — ensures update checks work
// even if app-update.yml is missing or misconfigured in the installed app
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'Tanvirshakil607159',
  repo: 'KADAL-INVENTORY-SYSTEM',
  releaseType: 'release',
});

// Use console for logging
autoUpdater.logger = console;
autoUpdater.logger.transports = undefined; // Avoid file transport issues

const UpdateService = {
  _retryCount: 0,
  _maxRetries: 3,
  _retryDelay: 60000, // 1 minute between retries

  /**
   * Check for updates on startup
   */
  async checkOnStartup(mainWindow) {
    if (!app.isPackaged) {
      console.log('[Update] Skipping update check: App not packaged (dev mode).');
      return;
    }

    const currentVersion = app.getVersion();
    console.log(`[Update] Initializing auto-updater for v${currentVersion}...`);
    console.log(`[Update] Update feed: github.com/Tanvirshakil607159/KADAL-INVENTORY-SYSTEM`);

    autoUpdater.on('checking-for-update', () => {
      console.log('[Update] Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log(`[Update] Update available: v${info.version} (current: v${currentVersion})`);
      this._retryCount = 0; // Reset retries on success
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:available', {
          version: info.version,
          currentVersion: currentVersion,
          releaseDate: info.releaseDate,
          releaseName: info.releaseName,
        });
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log(`[Update] Already on latest version (v${currentVersion}). Server version: v${info.version}`);
      this._retryCount = 0; // Reset retries on success
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const msg = `[Update] Download: ${progressObj.percent.toFixed(1)}% | ${(progressObj.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s | ${(progressObj.transferred / 1024 / 1024).toFixed(1)}/${(progressObj.total / 1024 / 1024).toFixed(1)} MB`;
      console.log(msg);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:downloadProgress', {
          percent: progressObj.percent,
          bytesPerSecond: progressObj.bytesPerSecond,
          total: progressObj.total,
          transferred: progressObj.transferred,
        });
      }
    });

    autoUpdater.on('update-downloaded', async (info) => {
      console.log(`[Update] Download complete: v${info.version}`);

      // Parse and format release notes
      let releaseNotesText = '';
      if (info.releaseNotes) {
        let rawNotes = '';
        if (typeof info.releaseNotes === 'string') {
          rawNotes = info.releaseNotes;
        } else if (Array.isArray(info.releaseNotes)) {
          rawNotes = info.releaseNotes.map(n => n.note || '').join('\n');
        } else {
          rawNotes = JSON.stringify(info.releaseNotes);
        }

        // Sanitize notes for native OS dialog box display
        const cleanNotes = rawNotes
          .replace(/<[^>]*>/g, '') // Strip HTML tags
          .replace(/#+\s+/g, '')   // Strip headers
          .replace(/\*{1,2}/g, '') // Strip bold/italic markdown
          .replace(/`{1,3}/g, '')  // Strip inline code backticks
          .trim();

        if (cleanNotes) {
          releaseNotesText = `Release Notes:\n${cleanNotes}`;
        }
      }

      // Fallback release notes
      if (!releaseNotesText) {
        releaseNotesText = `New Version v${info.version} is ready to install.\n\n` +
          `This update includes the latest improvements and bug fixes.`;
      }

      if (!mainWindow || mainWindow.isDestroyed()) {
        console.log('[Update] No main window available, will install on quit.');
        return;
      }

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version v${info.version} has been downloaded.\nWould you like to restart and install it now?`,
        detail: releaseNotesText,
        buttons: ['Install and Restart', 'Later'],
        defaultId: 0,
      });

      if (response === 0) {
        console.log('[Update] User accepted — quitting and installing...');
        autoUpdater.quitAndInstall(false, true);
      } else {
        console.log('[Update] User deferred — will install on next app quit.');
      }
    });

    autoUpdater.on('error', (err) => {
      const errorMsg = err.message || String(err);
      console.error(`[Update] Error: ${errorMsg}`);

      // Send error to renderer for visibility
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:error', errorMsg);
      }

      // Retry logic for transient network errors
      if (this._retryCount < this._maxRetries) {
        this._retryCount++;
        const delay = this._retryDelay * this._retryCount;
        console.log(`[Update] Will retry in ${delay / 1000}s (attempt ${this._retryCount}/${this._maxRetries})...`);
        setTimeout(() => {
          console.log(`[Update] Retrying update check (attempt ${this._retryCount})...`);
          autoUpdater.checkForUpdates().catch(e => {
            console.error(`[Update] Retry ${this._retryCount} failed:`, e.message);
          });
        }, delay);
      }
    });

    // Initial check — delayed slightly to let the app fully initialize
    setTimeout(async () => {
      try {
        console.log('[Update] Running initial update check...');
        const result = await autoUpdater.checkForUpdates();
        if (result) {
          console.log(`[Update] Check result: server version = v${result.updateInfo.version}, current = v${currentVersion}`);
        }
      } catch (e) {
        console.error(`[Update] Initial check failed: ${e.message}`);
        // Will retry via the error handler
      }
    }, 5000);

    // Periodic check — every 1 hour
    setInterval(() => {
      console.log('[Update] Running periodic update check...');
      autoUpdater.checkForUpdates().catch(e => {
        console.error(`[Update] Periodic check failed: ${e.message}`);
      });
    }, 1 * 60 * 60 * 1000);
  },

  /**
   * Manually trigger an update check (from Settings UI)
   */
  async manualCheck(mainWindow) {
    if (!app.isPackaged) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Development Mode',
        message: 'Auto-updates are disabled in development mode.\nWould you like to simulate the update dialog?',
        buttons: ['Yes, Simulate', 'Cancel'],
        defaultId: 0,
      });

      if (response === 0) {
        const mockVersion = '1.2.0';
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Update Ready (Simulated)',
          message: `Version v${mockVersion} has been downloaded.`,
          detail: `New Version v${mockVersion} is ready to install.\n\nThis update includes the latest improvements and bug fixes.`,
          buttons: ['Install and Restart (Simulated)', 'Later'],
          defaultId: 0,
        });
      }
      return;
    }

    try {
      console.log('[Update] Manual update check requested...');
      const result = await autoUpdater.checkForUpdates();

      // If no update was found
      if (result && result.updateInfo.version === app.getVersion()) {
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Up to Date',
          message: `You are running the latest version (v${app.getVersion()}).`,
          detail: `Feed: github.com/Tanvirshakil607159/KADAL-INVENTORY-SYSTEM\nLast checked: ${new Date().toLocaleString()}`,
        });
      }
    } catch (err) {
      console.error('[Update] Manual check failed:', err.message);

      let userMessage = `Failed to check for updates.\n\nError: ${err.message}`;

      if (err.message.includes('ENOENT') && err.message.includes('app-update.yml')) {
        userMessage = 'The update configuration file (app-update.yml) is missing.\n' +
          'This can happen if the app was not installed from an official installer.\n\n' +
          'Please download and install the latest version from:\n' +
          'https://github.com/Tanvirshakil607159/KADAL-INVENTORY-SYSTEM/releases/latest';
      } else if (err.message.includes('net::') || err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT')) {
        userMessage = 'Unable to reach the update server.\n\n' +
          'Please check your internet connection and try again.';
      }

      await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Update Check Failed',
        message: userMessage,
      });
    }
  },
};

module.exports = UpdateService;
