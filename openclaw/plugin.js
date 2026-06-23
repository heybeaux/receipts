const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { createHash, randomBytes } = require('node:crypto');

const { renderMarkdown } = require('../src/render-markdown');
const { assertValidReceipt } = require('../src/schema');

const SCHEMA_VERSION = '0.1.0';
const DEFAULT_CONFIG = {
  enabled: true,
  captureMode: 'tool-runs',
  includeFailed: true,
  dryRun: false,
  skipSessionKeyPrefixes: [],
};

const plugin = {
  id: 'receipts',
  name: 'Receipts',
  description: 'Generates local proof-of-work receipts from OpenClaw agent completion events.',
  register(api) {
    api.on('agent_end', async (event, ctx) => {
      const config = resolveConfig(api.pluginConfig);
      if (!shouldCapture(event, ctx, config)) return;

      const workspaceDir = resolveWorkspaceDir(ctx, config, api);
      const result = writeOpenClawReceipt({ event, ctx, workspaceDir, dryRun: config.dryRun });
      const log = api.logger || console;
      if (config.dryRun) {
        log.info?.(`receipts: dry-run generated ${result.receipt.id}`);
        return;
      }
      log.info?.(`receipts: OpenClaw receipt completed: ${result.receipt.id}`);
    }, { timeoutMs: 30_000 });
  },
};

function resolveConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  return {
    ...DEFAULT_CONFIG,
    ...input,
    skipSessionKeyPrefixes: Array.isArray(input.skipSessionKeyPrefixes)
      ? input.skipSessionKeyPrefixes.filter((value) => typeof value === 'string')
      : DEFAULT_CONFIG.skipSessionKeyPrefixes,
  };
}

function shouldCapture(event, ctx, config = DEFAULT_CONFIG) {
  if (!config.enabled) return false;
  const sessionKey = typeof ctx?.sessionKey === 'string' ? ctx.sessionKey : '';
  if (config.skipSessionKeyPrefixes.some((prefix) => sessionKey.startsWith(prefix))) return false;
  if (event && event.success === false && config.includeFailed) return true;
  if (config.captureMode === 'all') return true;
  if (config.captureMode === 'failures') return event && event.success === false && config.includeFailed;
  return hasToolEvidence(event?.messages);
}

function hasToolEvidence(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some((message) => {
    if (!message || typeof message !== 'object') return false;
    const role = String(message.role || message.type || '').toLowerCase();
    return Boolean(
      message.toolName ||
        message.toolCallId ||
        message.tool_call_id ||
        role.includes('tool') ||
        role.includes('function'),
    );
  });
}

function resolveWorkspaceDir(ctx, config, api) {
  if (typeof config.workspaceDir === 'string' && config.workspaceDir.trim()) return resolve(config.workspaceDir);
  if (typeof ctx?.workspaceDir === 'string' && ctx.workspaceDir.trim()) return resolve(ctx.workspaceDir);
  if (api?.runtime?.agent?.resolveAgentWorkspaceDir && api.config) {
    try {
      const agentId = typeof ctx?.agentId === 'string' ? ctx.agentId : undefined;
      const resolved = api.runtime.agent.resolveAgentWorkspaceDir(api.config, agentId);
      if (resolved) return resolve(resolved);
    } catch (_) {
      // Fall through to process cwd.
    }
  }
  return process.cwd();
}

function writeOpenClawReceipt({ event, ctx, workspaceDir, dryRun = false }) {
  const root = resolve(workspaceDir || process.cwd());
  ensureLayout(root);
  const receipt = createOpenClawReceipt({ event, ctx, root });
  const artifactDir = join(root, '.receipts', 'artifacts', receipt.id);
  ensureDir(artifactDir);
  const eventArtifactPath = join(artifactDir, 'openclaw-agent-end.json');
  writeJson(eventArtifactPath, sanitizeOpenClawPayload({ event, ctx }));
  receipt.evidence.push({
    id: nextEvidenceId(receipt),
    kind: 'log',
    label: 'OpenClaw agent_end event',
    path: normalizePath(root, eventArtifactPath),
    created_at: receipt.created_at,
  });
  updateVerificationSummary(receipt);
  attachIntegrity(receipt, root);
  assertValidReceipt(receipt);

  const receiptPath = join(root, '.receipts', 'receipts', `${receipt.id}.json`);
  const markdownPath = join(root, '.receipts', 'markdown', `${receipt.id}.md`);
  if (!dryRun) {
    writeJson(receiptPath, receipt);
    writeFileSync(markdownPath, renderMarkdown(receipt));
    writeJson(join(root, '.receipts', 'active.json'), {
      id: null,
      completed_id: receipt.id,
      updated_at: receipt.updated_at,
    });
  }
  return { receipt, receiptPath, markdownPath };
}

