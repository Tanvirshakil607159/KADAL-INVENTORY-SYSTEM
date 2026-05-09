const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const { getDbPath, setRestoring } = require('../database/connection');

const BackupService = {
  create() {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found');
    }

    const backupDir = this.getBackupDir();
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `kadal-backup-${timestamp}.db`;
    const backupPath = path.join(backupDir, backupName);

    fs.copyFileSync(dbPath, backupPath);

    return {
      success: true,
      path: backupPath,
      name: backupName,
      size: fs.statSync(backupPath).size,
      createdAt: new Date().toISOString(),
    };
  },

  async restore(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Backup file not found');
    }

    // Validate it's a valid SQLite file
    const header = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);

    if (header.toString('ascii', 0, 15) !== 'SQLite format 3') {
      throw new Error('Invalid backup file: not a valid SQLite database');
    }

    const dbPath = getDbPath();

    // Create a safety backup before restore
    const safetyBackup = dbPath + '.pre-restore';
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, safetyBackup);
    }

    try {
      setRestoring(true);
      fs.copyFileSync(filePath, dbPath);
      
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 2000);
      
      return { success: true, message: 'Database restored! Restarting application...' };
    } catch (err) {
      setRestoring(false);
      // Restore the safety backup
      if (fs.existsSync(safetyBackup)) {
        fs.copyFileSync(safetyBackup, dbPath);
      }
      throw new Error('Restore failed: ' + err.message);
    }
  },

  getHistory() {
    const backupDir = this.getBackupDir();
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('kadal-backup-') && f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return {
          name: f,
          path: path.join(backupDir, f),
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files;
  },

  getBackupDir() {
    const SettingsRepo = require('../database/repositories/settings');
    const customPath = SettingsRepo.get('backup_path');
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }
    return path.join(app.getPath('userData'), 'backups');
  },

  async selectFile() {
    const result = await dialog.showOpenDialog({
      title: 'Select Backup File',
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  },

  async selectDirectory() {
    const result = await dialog.showOpenDialog({
      title: 'Select Backup Directory',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  },

  async download(sourcePath) {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error('Backup file not found');
    }
    
    const fileName = path.basename(sourcePath);
    
    const result = await dialog.showSaveDialog({
      title: 'Save Backup File',
      defaultPath: fileName,
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
    });
    
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    
    try {
      fs.copyFileSync(sourcePath, result.filePath);
      return { success: true, path: result.filePath };
    } catch (err) {
      throw new Error('Download failed: ' + err.message);
    }
  },
};

module.exports = BackupService;
