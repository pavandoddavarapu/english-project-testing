/**
 * scripts/build.js
 * 
 * Production build script.
 * Automates service worker cache versioning by injecting a unique timestamp build hash.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function build() {
  console.log('⚡ Starting production build steps...');

  const swPath = path.join(rootDir, 'sw.js');
  if (!fs.existsSync(swPath)) {
    console.error('❌ sw.js not found!');
    process.exit(1);
  }

  // 1. Generate unique build hash based on current UTC timestamp
  const buildHash = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14); // e.g., 20260605174512
  const newCacheName = `speakup-cache-v${buildHash}`;

  // 2. Read and update sw.js
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Replace: const CACHE_NAME = '...';
  const cacheRegex = /const\s+CACHE_NAME\s*=\s*['"`](speakup-cache-v[^'"`]*)['"`];/;
  
  if (cacheRegex.test(swContent)) {
    swContent = swContent.replace(cacheRegex, `const CACHE_NAME = '${newCacheName}';`);
    fs.writeFileSync(swPath, swContent, 'utf8');
    console.log(`✅ Automated Service Worker Versioning: Updated CACHE_NAME to '${newCacheName}'`);
  } else {
    console.warn('⚠️ Could not find CACHE_NAME variable in sw.js to update.');
  }

  console.log('🎉 Build completed successfully!');
}

build();