function createOpenClawReceipt({ event, ctx, root }) {
  const now = new Date().toISOString();
  const messages = Array.isArray(event?.messages) ? event.messages : [];
  const lastAssistant = findLastAssistantText(messages);
  const success = event?.success !== false;
  const runId = stringOrNull(event?.runId) || stringOrNull(ctx?.runId);
  const sessionKey = stringOrNull(ctx?.sessionKey);
  const sessionId = stringOrNull(ctx?.sessionId);
  const agentId = stringOrNull(ctx?.agentId) || 'unknown';
  const model = [stringOrNull(ctx?.modelProviderId), stringOrNull(ctx?.modelId)].filter(Boolean).join('/') || stringOrNull(ctx?.modelId) || null;
  return {
    schema_version: SCHEMA_VERSION,
    id: createReceiptId(),
    created_at: now,
    updated_at: now,
    completed_at: now,
    status: 'needs-review',
    claim: {
      summary: summarizeOpenClawClaim({ event: event || {}, ctx: ctx || {}, lastAssistant }),
      details: lastAssistant || (success ? 'OpenClaw agent turn completed.' : `OpenClaw agent turn failed: ${stringOrNull(event?.error) || 'unknown error'}`),
    },
    actor: { type: 'agent', id: agentId, model },
    task: { source: 'openclaw', id: runId, url: null },
    workspace: {
      source: 'openclaw-agent-end',
      workspace_dir: root,
      session_key: sessionKey,
      session_id: sessionId,
      run_id: runId,
      duration_ms: typeof event?.durationMs === 'number' ? event.durationMs : undefined,
      git_available: false,
      git_error: 'Git evidence is not collected by the safe in-process OpenClaw plugin adapter.',
    },
    changes: [],
    evidence: [],
    verification: {
      summary: 'OpenClaw turn completion recorded; independent verification still requires review.',
      checks: [
        {
          kind: 'openclaw-agent-end',
          label: 'OpenClaw agent turn completed',
          status: success ? 'passed' : 'failed',
          evidence_id: 'ev_001',
          explanation: success ? 'OpenClaw emitted agent_end with success=true.' : stringOrNull(event?.error) || 'OpenClaw emitted agent_end with success=false.',
        },
      ],
    },
    risk: {
      level: success ? 'medium' : 'high',
      notes: [
        'OpenClaw completion proves the agent produced a final turn, not that every task claim is semantically correct.',
        'The safe in-process OpenClaw plugin adapter does not shell out for git evidence; review workspace changes separately when needed.',
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
        message_provider: stringOrNull(ctx?.messageProvider),
        channel_id: stringOrNull(ctx?.channelId),
      },
    },
    recommended_next_action: success
      ? 'Review the receipt and any workspace diffs before treating the task as approved.'
      : 'Inspect the OpenClaw error and rerun or repair the failed task before approval.',
  };
}

function ensureLayout(root) {
  ensureDir(join(root, '.receipts'));
  ensureDir(join(root, '.receipts', 'receipts'));
  ensureDir(join(root, '.receipts', 'markdown'));
  ensureDir(join(root, '.receipts', 'artifacts'));
  const configPath = join(root, '.receipts', 'config.json');
  if (!existsSync(configPath)) {
    writeJson(configPath, {
      schema_version: SCHEMA_VERSION,
      default_status_on_done: 'needs-review',
      created_at: new Date().toISOString(),
    });
  }
}

