const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');

// Configure autoUpdater
autoUpdater.autoDownload = false; // We'll ask the user before downloading
autoUpdater.autoInstallOnAppQuit = true;

const UpdateService = {
  /**
   * Check for updates on startup
   */
  async checkOnStartup(mainWindow) {
    if (!app.isPackaged) return;

    console.log('[Update] Initializing auto-updater...');

    autoUpdater.on('update-available', async (info) => {
      console.log('[Update] Update available:', info.version);
      
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (v${info.version}) of KADAL Inventory is available. Would you like to download it now?`,
        buttons: ['Download Now', 'Later'],
        defaultId: 0
      });

      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });

    autoUpdater.on('update-downloaded', async (info) => {
      console.log('[Update] Update downloaded');
      
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'The update has been downloaded and is ready to install. Would you like to restart and install now?',
        buttons: ['Install and Restart', 'Later'],
        defaultId: 0
      });

      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('[Update] Error:', err.message);
    });

    // Check for updates immediately
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      console.error('[Update] Check failed:', e.message);
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
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result || !result.updateInfo) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Up to Date',
          message: 'You are already running the latest version of KADAL Inventory.'
        });
      }
    } catch (err) {
      dialog.showErrorBox('Update Error', `Failed to check for updates: ${err.message}`);
    }
  }
};

module.exports = UpdateService;
