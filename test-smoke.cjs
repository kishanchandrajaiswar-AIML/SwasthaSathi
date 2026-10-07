const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('SwasthaSathi Web Structure Verification', () => {
  const indexHtml = path.join(__dirname, 'web', 'index.html');
  const stylesCss = path.join(__dirname, 'web', 'styles.css');
  const appJs = path.join(__dirname, 'web', 'app.js');

  assert.ok(fs.existsSync(indexHtml), 'web/index.html must exist');
  assert.ok(fs.existsSync(stylesCss), 'web/styles.css must exist');
  assert.ok(fs.existsSync(appJs), 'web/app.js must exist');

  const htmlContent = fs.readFileSync(indexHtml, 'utf-8');
  assert.ok(htmlContent.includes('SwasthaSathi'), 'index.html must include SwasthaSathi title/brand');
  assert.ok(htmlContent.includes('view-home'), 'index.html must include home view');
  assert.ok(htmlContent.includes('view-triage'), 'index.html must include triage view');
  assert.ok(htmlContent.includes('view-facilities'), 'index.html must include facilities view');
});
