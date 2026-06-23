const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const { renderMarkdown } = require('../src/render-markdown');
const { validateReceipt } = require('../src/schema');
const {
  extractUserRequest,
  isTrivialClaimText,
  resolveModelString,
  summarizeOpenClawClaim,
  summarizeTools,
} = require('../src/openclaw-receipt');
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
const listRun = spawnOk(['list']);
assert(listRun.stdout.includes('GitHub dry run receipt'));
const showRun = spawnOk(['show', 'latest']);
assert(showRun.stdout.includes('# Receipt: GitHub dry run receipt'));
const verifyRun = spawnOk(['verify', 'latest']);
assert(verifyRun.stdout.includes('Status:  CLEAN'));

const verifyWorkdir = mkdtempSync(join(tmpdir(), 'receipts-unit-verify-'));
spawnOkIn(verifyWorkdir, ['init']);
spawnOkIn(verifyWorkdir, ['claim', 'Verification receipt']);
spawnOkIn(verifyWorkdir, ['run', '--', process.execPath, '-e', 'console.log("verify-ok")']);
const verifyDone = spawnOkIn(verifyWorkdir, ['done', '--self-verified']);
const verifyJsonPath = join(verifyWorkdir, verifyDone.stdout.match(/JSON: (.+)/)[1].trim());
let verifyReceipt = JSON.parse(readFileSync(verifyJsonPath, 'utf8'));
assert.equal(verifyReceipt.status, 'self-verified');
assert.equal(verifyReceipt.policy.verdict, 'self-verified');
const verifyJson = spawnOkIn(verifyWorkdir, ['verify', verifyReceipt.id, '--json']);
assert.equal(JSON.parse(verifyJson.stdout).ok, true);
verifyReceipt.claim.summary = 'Tampered summary';
writeFileSync(verifyJsonPath, `${JSON.stringify(verifyReceipt, null, 2)}\n`);
const tamperedPayload = spawnIn(verifyWorkdir, ['verify', verifyReceipt.id], 1);
assert(tamperedPayload.stdout.includes('payload hash mismatch'));

const artifactWorkdir = mkdtempSync(join(tmpdir(), 'receipts-unit-artifact-'));
spawnOkIn(artifactWorkdir, ['init']);
spawnOkIn(artifactWorkdir, ['claim', 'Artifact verification receipt']);
spawnOkIn(artifactWorkdir, ['run', '--', process.execPath, '-e', 'console.log("artifact-ok")']);
const artifactDone = spawnOkIn(artifactWorkdir, ['done']);
const artifactJsonPath = join(artifactWorkdir, artifactDone.stdout.match(/JSON: (.+)/)[1].trim());
const artifactReceipt = JSON.parse(readFileSync(artifactJsonPath, 'utf8'));
const firstArtifact = artifactReceipt.integrity.artifacts[0];
writeFileSync(join(artifactWorkdir, firstArtifact.path), 'tampered artifact\n');
const tamperedArtifact = spawnIn(artifactWorkdir, ['verify', artifactReceipt.id], 1);
assert(tamperedArtifact.stdout.includes('artifact hash mismatch'));
unlinkSync(join(artifactWorkdir, firstArtifact.path));
const missingArtifact = spawnIn(artifactWorkdir, ['verify', artifactReceipt.id], 1);
assert(missingArtifact.stdout.includes('artifact missing'));

const policyWorkdir = mkdtempSync(join(tmpdir(), 'receipts-unit-policy-'));
spawnOkIn(policyWorkdir, ['init']);
spawnOkIn(policyWorkdir, ['claim', 'Weak self verification']);
const weakDone = spawnOkIn(policyWorkdir, ['done', '--self-verified']);
const weakReceipt = JSON.parse(readFileSync(join(policyWorkdir, weakDone.stdout.match(/JSON: (.+)/)[1].trim()), 'utf8'));
assert.equal(weakReceipt.status, 'needs-review');
assert.equal(weakReceipt.policy.self_verified_allowed, false);
assert(weakReceipt.policy.reasons.some((reason) => reason.includes('no verification checks')));

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

// #1 Claim extraction: subagent preamble is stripped and tool summary is included.
const subagentMessages = [
  { role: 'user', content: '[Tue 2026-06-23 05:57 PDT] [Subagent Context] You are running as a subagent (depth 1/1).\n\n[Subagent Task]\n\nRun the migration and verify tests.\n\nBegin. Execute the assigned task to completion.' },
  { role: 'assistant' },
  { role: 'toolResult', toolName: 'exec', content: 'ok' },
  { role: 'assistant', content: 'done' },
];
assert.equal(extractUserRequest(subagentMessages), 'Run the migration and verify tests.');
assert.equal(summarizeTools(subagentMessages).total, 1);
const subagentClaim = summarizeOpenClawClaim({ event: { success: true }, ctx: { agentId: 'nori' }, messages: subagentMessages });
assert(subagentClaim.includes('Run the migration and verify tests.'), subagentClaim);
assert(subagentClaim.includes('1 tool call: exec'), subagentClaim);
assert(!/completed: done/.test(subagentClaim), subagentClaim);

// Trivial last-line fallback never produces a 'done' claim when there is no request.
assert.equal(isTrivialClaimText('done'), true);
assert.equal(isTrivialClaimText('Implemented the feature'), false);
const trivialClaim = summarizeOpenClawClaim({ event: { success: true }, ctx: { agentId: 'nori' }, messages: [{ role: 'assistant', content: 'done' }] });
assert(!/completed: done/.test(trivialClaim), trivialClaim);
assert(trivialClaim.includes('completed an agent turn'), trivialClaim);

// Failure claim path.
const failClaim = summarizeOpenClawClaim({ event: { success: false, error: 'boom' }, ctx: { agentId: 'nori' }, messages: [] });
assert(failClaim.includes('task failed'), failClaim);

// #2 Model metadata: ctx wins; otherwise resolved model-call hook value is used.
assert.equal(resolveModelString({ ctx: { modelProviderId: 'sakana', modelId: 'fugu' } }), 'sakana/fugu');
assert.equal(resolveModelString({ ctx: {}, resolvedModel: { provider: 'sakana', model: 'fugu-ultra' } }), 'sakana/fugu-ultra');
assert.equal(resolveModelString({ ctx: {} }), null);

const registry = receiptsPlugin.__private.createModelRegistry();
registry.record('run_model', 'sakana', 'fugu');
const modelWorkdir = mkdtempSync(join(tmpdir(), 'receipts-unit-model-'));
const modelResult = receiptsPlugin.__private.writeOpenClawReceipt({
  event: { runId: 'run_model', success: true, messages: [{ role: 'tool', toolName: 'exec', content: 'ok' }, { role: 'assistant', content: 'Built it.' }] },
  ctx: { agentId: 'nori', sessionKey: 'agent:nori:x', runId: 'run_model' },
  workspaceDir: modelWorkdir,
  resolvedModel: registry.take('run_model'),
});
assert.equal(modelResult.receipt.actor.model, 'sakana/fugu');
assert.equal(modelResult.receipt.integrations.openclaw.model_source, 'model_call_hook');

console.log('Unit tests passed');

function spawnOk(args) {
  return spawnOkIn(workdir, args);
}

function spawnOkIn(cwd, args) {
  return spawnIn(cwd, args, 0);
}

function spawnIn(cwd, args, expectedStatus) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, RECEIPTS_ACTOR_ID: 'unit-test', RECEIPTS_MODEL: 'node-test' },
  });
  if (result.status !== expectedStatus) {
    console.error(`Command failed: receipts ${args.join(' ')}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  return result;
}
