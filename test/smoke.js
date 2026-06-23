const { mkdtempSync, readFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = join(__dirname, '..');
const cli = join(repoRoot, 'bin', 'receipts.js');
const workdir = mkdtempSync(join(tmpdir(), 'receipts-smoke-'));

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: workdir,
    encoding: 'utf8',
    env: {
      ...process.env,
      RECEIPTS_ACTOR_ID: 'smoke-test',
      RECEIPTS_MODEL: 'node-test',
    },
    ...options,
  });

  if (result.status !== (options.expectedStatus ?? 0)) {
    console.error(`Command failed: receipts ${args.join(' ')}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  return result;
}

run(['init']);
run(['claim', 'Smoke test receipt', '--details', 'Verifies the local CLI flow.']);
run(['evidence', 'add', '--note', 'Manual evidence note.', '--label', 'Manual note']);
run(['run', '--', process.execPath, '-e', 'console.log("ok")']);
const done = run(['done', '--risk', 'No external integrations tested.', '--not-run', 'Git diff collection in git repo', '--next', 'Review generated receipt.']);

const jsonMatch = done.stdout.match(/JSON: (.+)/);
const mdMatch = done.stdout.match(/Markdown: (.+)/);
if (!jsonMatch || !mdMatch) {
  console.error('Completion output did not include receipt paths.');
  console.error(done.stdout);
  process.exit(1);
}

const jsonPath = join(workdir, jsonMatch[1].trim());
const mdPath = join(workdir, mdMatch[1].trim());
if (!existsSync(jsonPath) || !existsSync(mdPath)) {
  console.error('Expected receipt output files were not created.');
  process.exit(1);
}
if (existsSync(jsonPath.replace(/\.json$/, '.draft.json'))) {
  console.error('Completed receipt draft was not removed.');
  process.exit(1);
}

const receipt = JSON.parse(readFileSync(jsonPath, 'utf8'));
const markdown = readFileSync(mdPath, 'utf8');

assert(receipt.schema_version === '1.0.0', 'schema version');
assert(receipt.status === 'needs-review', 'done status');
assert(receipt.policy && receipt.policy.verdict === 'needs-review', 'policy verdict');
assert(receipt.claim.summary === 'Smoke test receipt', 'claim summary');
assert(receipt.evidence.some((entry) => entry.kind === 'command' && entry.exit_code === 0), 'command evidence');
assert(receipt.verification.checks.some((check) => check.status === 'not-run'), 'not-run verification');
assert(markdown.includes('## Evidence'), 'markdown evidence section');
assert(markdown.includes('## Policy'), 'markdown policy section');
assert(markdown.includes('## Risks'), 'markdown risks section');
assert(markdown.includes('## Integrity'), 'markdown integrity section');
assert(receipt.integrity && receipt.integrity.receipt_payload_sha256, 'receipt integrity hash');

const list = run(['list']);
assert(list.stdout.includes('Smoke test receipt'), 'list includes receipt');
const show = run(['show', 'latest']);
assert(show.stdout.includes('# Receipt: Smoke test receipt'), 'show latest includes markdown');
const verify = run(['verify', 'latest']);
assert(verify.stdout.includes('Status:  CLEAN'), 'verify latest clean');
const verifyJson = run(['verify', receipt.id, '--json']);
assert(JSON.parse(verifyJson.stdout).ok === true, 'verify json clean');

console.log('CLI smoke test passed');

function assert(condition, label) {
  if (!condition) {
    console.error(`Assertion failed: ${label}`);
    process.exit(1);
  }
}
