
const { spawnSync, execFileSync } = require('node:child_process');
const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { basename, dirname, isAbsolute, join, relative, resolve } = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { assertValidReceipt } = require('./schema');
const { renderMarkdown } = require('./render-markdown');
const {
  findLastAssistantText,
  isRecord,
  resolveModelString,
  sanitizeOpenClawPayload,
  stringOrNull,
  summarizeOpenClawClaim,
} = require('./openclaw-receipt');

const SCHEMA_VERSION = '0.1.0';
const RECEIPTS_DIR = '.receipts';
const CONFIG_FILE = 'config.json';
const ACTIVE_FILE = 'active.json';
const RECEIPTS_SUBDIR = 'receipts';
const MARKDOWN_SUBDIR = 'markdown';
const ARTIFACTS_SUBDIR = 'artifacts';

function main(args = process.argv.slice(2)) {
  const command = args.shift();

  try {
    switch (command) {
      case 'init':
        init();
        break;
      case 'claim':
        claim(args);
        break;
      case 'evidence':
        evidence(args);
        break;
      case 'run':
        run(args);
        break;
      case 'done':
        done(args);
        break;
      case 'github':
        github(args);
        break;
      case 'openclaw':
        openclaw(args);
        break;
      case 'help':
      case '--help':
      case '-h':
      case undefined:
        printHelp();
        break;
      case '--version':
      case '-v':
        console.log(readPackageVersion());
        break;
      default:
        fail(`Unknown command: ${command}\n\nRun receipts --help for usage.`, 64);
    }
  } catch (error) {
    if (error && typeof error.exitCode === 'number') {
      console.error(error.message);
      process.exit(error.exitCode);
    }
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  }
}

function printHelp() {
  console.log(`Receipts — verifiable proof-of-work for AI teams.

Usage:
  receipts init
  receipts claim <summary> [--details <text>] [--actor-id <id>] [--actor-type <type>] [--model <model>]
  receipts evidence add [--kind <kind>] [--label <label>] [--file <path>] [--link <url>] [--note <text>] [--cmd <command>] [--exit-code <code>] [--output <path>]
  receipts run -- <command> [args...]
  receipts done [--risk <note>] [--not-run <check>] [--next <action>] [--self-verified]
  receipts github comment --pr <number> [--repo <owner/repo>] [--receipt <id>] [--dry-run]
  receipts openclaw agent-end --event <event.json> [--workspace-dir <path>] [--dry-run]

Examples:
  receipts init
  receipts claim "Fixed auth callback bug" --details "Handled missing state."
  receipts run -- npm test
  receipts evidence add --file screenshots/login.png --kind screenshot --label "Login smoke test"
  receipts done --risk "OAuth provider edge cases not manually tested." --not-run "Browser OAuth smoke test" --next "Review diff and run browser smoke test."
  receipts github comment --pr 123 --repo heybeaux/receipts --dry-run
  receipts openclaw agent-end --event /tmp/openclaw-agent-end.json --workspace-dir .
`);
}

function init() {
  ensureDir(RECEIPTS_DIR);
  ensureDir(pathInReceipts(RECEIPTS_SUBDIR));
  ensureDir(pathInReceipts(MARKDOWN_SUBDIR));
  ensureDir(pathInReceipts(ARTIFACTS_SUBDIR));

  const configPath = pathInReceipts(CONFIG_FILE);
  if (!existsSync(configPath)) {
    writeJson(configPath, {
      schema_version: SCHEMA_VERSION,
      default_status_on_done: 'needs-review',
      created_at: new Date().toISOString(),
    });
  }

  console.log(`Initialized ${RECEIPTS_DIR}/`);
}

