/**
 * Dev server runner for SwasthaSathi.
 * Spawns server.py or serves static files if already running.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Check if port is already active
const req = http.get(`http://localhost:${PORT}/api/status`, (res) => {
  console.log(`✅ SwasthaSathi server is already running on http://localhost:${PORT}/`);
  process.exit(0);
});

req.on('error', () => {
  console.log(`Starting Python server on port ${PORT}...`);
  const pythonCmd = process.platform === 'win32' && require('fs').existsSync('.venv\\Scripts\\python.exe')
    ? '.venv\\Scripts\\python.exe'
    : 'python';

  const child = spawn(pythonCmd, ['server.py', String(PORT)], {
    stdio: 'inherit',
    cwd: __dirname
  });

  child.on('error', (err) => {
    console.error('Failed to start python server:', err);
    process.exit(1);
  });
});
