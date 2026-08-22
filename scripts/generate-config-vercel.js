const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../src/renderer/public');
const configPath = path.join(publicDir, 'config.json');

function run() {
  console.log('[Vercel Config Generator] Generating config.json for web deployment...');

  // Priority 1: Environment variables (set in Vercel dashboard)
  let url = process.env.SUPABASE_URL || '';
  let key = process.env.SUPABASE_KEY || '';

  if (url && key) {
    console.log('[Vercel Config Generator] Using environment variables.');
    writeConfig(url, key);
    return;
  }

  // Priority 2: Existing config.json (from previous build:web run)
  if (fs.existsSync(configPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (existing.supabase_url && existing.supabase_key) {
        console.log('[Vercel Config Generator] Using existing config.json (has credentials).');
        return; // Already good, no need to overwrite
      }
    } catch (e) {
      console.warn('[Vercel Config Generator] Failed to parse existing config.json:', e.message);
    }
  }

  // Priority 3: Write empty config (user will need to provide via URL params or Cloud Setup page)
  console.warn('[Vercel Config Generator] No Supabase credentials found. Writing empty config.');
  console.warn('  Set SUPABASE_URL and SUPABASE_KEY env vars in Vercel, or run "npm run build:web" locally first.');
  writeConfig('', '');
}

function writeConfig(url, key) {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const configData = {
    supabase_url: url,
    supabase_key: key
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  console.log('[Vercel Config Generator] Successfully wrote config.json to:', configPath);
}

run();
