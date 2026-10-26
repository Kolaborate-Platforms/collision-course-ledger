import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOCKED_DIRS = ['test', 'acceptance'];
const LOCKED_FILES = ['backlog/backlog.json', 'scripts/grade.js', 'scripts/run-suite.js', 'scripts/test-lock.js'];
const LOCK_FILE = join(ROOT, 'tests.lock.json');
const NOISE_FILES = new Set(['Thumbs.db', 'desktop.ini']);

function listFiles(dir) {
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && !NOISE_FILES.has(name))
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

// Line endings are normalised so a Windows checkout hashes the same as a Unix one.
function hashOf(path) {
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(text).digest('hex');
}

function currentHashes() {
  const paths = [...LOCKED_DIRS.flatMap((dir) => listFiles(join(ROOT, dir))), ...LOCKED_FILES.map((file) => join(ROOT, file))];
  const entries = paths.map((path) => [relative(ROOT, path).split(sep).join('/'), hashOf(path)]);
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

if (process.argv.includes('--write')) {
  writeFileSync(LOCK_FILE, `${JSON.stringify(currentHashes(), null, 2)}\n`);
  console.log('wrote tests.lock.json (maintainers only)');
  process.exit(0);
}

const locked = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
const current = currentHashes();
const problems = [];
for (const path of Object.keys(locked)) {
  if (!(path in current)) problems.push(`missing  ${path}`);
  else if (current[path] !== locked[path]) problems.push(`changed  ${path}`);
}
for (const path of Object.keys(current)) {
  if (!(path in locked)) problems.push(`added    ${path}`);
}

if (problems.length > 0) {
  console.error('Locked files differ from the released versions:');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('Restore them from the repository. Regenerating tests.lock.json does not help: the organizers compare against their own copies.');
  process.exit(1);
}
console.log(`ok: ${Object.keys(locked).length} locked files match the released versions`);
