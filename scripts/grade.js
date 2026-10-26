import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BACKLOG_FILE = join(ROOT, 'backlog', 'backlog.json');
const REPORT_FILE = join(ROOT, 'grade-report.json');
const SUITE_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function runTests(files) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: SUITE_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.error) {
    return { passed: false, tests: 0, failed: 0, error: result.error.code ?? result.error.message };
  }
  const count = (label) => Number(new RegExp(`^# ${label} (\\d+)`, 'm').exec(result.stdout)?.[1] ?? 0);
  const tests = count('tests');
  return { passed: result.status === 0 && tests > 0, tests, failed: count('fail') };
}

function testsUnmodified() {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'test-lock.js')], { cwd: ROOT, encoding: 'utf8' });
  return { ok: result.status === 0, detail: (result.stderr || result.stdout).trim() };
}

function describe(result) {
  if (result.missing) return 'no acceptance file';
  if (result.error) return `could not run: ${result.error}`;
  return `${result.tests} tests, ${result.failed} failed`;
}

const regressionFiles = readdirSync(join(ROOT, 'test'))
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => join('test', name));
const regression = runTests(regressionFiles);
const integrity = testsUnmodified();

const { tasks } = JSON.parse(readFileSync(BACKLOG_FILE, 'utf8'));
const results = {};
for (const { id } of tasks) {
  const file = join('acceptance', `${id}.test.js`);
  results[id] = existsSync(join(ROOT, file)) ? runTests([file]) : { passed: false, tests: 0, failed: 0, missing: true };
}

const tasksPassed = Object.values(results).filter((result) => result.passed).length;
const report = {
  regression,
  testsUnmodified: integrity.ok,
  tasks: results,
  summary: { tasksPassed, tasksTotal: tasks.length },
};
writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

console.log(`regression suite   ${regression.passed ? 'pass' : 'FAIL'} (${describe(regression)})`);
console.log(`locked files       ${integrity.ok ? 'unchanged' : 'MODIFIED'}`);
if (!integrity.ok) console.log(integrity.detail);
for (const [id, result] of Object.entries(results)) {
  console.log(`${id}                ${result.passed ? 'pass' : 'FAIL'} (${describe(result)})`);
}
console.log(`\n${tasksPassed} of ${tasks.length} tasks pass. Details written to grade-report.json.`);
console.log('The exit code covers only the regression suite and the locked files, not the tasks.');
process.exit(regression.passed && integrity.ok ? 0 : 1);