function claim(args) {
  ensureInitialized();
  const parsed = parseOptions(args, {
    string: ['details', 'actor-id', 'actor-type', 'model', 'task-source', 'task-id', 'task-url'],
  });

  const summary = parsed.positionals.join(' ').trim();
  if (!summary) fail('Claim summary is required. Example: receipts claim "Fixed auth callback bug"', 64);

  const id = createReceiptId();
  const now = new Date().toISOString();
  const receipt = {
    schema_version: SCHEMA_VERSION,
    id,
    created_at: now,
    updated_at: now,
    status: 'draft',
    claim: {
      summary,
      details: parsed.options.details || null,
    },
    actor: {
      type: parsed.options['actor-type'] || process.env.RECEIPTS_ACTOR_TYPE || 'agent',
      id: parsed.options['actor-id'] || process.env.RECEIPTS_ACTOR_ID || process.env.USER || 'unknown',
      model: parsed.options.model || process.env.RECEIPTS_MODEL || null,
    },
    task: {
      source: parsed.options['task-source'] || 'manual',
      id: parsed.options['task-id'] || null,
      url: parsed.options['task-url'] || null,
    },
    workspace: {},
    changes: [],
    evidence: [],
    verification: {
      summary: 'No verification checks recorded yet.',
      checks: [],
    },
    risk: {
      level: 'unknown',
      notes: [],
      assumptions: [],
      rollback: null,
    },
    integrations: {},
    recommended_next_action: 'Review the receipt and supporting evidence.',
  };

  writeReceiptDraft(receipt);
  writeJson(pathInReceipts(ACTIVE_FILE), { id, path: draftPath(id), updated_at: now });
  console.log(`Started receipt ${id}`);
}

function evidence(args) {
  ensureInitialized();
  const subcommand = args.shift();
  if (subcommand !== 'add') fail('Only `receipts evidence add` is supported right now.', 64);

  const parsed = parseOptions(args, {
    string: ['kind', 'label', 'file', 'link', 'note', 'cmd', 'exit-code', 'output'],
  });

  const receipt = loadActiveReceipt();
  const kind = parsed.options.kind || inferEvidenceKind(parsed.options);
  const label = parsed.options.label || defaultEvidenceLabel(kind, parsed.options);
  const id = nextEvidenceId(receipt);
  const evidenceEntry = {
    id,
    kind,
    label,
    created_at: new Date().toISOString(),
  };

  if (parsed.options.cmd) evidenceEntry.command = parsed.options.cmd;
  if (parsed.options['exit-code'] !== undefined) evidenceEntry.exit_code = parseExitCode(parsed.options['exit-code']);
  if (parsed.options.link) evidenceEntry.url = parsed.options.link;
  if (parsed.options.note) evidenceEntry.note = parsed.options.note;

  if (parsed.options.file) {
    evidenceEntry.path = normalizeUserPath(parsed.options.file);
  }

  if (parsed.options.output) {
    evidenceEntry.output = normalizeUserPath(parsed.options.output);
  }

  if (!evidenceEntry.command && !evidenceEntry.path && !evidenceEntry.url && !evidenceEntry.note && !evidenceEntry.output) {
    fail('Evidence needs at least one of --file, --link, --note, --cmd, or --output.', 64);
  }

  receipt.evidence.push(evidenceEntry);
  if (evidenceEntry.command) {
    receipt.verification.checks.push({
      kind: 'command',
      label,
      status: evidenceEntry.exit_code === 0 ? 'passed' : evidenceEntry.exit_code === undefined ? 'pending' : 'failed',
      evidence_id: id,
      command: evidenceEntry.command,
      exit_code: evidenceEntry.exit_code ?? null,
    });
  }
  updateVerificationSummary(receipt);
  saveActiveReceipt(receipt);
  console.log(`Added ${kind} evidence to ${receipt.id}`);
}

