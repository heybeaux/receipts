const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

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
      const receiptsBin = resolveReceiptsBin(config);
      const payloadPath = writeHookPayload(event, ctx);
      const args = [receiptsBin, 'openclaw', 'agent-end', '--event', payloadPath, '--workspace-dir', workspaceDir];
      if (config.dryRun) args.push('--dry-run');

      const result = spawnSync(process.execPath, args, {
        cwd: workspaceDir,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        env: process.env,
      });

      const log = api.logger || console;
      if (result.status === 0) {
        const line = (result.stdout || '').split('\n').find((entry) => entry.includes('Receipt')) || 'receipt generated';
        log.info?.(`receipts: ${line}`);
        return;
      }

      log.warn?.(
        `receipts: OpenClaw receipt hook failed with exit ${result.status ?? 'unknown'}: ${
          (result.stderr || result.stdout || '').trim() || 'no output'
        }`,
      );
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

function resolveReceiptsBin(config) {
  if (typeof config.receiptsBin === 'string' && config.receiptsBin.trim()) return resolve(config.receiptsBin);
  return resolve(__dirname, '..', 'bin', 'receipts.js');
}

function writeHookPayload(event, ctx) {
  const dir = mkdtempSync(join(tmpdir(), 'receipts-openclaw-'));
  const path = join(dir, 'agent-end.json');
  writeFileSync(path, `${JSON.stringify({ event, ctx }, null, 2)}\n`);
  return path;
}

module.exports = plugin;
module.exports.default = plugin;
module.exports.__private = {
  DEFAULT_CONFIG,
  hasToolEvidence,
  resolveConfig,
  shouldCapture,
};
