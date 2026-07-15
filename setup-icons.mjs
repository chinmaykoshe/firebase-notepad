/**
 * Android Icon Setup Script
 * 
 * This script copies app-icon.png to the correct Android resource directories.
 * For production, you should use proper resized icons for each density.
 * 
 * Run: node setup-icons.mjs
 * 
 * Android icon sizes:
 *   mdpi    = 48x48   (1x)
 *   hdpi    = 72x72   (1.5x)
 *   xhdpi   = 96x96   (2x)
 *   xxhdpi  = 144x144 (3x)
 *   xxxhdpi = 192x192 (4x)
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ICON_SOURCE = 'app-icon.png';
const ANDROID_RES = join('android', 'app', 'src', 'main', 'res');

const ICON_DIRS = [
  'mipmap-mdpi',
  'mipmap-hdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

const ICON_NAMES = [
  'ic_launcher.png',
  'ic_launcher_round.png',
  'ic_launcher_foreground.png',
];

if (!existsSync(ICON_SOURCE)) {
  console.error(`❌ ${ICON_SOURCE} not found! Place your icon file in the project root.`);
  process.exit(1);
}

if (!existsSync(ANDROID_RES)) {
  console.error(`❌ Android project not found at ${ANDROID_RES}`);
  console.error('   Run "npx cap add android" first.');
  process.exit(1);
}

let copied = 0;
for (const dir of ICON_DIRS) {
  const dirPath = join(ANDROID_RES, dir);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  for (const name of ICON_NAMES) {
    const dest = join(dirPath, name);
    copyFileSync(ICON_SOURCE, dest);
    copied++;
  }
}

console.log(`✅ Copied icon to ${copied} locations in android/app/src/main/res/`);
console.log('');
console.log('💡 For production, resize your icon to proper sizes:');
console.log('   mdpi=48px, hdpi=72px, xhdpi=96px, xxhdpi=144px, xxxhdpi=192px');
console.log('   Or use: npx @capacitor/assets generate --iconBackgroundColor #202124');
