'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, relative, resolve } = require('node:path');
const { createHash, randomBytes } = require('node:crypto');

const { renderMarkdown } = require('../src/render-markdown');
const { assertValidReceipt } = require('../src/schema');
const {
  resolveModelString,
  sanitizeOpenClawPayload,
  stringOrNull,
  summarizeOpenClawClaim,
} = require('../src/openclaw-receipt');

const SCHEMA_VERSION = '0.1.0';
const DEFAULT_CONFIG = {
  enabled: true,
  captureMode: 'tool-runs',
  includeFailed: true,
  dryRun: false,
  skipSessionKeyPrefixes: [],
};

// Bounded per-run model registry populated from model-call telemetry hooks,
// which (unlike agent_end) reliably carry provider/model metadata.
const MODEL_REGISTRY_LIMIT = 256;

function createModelRegistry(limit = MODEL_REGISTRY_LIMIT) {
  const map = new Map();
  return {
    record(runId, provider, model) {
      const key = stringOrNull(runId);
      const modelId = stringOrNull(model);
      if (!key || !modelId) return;
      map.set(key, { provider: stringOrNull(provider), model: modelId });
      while (map.size > limit) map.delete(map.keys().next().value);
    },
    take(runId) {
      const key = stringOrNull(runId);
      if (!key || !map.has(key)) return undefined;
      const value = map.get(key);
      map.delete(key);
      return value;
    },
    get size() {
      return map.size;
    },
  };
}

const plugin = {
  id: 'receipts',
  name: 'Receipts',
  description: 'Generates local proof-of-work receipts from OpenClaw agent completion events.',
  register(api) {
    const modelRegistry = createModelRegistry();

    const recordModel = (event) => {
      if (!event || typeof event !== 'object') return;
      modelRegistry.record(event.runId, event.provider, event.model);
    };
    api.on('model_call_started', (event) => recordModel(event));
    api.on('model_call_ended', (event) => recordModel(event));

    api.on('agent_end', async (event, ctx) => {
      const config = resolveConfig(api.pluginConfig);
      const runId = stringOrNull(event?.runId) || stringOrNull(ctx?.runId);
      const resolvedModel = modelRegistry.take(runId);
      if (!shouldCapture(event, ctx, config)) return;

      const workspaceDir = resolveWorkspaceDir(ctx, config, api);
      const result = writeOpenClawReceipt({ event, ctx, workspaceDir, dryRun: config.dryRun, resolvedModel });
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

function writeOpenClawReceipt({ event, ctx, workspaceDir, dryRun = false, resolvedModel }) {
  const root = resolve(workspaceDir || process.cwd());
  ensureLayout(root);
  const receipt = createOpenClawReceipt({ event, ctx, root, resolvedModel });
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

function createOpenClawReceipt({ event, ctx, root, resolvedModel }) {
  const now = new Date().toISOString();
  const messages = Array.isArray(event?.messages) ? event.messages : [];
  const success = event?.success !== false;
  const runId = stringOrNull(event?.runId) || stringOrNull(ctx?.runId);
  const sessionKey = stringOrNull(ctx?.sessionKey);
  const sessionId = stringOrNull(ctx?.sessionId);
  const agentId = stringOrNull(ctx?.agentId) || 'unknown';
  const model = resolveModelString({ ctx: ctx || {}, resolvedModel });
  const claimDetails = describeClaimDetails({ event: event || {}, messages, success });
  return {
    schema_version: SCHEMA_VERSION,
    id: createReceiptId(),
    created_at: now,
    updated_at: now,
    completed_at: now,
    status: 'needs-review',
    claim: {
      summary: summarizeOpenClawClaim({ event: event || {}, ctx: ctx || {}, messages }),
      details: claimDetails,
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
        model_source: resolveModelString({ ctx: ctx || {} }) ? 'agent_end_ctx' : (resolvedModel ? 'model_call_hook' : 'unknown'),
      },
    },
    recommended_next_action: success
      ? 'Review the receipt and any workspace diffs before treating the task as approved.'
      : 'Inspect the OpenClaw error and rerun or repair the failed task before approval.',
  };
}

function describeClaimDetails({ event, messages, success }) {
  const { findLastAssistantText } = require('../src/openclaw-receipt');
  const lastAssistant = findLastAssistantText(messages);
  if (lastAssistant) return lastAssistant;
  if (success) return 'OpenClaw agent turn completed.';
  return `OpenClaw agent turn failed: ${stringOrNull(event?.error) || 'unknown error'}`;
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
  const rel = relative(root, path);
  return rel.startsWith('..') ? path : rel || '.';
}

module.exports = plugin;
module.exports.default = plugin;
module.exports.__private = {
  DEFAULT_CONFIG,
  createModelRegistry,
  hasToolEvidence,
  resolveConfig,
  shouldCapture,
  writeOpenClawReceipt,
};
