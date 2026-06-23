const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const { renderMarkdown } = require('../src/render-markdown');
const { validateReceipt } = require('../src/schema');

const sampleReceipt = {
  schema_version: '0.1.0',
  id: 'rcpt_test_123456',
  created_at: '2026-06-23T00:00:00.000Z',
  updated_at: '2026-06-23T00:00:01.000Z',
  status: 'needs-review',
  claim: { summary: 'Did work', details: 'Detailed claim.' },
  actor: { type: 'agent', id: 'nori', model: 'sakana/fugu' },
  task: { source: 'unit-test', id: null, url: null },
  workspace: { git_available: true, repo: '/tmp/repo', branch: 'main', commit_after: 'abc123' },
  changes: [{ path: 'src/index.js', kind: 'modified', summary: 'M src/index.js' }],
  evidence: [{ id: 'ev_001', kind: 'command', label: 'npm test', command: 'npm test', exit_code: 0 }],
  verification: { summary: '1 passed', checks: [{ kind: 'command', label: 'npm test', status: 'passed', exit_code: 0 }] },
  risk: { level: 'low', notes: [], assumptions: [], rollback: null },
  integrations: {},
  integrity: { algorithm: 'sha256', receipt_payload_sha256: 'abc', artifacts: [{ path: 'artifact.log', sha256: 'def' }] },
  recommended_next_action: 'Review.',
};

assert.deepEqual(validateReceipt(sampleReceipt), []);
assert(validateReceipt({ ...sampleReceipt, status: 'done-ish' }).some((error) => error.includes('status')));

const markdown = renderMarkdown(sampleReceipt);
assert(markdown.includes('# Receipt: Did work'));
assert(markdown.includes('## Integrity'));
assert(markdown.includes('Receipt payload SHA-256'));

const repoRoot = join(__dirname, '..');
const cli = join(repoRoot, 'bin', 'receipts.js');
const workdir = mkdtempSync(join(tmpdir(), 'receipts-unit-github-'));
spawnOk(['init']);
spawnOk(['claim', 'GitHub dry run receipt']);
spawnOk(['done', '--next', 'Post to PR.']);
const dryRun = spawnOk(['github', 'comment', '--pr', '123', '--repo', 'heybeaux/receipts', '--dry-run']);
assert(dryRun.stdout.includes('Would comment on heybeaux/receipts#123'));
assert(dryRun.stdout.includes('# Receipt: GitHub dry run receipt'));

console.log('Unit tests passed');

function spawnOk(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: workdir,
    encoding: 'utf8',
    env: { ...process.env, RECEIPTS_ACTOR_ID: 'unit-test', RECEIPTS_MODEL: 'node-test' },
  });
  if (result.status !== 0) {
    console.error(`Command failed: receipts ${args.join(' ')}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  return result;
}
