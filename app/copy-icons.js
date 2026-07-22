/**
 * Run this once to copy the generated icons into the right place:
 *   node copy-icons.js
 */
const fs = require('fs');
const path = require('path');

const srcIcon = path.join(__dirname, '..', '..', '..', '..', '.gemini', 'antigravity-ide', 'brain', '98be2c39-5ac4-4487-8d1d-7a2cdb9107b6', 'app_icon_1784742622165.png');
const srcAdaptive = path.join(__dirname, '..', '..', '..', '..', '.gemini', 'antigravity-ide', 'brain', '98be2c39-5ac4-4487-8d1d-7a2cdb9107b6', 'adaptive_icon_1784742640351.png');

const destIcon = path.join(__dirname, 'icon.png');
const destAdaptive = path.join(__dirname, 'adaptive-icon.png');

try {
  if (fs.existsSync(srcIcon)) {
    fs.copyFileSync(srcIcon, destIcon);
    console.log('✅ icon.png copied');
  } else {
    console.log('⚠️  Source icon not found at:', srcIcon);
  }

  if (fs.existsSync(srcAdaptive)) {
    fs.copyFileSync(srcAdaptive, destAdaptive);
    console.log('✅ adaptive-icon.png copied');
  } else {
    console.log('⚠️  Source adaptive icon not found at:', srcAdaptive);
  }
} catch (e) {
  console.error('Error copying icons:', e.message);
}