function run(args) {
  ensureInitialized();
  const separatorIndex = args.indexOf('--');
  const commandArgs = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : args;
  if (commandArgs.length === 0) fail('Command is required. Example: receipts run -- npm test', 64);

  const receipt = loadActiveReceipt();
  const evidenceId = nextEvidenceId(receipt);
  const artifactDir = artifactDirFor(receipt.id);
  ensureDir(artifactDir);
  const ordinal = String(receipt.evidence.length + 1).padStart(3, '0');
  const stdoutPath = join(artifactDir, `command-${ordinal}.stdout.log`);
  const stderrPath = join(artifactDir, `command-${ordinal}.stderr.log`);
  const commandString = shellQuote(commandArgs);

  const result = spawnSync(commandArgs[0], commandArgs.slice(1), {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  writeFileSync(stdoutPath, stdout);
  writeFileSync(stderrPath, stderr);

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  const exitCode = typeof result.status === 'number' ? result.status : result.error ? 1 : 0;
  const evidenceEntry = {
    id: evidenceId,
    kind: 'command',
    label: commandString,
    command: commandString,
    exit_code: exitCode,
    stdout: normalizeUserPath(stdoutPath),
    stderr: normalizeUserPath(stderrPath),
    created_at: new Date().toISOString(),
  };

  if (result.error) evidenceEntry.error = result.error.message;

  receipt.evidence.push(evidenceEntry);
  receipt.verification.checks.push({
    kind: 'command',
    label: commandString,
    status: exitCode === 0 ? 'passed' : 'failed',
    evidence_id: evidenceId,
    command: commandString,
    exit_code: exitCode,
  });
  updateVerificationSummary(receipt);
  saveActiveReceipt(receipt);

  process.exit(exitCode);
}

function done(args) {
  ensureInitialized();
  const parsed = parseOptions(args, {
    string: ['risk', 'assumption', 'rollback', 'not-run', 'next'],
    boolean: ['self-verified'],
    repeatable: ['risk', 'assumption', 'not-run'],
  });

  const receipt = loadActiveReceipt();
  const now = new Date().toISOString();
  receipt.updated_at = now;
  receipt.completed_at = now;
  receipt.status = parsed.options['self-verified'] ? 'self-verified' : readDefaultDoneStatus();

  for (const risk of asArray(parsed.options.risk)) receipt.risk.notes.push(risk);
  for (const assumption of asArray(parsed.options.assumption)) receipt.risk.assumptions.push(assumption);
  if (parsed.options.rollback) receipt.risk.rollback = parsed.options.rollback;
  if (receipt.risk.notes.length === 0 && receipt.risk.assumptions.length === 0) {
    receipt.risk.notes.push('No known risks were identified. Review is still recommended.');
  }
  receipt.risk.level = inferRiskLevel(receipt);

  for (const notRun of asArray(parsed.options['not-run'])) {
    receipt.verification.checks.push({
      kind: 'manual',
      label: notRun,
      status: 'not-run',
      explanation: 'Recorded during receipt completion.',
    });
  }
  if (parsed.options.next) receipt.recommended_next_action = parsed.options.next;

  collectWorkspaceEvidence(receipt);
  updateVerificationSummary(receipt);

  attachIntegrity(receipt);
  assertValidReceipt(receipt);

  const receiptPath = pathInReceipts(RECEIPTS_SUBDIR, `${receipt.id}.json`);
  const markdownPath = pathInReceipts(MARKDOWN_SUBDIR, `${receipt.id}.md`);
  writeJson(receiptPath, receipt);
  writeFileSync(markdownPath, renderMarkdown(receipt));
  writeJson(pathInReceipts(ACTIVE_FILE), { id: null, completed_id: receipt.id, updated_at: now });

  console.log(`Receipt completed: ${receipt.id}`);
  console.log(`JSON: ${normalizeUserPath(receiptPath)}`);
  console.log(`Markdown: ${normalizeUserPath(markdownPath)}`);
}

function ensureInitialized() {
  if (!existsSync(RECEIPTS_DIR)) init();
  ensureDir(pathInReceipts(RECEIPTS_SUBDIR));
  ensureDir(pathInReceipts(MARKDOWN_SUBDIR));
  ensureDir(pathInReceipts(ARTIFACTS_SUBDIR));
}

function pathInReceipts(...parts) {
  return join(process.cwd(), RECEIPTS_DIR, ...parts);
}

function draftPath(id) {
  return pathInReceipts(RECEIPTS_SUBDIR, `${id}.draft.json`);
}

function artifactDirFor(id) {
  return pathInReceipts(ARTIFACTS_SUBDIR, id);
}

function writeReceiptDraft(receipt) {
  writeJson(draftPath(receipt.id), receipt);
}

function loadActiveReceipt() {
  const activePath = pathInReceipts(ACTIVE_FILE);
  if (!existsSync(activePath)) fail('No active receipt. Start one with: receipts claim "..."', 65);
  const active = readJson(activePath);
  if (!active.id) fail('No active receipt. Start one with: receipts claim "..."', 65);
  const path = active.path || draftPath(active.id);
  if (!existsSync(path)) fail(`Active receipt file not found: ${path}`, 66);
  return readJson(path);
}

function saveActiveReceipt(receipt) {
  receipt.updated_at = new Date().toISOString();
  writeReceiptDraft(receipt);
  writeJson(pathInReceipts(ACTIVE_FILE), { id: receipt.id, path: draftPath(receipt.id), updated_at: receipt.updated_at });
}

function createReceiptId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '_').replace('Z', '');
  return `rcpt_${stamp}_${randomBytes(3).toString('hex')}`;
}

function nextEvidenceId(receipt) {
  return `ev_${String((receipt.evidence || []).length + 1).padStart(3, '0')}`;
}

function inferEvidenceKind(options) {
  if (options.cmd) return 'command';
  if (options.link) return 'link';
  if (options.note) return 'note';
  if (options.file) return 'file';
  return 'manual';
}

