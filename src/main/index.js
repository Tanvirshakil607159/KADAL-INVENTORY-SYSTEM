const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

let mainWindow = null;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Fix for GPU Cache and Access Denied errors
  app.commandLine.appendSwitch('disable-gpu-cache');
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disable-http-cache'); // Help with "Unable to move cache"
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700,
    title: 'KADAL Inventory',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
    show: false, backgroundColor: '#0f1117', autoHideMenuBar: true,
    icon: path.join(__dirname, '../../assets/logo.png'),
  });


  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5175');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // Keyboard shortcuts for refreshing and devtools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' && input.type === 'keyDown') {
      mainWindow.reload();
      event.preventDefault();
    } else if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

app.whenReady().then(async () => {
  try {
    const { initDatabase } = require('./database/connection');
    await initDatabase();
    
    const { registerIpcHandlers } = require('./ipc-handlers');
    registerIpcHandlers();
    
    createWindow();

    // Start Cloud Real-time Sync
    try {
      const CloudSyncService = require('./services/cloud-sync-service');
      CloudSyncService.init(mainWindow);
    } catch (e) {
      console.error('[CloudSync] Failed to initialize:', e.message);
    }

    // Initialize Professional Auto-Updater
    try {
      const UpdateService = require('./services/update-service');
      UpdateService.checkOnStartup(mainWindow);
    } catch (e) {
      console.error('[Update] Auto-update initialization failed:', e.message);
    }
  } catch (err) {
    dialog.showErrorBox('KADAL Startup Error', `Failed to start:\n\n${err.message}`);
    app.quit();
  }
});

process.on('uncaughtException', (err) => {
  dialog.showErrorBox('KADAL Error', `Unexpected error:\n\n${err.message}`);
});

app.on('window-all-closed', () => {
  try {
    const { closeDatabase } = require('./database/connection');
    closeDatabase();
    
    // Stop Cloud Sync
    const CloudSyncService = require('./services/cloud-sync-service');
    CloudSyncService.destroy();
  } catch (e) {}
  app.quit();
});
app.on('activate', () => { if (mainWindow === null) createWindow(); });
