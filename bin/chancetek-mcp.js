#!/usr/bin/env node
/**
 * ChanceTEK One MCP Server Launcher
 * Cross-platform entry point using node + tsx to launch src/mcp/cli.ts
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliTsPath = path.resolve(__dirname, '../src/mcp/cli.ts');
const localTsxMjs = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');

if (fs.existsSync(localTsxMjs)) {
  const child = spawn(process.execPath, [localTsxMjs, cliTsPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
} else {
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(npxCmd, ['tsx', cliTsPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
