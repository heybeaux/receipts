#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

const roots = ['bin', 'src', 'openclaw', 'test', 'scripts'];
const files = [];

for (const root of roots) collect(root);

let failed = false;
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
  }
}

if (failed) process.exit(1);
console.log(`Syntax check passed (${files.length} files).`);

function collect(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch (_) {
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) collect(join(path, entry));
    return;
  }
  if (path.endsWith('.js')) files.push(path);
}
