const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Auto-increment patch version
const versionParts = pkg.version.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = versionParts.join('.');

console.log(`[Update] Bumping version from ${pkg.version} to ${newVersion}...`);
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

console.log(`[Update] Starting build and release process for v${newVersion}...`);
try {
  // Use cmd /c for Windows compatibility
  execSync('cmd /c "npm run release"', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log(`\n[Success] Version ${newVersion} has been published successfully!`);
  console.log(`[Success] Installer copied to installers/ folder.`);
} catch (error) {
  console.error('\n[Error] Update failed:', error.message);
  process.exit(1);
}
