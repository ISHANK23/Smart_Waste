import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};
const run = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupsDir = path.resolve(process.cwd(), '..', 'backups');
  const outputDir = path.join(backupsDir, timestamp);
  ensureDir(outputDir);
  const uri = config.database.uri;
  if (!uri) {
    console.error('MONGO_URI is required to run a backup.');
    process.exit(1);
    return;
  }
  console.log(`Running mongodump to ${outputDir}`);
  const dump = spawn('mongodump', ['--uri', uri, '--out', outputDir], { stdio: 'inherit' });
  dump.on('error', (err) => {
    console.error('Failed to start mongodump. Ensure MongoDB Database Tools are installed and on your PATH.');
    console.error(err.message);
    process.exit(1);
  });
  dump.on('exit', (code) => {
    if (code === 0) {
      console.log(`Backup complete: ${outputDir}`);
    } else {
      console.error(`mongodump exited with code ${code}`);
      process.exit(code || 1);
    }
  });
};
run();