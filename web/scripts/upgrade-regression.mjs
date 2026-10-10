import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Run against an already started development or production preview server.
const base = process.argv[2] ?? 'http://127.0.0.1:5270';
const out = path.resolve(process.argv[3] ?? 'test-results/upgrade');
await fs.mkdir(out, { recursive: true });
const cases = ['smoke', 'navigation', 'globe', 'charts', 'map', 'reliability', 'demo', 'exports', 'scientific'];
if (process.env.UPGRADE_OFFLINE === '1') cases.push('offline');
const results = [];
for (const name of cases) {
  const args = [path.join(import.meta.dirname, 'upgrade', `${name}.mjs`), base];
  if (name === 'smoke') args.push(out, 'final');
  else args.push(out);
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', chunk => { log += chunk; });
    child.stderr.on('data', chunk => { log += chunk; });
    child.on('error', error => resolve({ code: 1, log: String(error) }));
    child.on('close', code => resolve({ code, log }));
  });
  await fs.writeFile(path.join(out, `${name}.log`), result.log);
  results.push({ name, exitCode: result.code });
  console.log(`${name}: ${result.code === 0 ? 'PASS' : 'FAIL'} (${path.join(out, `${name}.log`)})`);
}
await fs.writeFile(path.join(out, 'suite.json'), JSON.stringify(results, null, 2));
if (results.some(result => result.exitCode !== 0)) process.exitCode = 1;