function sanitizeOpenClawPayload({ event, ctx }) {
  return {
    event: {
      runId: stringOrNull(event?.runId),
      success: event?.success !== false,
      error: stringOrNull(event?.error),
      durationMs: typeof event?.durationMs === 'number' ? event.durationMs : undefined,
      messages: Array.isArray(event?.messages) ? event.messages.map(sanitizeMessage).slice(-20) : [],
    },
    ctx: {
      agentId: stringOrNull(ctx?.agentId),
      sessionId: stringOrNull(ctx?.sessionId),
      sessionKey: stringOrNull(ctx?.sessionKey),
      runId: stringOrNull(ctx?.runId),
      workspaceDir: stringOrNull(ctx?.workspaceDir),
      modelProviderId: stringOrNull(ctx?.modelProviderId),
      modelId: stringOrNull(ctx?.modelId),
      messageProvider: stringOrNull(ctx?.messageProvider),
      channelId: stringOrNull(ctx?.channelId),
    },
  };
}

function sanitizeMessage(message) {
  if (!message || typeof message !== 'object') return { type: typeof message, text: truncate(String(message), 1000) };
  const role = stringOrNull(message.role) || stringOrNull(message.type) || 'unknown';
  const text = extractMessageText(message);
  return {
    role,
    type: stringOrNull(message.type),
    toolName: stringOrNull(message.toolName) || stringOrNull(message.name),
    content: text ? truncate(text, 2000) : undefined,
  };
}

function summarizeOpenClawClaim({ event, ctx, lastAssistant }) {
  if (event.success === false) return `OpenClaw agent turn failed${event.error ? `: ${truncate(String(event.error), 96)}` : ''}`;
  const agentId = stringOrNull(ctx.agentId) || 'agent';
  if (lastAssistant) return `OpenClaw ${agentId} completed: ${truncate(lastAssistant.replace(/\s+/g, ' '), 120)}`;
  return `OpenClaw ${agentId} completed an agent turn`;
}

function findLastAssistantText(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || typeof message !== 'object') continue;
    const role = stringOrNull(message.role) || stringOrNull(message.type);
    if (role && !/assistant|agent|message_end|output/i.test(role)) continue;
    const text = extractMessageText(message);
    if (text) return truncate(text.trim(), 2000);
  }
  return null;
}

function extractMessageText(message) {
  for (const key of ['content', 'text', 'message']) {
    const value = message[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const content = message.content;
  if (Array.isArray(content)) {
    return content
      .map((part) => part && typeof part === 'object' && typeof part.text === 'string' ? part.text : '')
      .filter(Boolean)
      .join('\n')
      .trim() || null;
  }
  return null;
}

function updateVerificationSummary(receipt) {
  const checks = receipt.verification.checks || [];
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

function attachIntegrity(receipt, root) {
  const artifacts = [];
  for (const entry of receipt.evidence || []) {
    for (const key of ['path', 'output', 'stdout', 'stderr']) {
      if (!entry[key]) continue;
      const artifactPath = resolve(root, entry[key]);
      if (!existsSync(artifactPath)) continue;
      const { readFileSync } = require('node:fs');
      artifacts.push({ path: normalizePath(root, artifactPath), sha256: createHash('sha256').update(readFileSync(artifactPath)).digest('hex') });
    }
  }
  const payload = JSON.stringify({ ...receipt, integrity: undefined });
  receipt.integrity = {
    algorithm: 'sha256',
    receipt_payload_sha256: createHash('sha256').update(payload).digest('hex'),
    artifacts,
  };
}

function nextEvidenceId(receipt) {
  return `ev_${String((receipt.evidence || []).length + 1).padStart(3, '0')}`;
}

function createReceiptId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '_').replace('Z', '');
  return `rcpt_${stamp}_${randomBytes(3).toString('hex')}`;
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(join(path, '..'));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizePath(root, path) {
  const relative = require('node:path').relative(root, path);
  return relative.startsWith('..') ? path : relative || '.';
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

module.exports = plugin;
module.exports.default = plugin;
module.exports.__private = {
  DEFAULT_CONFIG,
  hasToolEvidence,
  resolveConfig,
  shouldCapture,
  writeOpenClawReceipt,
};