function defaultEvidenceLabel(kind, options) {
  if (options.cmd) return options.cmd;
  if (options.link) return options.link;
  if (options.file) return basename(options.file);
  if (options.note) return 'Manual note';
  return kind;
}

function parseExitCode(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) fail(`Invalid exit code: ${value}`, 64);
  return number;
}

function collectWorkspaceEvidence(receipt) {
  const gitRoot = git(['rev-parse', '--show-toplevel']);
  if (!gitRoot.ok) {
    receipt.workspace = {
      ...receipt.workspace,
      git_available: false,
      git_error: clean(gitRoot.stderr || gitRoot.stdout || 'Not a git repository.'),
    };
    return;
  }

  const branch = git(['branch', '--show-current']);
  const commit = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain=v1']);
  const diff = git(['diff', '--binary']);
  const diffStaged = git(['diff', '--cached', '--binary']);
  const artifactDir = artifactDirFor(receipt.id);
  ensureDir(artifactDir);
  const diffPath = join(artifactDir, 'git.diff');
  const combinedDiff = [diff.stdout || '', diffStaged.stdout ? `\n# Staged diff\n${diffStaged.stdout}` : ''].join('');
  writeFileSync(diffPath, combinedDiff || '');

  receipt.workspace = {
    ...receipt.workspace,
    git_available: true,
    repo: clean(gitRoot.stdout),
    branch: clean(branch.stdout) || null,
    commit_before: receipt.workspace.commit_before || clean(commit.stdout) || null,
    commit_after: clean(commit.stdout) || null,
    git_status: clean(status.stdout) || 'clean',
    git_diff_artifact: normalizeUserPath(diffPath),
  };

  receipt.changes = parseGitStatus(status.stdout || '');

  const hasGitDiffEvidence = receipt.evidence.some((entry) => entry.kind === 'git-diff');
  if (!hasGitDiffEvidence) {
    const id = nextEvidenceId(receipt);
    receipt.evidence.push({
      id,
      kind: 'git-diff',
      label: 'Git diff at receipt completion',
      path: normalizeUserPath(diffPath),
      created_at: new Date().toISOString(),
    });
  }
}

function parseGitStatus(statusText) {
  return statusText
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || line.slice(0, 2);
      const path = line.slice(3).trim();
      return {
        path,
        kind: gitStatusKind(status),
        summary: `${status || 'changed'} ${path}`,
      };
    });
}

function gitStatusKind(status) {
  if (status.includes('A') || status.includes('?')) return 'added';
  if (status.includes('D')) return 'deleted';
  if (status.includes('R')) return 'renamed';
  if (status.includes('M')) return 'modified';
  return 'changed';
}

function git(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

function updateVerificationSummary(receipt) {
  const checks = receipt.verification.checks || [];
  if (checks.length === 0) {
    receipt.verification.summary = 'No verification checks were recorded.';
    return;
  }
  const counts = checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});
  receipt.verification.summary = [
    counts.passed ? `${counts.passed} passed` : null,
    counts.failed ? `${counts.failed} failed` : null,
    counts.pending ? `${counts.pending} pending` : null,
    counts['not-run'] ? `${counts['not-run']} not run` : null,
  ].filter(Boolean).join('; ') || 'Verification recorded.';
}

function inferRiskLevel(receipt) {
  const checks = receipt.verification.checks || [];
  if (checks.some((check) => check.status === 'failed')) return 'high';
  if (checks.some((check) => check.status === 'not-run') || receipt.risk.notes.length > 0) return 'medium';
  return 'low';
}

function readDefaultDoneStatus() {
  const configPath = pathInReceipts(CONFIG_FILE);
  if (!existsSync(configPath)) return 'needs-review';
  const config = readJson(configPath);
  return config.default_status_on_done || 'needs-review';
}



