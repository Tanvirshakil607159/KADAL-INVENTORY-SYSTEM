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

const cwd = path.join(__dirname, '..');

console.log(`[Update] Committing changes and creating tag v${newVersion}...`);
try {
  // Stage all changes
  execSync('git add .', { stdio: 'inherit', cwd });
  
  // Commit with a standard message
  execSync(`git commit -m "chore: release v${newVersion}"`, { stdio: 'inherit', cwd });
  
  // Create a new git tag
  execSync(`git tag v${newVersion}`, { stdio: 'inherit', cwd });
  
  // Push the commit and the tag to GitHub
  console.log(`[Update] Pushing to GitHub to trigger GitHub Actions...`);
  // Push the tag FIRST to ensure the GitHub Action triggers even if main branch push fails
  execSync(`git push origin v${newVersion}`, { stdio: 'inherit', cwd });
  execSync('git push origin main', { stdio: 'inherit', cwd });

  console.log(`\n[Success] Version ${newVersion} pushed to GitHub successfully!`);
  console.log(`[Success] GitHub Actions will now build and publish the release in the background.`);
  console.log(`[Success] You can check the progress in the 'Actions' tab of your GitHub repository.`);
} catch (error) {
  console.error('\n[Error] Update failed:', error.message);
  process.exit(1);
}
