const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const sourceDir = path.join(__dirname, '../release');
const targetDir = path.join(__dirname, '../installers');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}

// Find the .exe file in the release folder
// Example: KADAL Inventory Setup 1.1.0.exe
const version = pkg.version;
const exeName = `KADAL Inventory Setup ${version}.exe`;
const sourcePath = path.join(sourceDir, exeName);
const targetPath = path.join(targetDir, exeName);

if (fs.existsSync(sourcePath)) {
  console.log(`[Script] Copying ${exeName} to installers folder...`);
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`[Script] Successfully copied to: ${targetPath}`);
} else {
  console.error(`[Script] Installer not found at ${sourcePath}`);
  // Try finding any .exe if exact name fails (sometimes spaces are replaced)
  const files = fs.readdirSync(sourceDir);
  const fallback = files.find(f => f.endsWith('.exe') && f.includes(version));
  if (fallback) {
    console.log(`[Script] Found fallback: ${fallback}. Copying...`);
    fs.copyFileSync(path.join(sourceDir, fallback), path.join(targetDir, fallback));
  }
}
