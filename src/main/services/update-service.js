const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');

// Configure autoUpdater
autoUpdater.autoDownload = true; // Truly automatic download
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = console; // Log to main process stdout

const UpdateService = {
  /**
   * Check for updates on startup
   */
  async checkOnStartup(mainWindow) {
    if (!app.isPackaged) {
      console.log('[Update] Skipping update check: App not packaged.');
      return;
    }

    console.log('[Update] Initializing auto-updater...');

    autoUpdater.on('checking-for-update', () => {
      console.log('[Update] Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[Update] Update available:', info.version);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:available', info);
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[Update] Update not available.');
    });

    autoUpdater.on('download-progress', (progressObj) => {
      console.log(`[Update] Download progress: ${progressObj.percent.toFixed(2)}%`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:downloadProgress', {
          percent: progressObj.percent,
          bytesPerSecond: progressObj.bytesPerSecond,
          total: progressObj.total,
          transferred: progressObj.transferred
        });
      }
    });

    autoUpdater.on('update-downloaded', async (info) => {
      console.log('[Update] Update downloaded');
      
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

      // High-fidelity fallback list if no notes are returned
      if (!releaseNotesText) {
        releaseNotesText = `Release Notes & Key Changes (v${info.version}):\n` +
          `• Added Item Modal Nature Selector (Source vs. Production modes)\n` +
          `• Added Factory Production tracking and raw material consumption\n` +
          `• Added Dynamic Expected Product autocomplete inside issues\n` +
          `• Added Returnable/Non-Returnable categorization for Employee Issues\n` +
          `• UI polish and system performance enhancements`;
      }

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version v${info.version} has been downloaded. Would you like to restart and install it now?`,
        detail: releaseNotesText,
        buttons: ['Install and Restart', 'Later'],
        defaultId: 0
      });

      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('[Update] Error during update process:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:error', err.message);
      }
    });

    // Check for updates immediately
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      console.error('[Update] Initial check failed:', e.message);
    }

    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  },

  /**
   * Manually trigger an update check
   */
  async manualCheck(mainWindow) {
    if (!app.isPackaged) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Development Mode Updater',
        message: 'Automatic updates are disabled in development mode. Would you like to simulate/preview the new Release Notes Update Popup?',
        buttons: ['Yes, Simulate Update Popup', 'Cancel'],
        defaultId: 0
      });
      
      if (response === 0) {
        const mockVersion = '1.2.0';
        const releaseNotesText = `Release Notes & Key Changes (v${mockVersion}):\n` +
          `• Added Item Modal Nature Selector (Source vs. Production modes)\n` +
          `• Added Factory Production tracking and raw material consumption\n` +
          `• Added Dynamic Expected Product autocomplete inside issues\n` +
          `• Added Returnable/Non-Returnable categorization for Employee Issues\n` +
          `• UI polish and system performance enhancements`;

        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Update Ready',
          message: `Version v${mockVersion} has been downloaded. Would you like to restart and install it now?`,
          detail: releaseNotesText,
          buttons: ['Install and Restart (Simulated)', 'Later'],
          defaultId: 0
        });
      }
      return;
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      
      // If no update was found (result.updateInfo matches current)
      if (result && result.updateInfo.version === app.getVersion()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Up to Date',
          message: `You are already running the latest version (v${app.getVersion()}) of KADAL Inventory.`
        });
      }
    } catch (err) {
      console.error('[Update] Manual check failed:', err.message);
      if (err.message.includes('ENOENT') && err.message.includes('app-update.yml')) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Updates Not Configured',
          message: 'The update configuration file (app-update.yml) is missing. This application may not have been built for distribution.'
        });
      } else {
        dialog.showErrorBox('Update Error', `Failed to check for updates: ${err.message}`);
      }
    }
  }
};

module.exports = UpdateService;