function openclaw(args) {
  const subcommand = args.shift();
  if (subcommand !== 'agent-end') fail('Only `receipts openclaw agent-end` is supported right now.', 64);
  const parsed = parseOptions(args, {
    string: ['event', 'workspace-dir'],
    boolean: ['dry-run'],
  });
  if (!parsed.options.event) fail('OpenClaw agent_end event JSON is required. Example: receipts openclaw agent-end --event event.json', 64);
  if (parsed.options['workspace-dir']) process.chdir(resolve(parsed.options['workspace-dir']));
  ensureInitialized();

  const eventPath = resolve(parsed.options.event);
  const payload = readJson(eventPath);
  const receipt = createOpenClawAgentEndReceipt(payload, eventPath);
  collectWorkspaceEvidence(receipt);
  updateVerificationSummary(receipt);
  attachIntegrity(receipt);
  assertValidReceipt(receipt);

  const receiptPath = pathInReceipts(RECEIPTS_SUBDIR, `${receipt.id}.json`);
  const markdownPath = pathInReceipts(MARKDOWN_SUBDIR, `${receipt.id}.md`);
  if (parsed.options['dry-run']) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }
  writeJson(receiptPath, receipt);
  writeFileSync(markdownPath, renderMarkdown(receipt));
  writeJson(pathInReceipts(ACTIVE_FILE), { id: null, completed_id: receipt.id, updated_at: receipt.updated_at });
  console.log(`OpenClaw receipt completed: ${receipt.id}`);
  console.log(`JSON: ${normalizeUserPath(receiptPath)}`);
  console.log(`Markdown: ${normalizeUserPath(markdownPath)}`);
}

function createOpenClawAgentEndReceipt(payload, sourceEventPath) {
  const event = isRecord(payload.event) ? payload.event : payload;
  const ctx = isRecord(payload.ctx) ? payload.ctx : {};
  const now = new Date().toISOString();
  const id = createReceiptId();
  const messages = Array.isArray(event.messages) ? event.messages : [];
  const lastAssistant = findLastAssistantText(messages);
  const claimSummary = summarizeOpenClawClaim({ event, ctx, messages });
  const artifactDir = artifactDirFor(id);
  ensureDir(artifactDir);
  const artifactPath = join(artifactDir, 'openclaw-agent-end.json');
  const sanitized = sanitizeOpenClawPayload({ event, ctx });
  writeJson(artifactPath, sanitized);

  const success = event.success !== false;
  const runId = stringOrNull(event.runId) || stringOrNull(ctx.runId);
  const sessionKey = stringOrNull(ctx.sessionKey);
  const sessionId = stringOrNull(ctx.sessionId);
  const agentId = stringOrNull(ctx.agentId) || 'unknown';
  const model = resolveModelString({ ctx });

  return {
    schema_version: SCHEMA_VERSION,
    id,
    created_at: now,
    updated_at: now,
    completed_at: now,
    status: success ? 'needs-review' : 'needs-review',
    claim: {
      summary: claimSummary,
      details: lastAssistant || (success ? 'OpenClaw agent turn completed.' : `OpenClaw agent turn failed: ${stringOrNull(event.error) || 'unknown error'}`),
    },
    actor: {
      type: 'agent',
      id: agentId,
      model,
    },
    task: {
      source: 'openclaw',
      id: runId,
      url: null,
    },
    workspace: {
      source: 'openclaw-agent-end',
      workspace_dir: process.cwd(),
      session_key: sessionKey,
      session_id: sessionId,
      run_id: runId,
      duration_ms: typeof event.durationMs === 'number' ? event.durationMs : undefined,
    },
    changes: [],
    evidence: [
      {
        id: 'ev_001',
        kind: 'log',
        label: 'OpenClaw agent_end event',
        path: normalizeUserPath(artifactPath),
        source: normalizeUserPath(sourceEventPath),
        created_at: now,
      },
    ],
    verification: {
      summary: 'OpenClaw turn completion recorded; independent verification still requires review.',
      checks: [
        {
          kind: 'openclaw-agent-end',
          label: 'OpenClaw agent turn completed',
          status: success ? 'passed' : 'failed',
          evidence_id: 'ev_001',
          explanation: success ? 'OpenClaw emitted agent_end with success=true.' : stringOrNull(event.error) || 'OpenClaw emitted agent_end with success=false.',
        },
      ],
    },
    risk: {
      level: success ? 'medium' : 'high',
      notes: [
        'OpenClaw completion proves the agent produced a final turn, not that every task claim is semantically correct.',
      ],
      assumptions: [
        'Agent transcript/event metadata is treated as evidence of observed runtime behavior, not human approval.',
      ],
      rollback: null,
    },
    integrations: {
      openclaw: {
        hook: 'agent_end',
        run_id: runId,
        session_key: sessionKey,
        session_id: sessionId,
        message_provider: stringOrNull(ctx.messageProvider),
        channel_id: stringOrNull(ctx.channelId),
      },
    },
    recommended_next_action: success
      ? 'Review the receipt, especially git diff and verification gaps, before treating the task as approved.'
      : 'Inspect the OpenClaw error and rerun or repair the failed task before approval.',
  };
}

