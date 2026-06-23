const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const { renderMarkdown } = require('../src/render-markdown');
const { validateReceipt } = require('../src/schema');
const receiptsPlugin = require('../openclaw/plugin.js');

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

const openclawWorkdir = mkdtempSync(join(tmpdir(), 'receipts-unit-openclaw-'));
const eventPath = join(openclawWorkdir, 'agent-end.json');
writeFileSync(eventPath, JSON.stringify({
  event: {
    runId: 'run_123',
    success: true,
    durationMs: 42,
    messages: [
      { role: 'user', content: 'Please do the thing.' },
      { role: 'tool', toolName: 'exec', content: 'tests passed' },
      { role: 'assistant', content: 'Implemented the thing and tests pass.' },
    ],
  },
  ctx: {
    agentId: 'nori',
    sessionId: 'sess_123',
    sessionKey: 'agent:nori:main',
    runId: 'run_123',
    workspaceDir: openclawWorkdir,
    modelProviderId: 'sakana',
    modelId: 'fugu',
  },
}, null, 2));
const openclawRun = spawnSync(process.execPath, [cli, 'openclaw', 'agent-end', '--event', eventPath, '--workspace-dir', openclawWorkdir], {
  cwd: openclawWorkdir,
  encoding: 'utf8',
});
if (openclawRun.status !== 0) {
  console.error(openclawRun.stdout);
  console.error(openclawRun.stderr);
  process.exit(1);
}
assert(openclawRun.stdout.includes('OpenClaw receipt completed:'));
const openclawJsonMatch = openclawRun.stdout.match(/JSON: (.+)/);
assert(openclawJsonMatch);
const openclawReceipt = JSON.parse(readFileSync(join(openclawWorkdir, openclawJsonMatch[1].trim()), 'utf8'));
assert.equal(openclawReceipt.task.source, 'openclaw');
assert.equal(openclawReceipt.integrations.openclaw.run_id, 'run_123');
assert(openclawReceipt.evidence.some((entry) => entry.label === 'OpenClaw agent_end event'));
assert(openclawReceipt.integrity.receipt_payload_sha256);

assert.equal(receiptsPlugin.__private.hasToolEvidence([{ role: 'tool', content: 'ok' }]), true);
assert.equal(receiptsPlugin.__private.shouldCapture({ success: true, messages: [{ role: 'assistant', content: 'hi' }] }, {}, receiptsPlugin.__private.DEFAULT_CONFIG), false);
assert.equal(receiptsPlugin.__private.shouldCapture({ success: false, messages: [] }, {}, receiptsPlugin.__private.DEFAULT_CONFIG), true);
const pluginWorkdir = mkdtempSync(join(tmpdir(), 'receipts-unit-plugin-'));
const pluginResult = receiptsPlugin.__private.writeOpenClawReceipt({
  event: {
    runId: 'run_plugin',
    success: true,
    messages: [{ role: 'tool', toolName: 'exec', content: 'ok' }, { role: 'assistant', content: 'Done.' }],
  },
  ctx: { agentId: 'nori', sessionId: 'sess_plugin', sessionKey: 'agent:nori:test' },
  workspaceDir: pluginWorkdir,
});
assert(pluginResult.receipt.id.startsWith('rcpt_'));
assert(pluginResult.receipt.integrations.openclaw.run_id === 'run_plugin');
assert(pluginResult.receipt.workspace.git_error.includes('safe in-process'));
assert(readFileSync(pluginResult.receiptPath, 'utf8').includes('openclaw-agent-end'));

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
