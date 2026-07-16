const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const gradlew = isWin ? 'gradlew.bat' : './gradlew';
const androidDir = path.resolve(__dirname, '..', 'android');
const keystoreFile = path.join(androidDir, 'keystore.properties');

try {
  if (fs.existsSync(keystoreFile)) {
    console.log('Found keystore.properties — building release APK');
    execSync(`${gradlew} assembleRelease`, { cwd: androidDir, stdio: 'inherit' });
  } else {
    console.log('No keystore.properties found — building debug APK');
    execSync(`${gradlew} assembleDebug`, { cwd: androidDir, stdio: 'inherit' });
  }
  console.log('Build finished.');
} catch (e) {
  console.error('Build failed:', e.message);
  process.exit(1);
}