function github(args) {
  ensureInitialized();
  const subcommand = args.shift();
  if (subcommand !== 'comment') fail('Only `receipts github comment` is supported right now.', 64);

  const parsed = parseOptions(args, {
    string: ['pr', 'repo', 'receipt'],
    boolean: ['dry-run'],
  });
  const pr = parsed.options.pr;
  if (!pr) fail('PR number is required. Example: receipts github comment --pr 123', 64);

  const repo = parsed.options.repo || inferGitHubRepo();
  if (!repo) fail('Could not infer GitHub repo from origin. Pass --repo owner/repo.', 65);

  const receiptId = parsed.options.receipt || latestCompletedReceiptId();
  if (!receiptId) fail('No completed receipt found. Pass --receipt <id>.', 65);
  const markdownPath = pathInReceipts(MARKDOWN_SUBDIR, `${receiptId}.md`);
  if (!existsSync(markdownPath)) fail(`Receipt Markdown not found: ${normalizeUserPath(markdownPath)}`, 66);

  if (parsed.options['dry-run']) {
    console.log(`Would comment on ${repo}#${pr} with ${normalizeUserPath(markdownPath)}`);
    console.log(readFileSync(markdownPath, 'utf8'));
    return;
  }

  execFileSync('gh', ['pr', 'comment', String(pr), '--repo', repo, '--body-file', markdownPath], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  console.log(`Posted receipt ${receiptId} to ${repo}#${pr}`);
}

function latestCompletedReceiptId() {
  const receiptsDir = pathInReceipts(RECEIPTS_SUBDIR);
  if (!existsSync(receiptsDir)) return null;
  const { readdirSync, statSync } = require('node:fs');
  const files = readdirSync(receiptsDir)
    .filter((file) => file.endsWith('.json') && !file.endsWith('.draft.json'))
    .map((file) => ({ file, mtime: statSync(join(receiptsDir, file)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] ? files[0].file.replace(/\.json$/, '') : null;
}

function inferGitHubRepo() {
  const remote = git(['config', '--get', 'remote.origin.url']);
  if (!remote.ok) return null;
  const url = clean(remote.stdout);
  const ssh = url.match(/^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/);
  if (ssh) return ssh[1];
  const https = url.match(/^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (https) return https[1];
  return null;
}

function attachIntegrity(receipt) {
  const artifacts = [];
  for (const entry of receipt.evidence || []) {
    for (const key of ['path', 'output', 'stdout', 'stderr']) {
      if (!entry[key]) continue;
      const artifactPath = resolve(process.cwd(), entry[key]);
      if (!existsSync(artifactPath)) continue;
      artifacts.push({ path: normalizeUserPath(artifactPath), sha256: sha256File(artifactPath) });
    }
  }
  const payload = JSON.stringify({ ...receipt, integrity: undefined });
  receipt.integrity = {
    algorithm: 'sha256',
    receipt_payload_sha256: createHash('sha256').update(payload).digest('hex'),
    artifacts,
  };
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function parseOptions(args, spec) {
  const options = {};
  const positionals = [];
  const stringOptions = new Set(spec.string || []);
  const booleanOptions = new Set(spec.boolean || []);
  const repeatableOptions = new Set(spec.repeatable || []);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const eq = arg.indexOf('=');
    const key = arg.slice(2, eq > -1 ? eq : undefined);
    if (booleanOptions.has(key)) {
      options[key] = true;
      continue;
    }
    if (!stringOptions.has(key)) fail(`Unknown option: --${key}`, 64);

    const value = eq > -1 ? arg.slice(eq + 1) : args[++i];
    if (value === undefined) fail(`Missing value for --${key}`, 64);
    if (repeatableOptions.has(key)) {
      if (!Array.isArray(options[key])) options[key] = [];
      options[key].push(value);
    } else {
      options[key] = value;
    }
  }

  return { options, positionals };
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function normalizeUserPath(path) {
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
  return relative(process.cwd(), absolute) || '.';
}

function clean(text) {
  return String(text || '').trim();
}

function shellQuote(args) {
  return args.map((arg) => /^[A-Za-z0-9_./:=@+-]+$/.test(arg) ? arg : `'${String(arg).replace(/'/g, `'\\''`)}'`).join(' ');
}

function readPackageVersion() {
  const packagePath = join(__dirname, '..', 'package.json');
  if (!existsSync(packagePath)) return '0.0.0';
  return readJson(packagePath).version || '0.0.0';
}

function fail(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  throw error;
}

module.exports = { main };

if (require.main === module) {
  main();
}
