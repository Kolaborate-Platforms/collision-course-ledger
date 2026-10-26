import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/run-suite.js <directory>');
  process.exit(2);
}

const files = readdirSync(join(ROOT, dir))
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => join(dir, name));

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', cwd: ROOT });
process.exit(result.status ?? 1);
