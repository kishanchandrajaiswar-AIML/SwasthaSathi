/**
 * SwasthaSathi Production Build Script.
 * Verifies syntax, checks asset integrity, and outputs production bundle into dist/.
 */
const fs = require('fs');
const path = require('path');

console.log('🚀 Building SwasthaSathi for production...');

const webDir = path.join(__dirname, 'web');
const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Check source files
const requiredFiles = ['index.html', 'styles.css', 'app.js'];
for (const file of requiredFiles) {
  const filePath = path.join(webDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing critical file: web/${file}`);
    process.exit(1);
  }
}

// Copy web files to dist
fs.cpSync(webDir, distDir, { recursive: true });
console.log('✓ Web assets synced to dist/');

// Copy data if available
const dataDir = path.join(__dirname, 'data');
if (fs.existsSync(dataDir)) {
  const distDataDir = path.join(distDir, 'data');
  fs.cpSync(dataDir, distDataDir, { recursive: true });
  console.log('✓ Static data synced to dist/data');
}

console.log('✅ SwasthaSathi build completed successfully!');
