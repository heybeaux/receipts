'use strict';

const TRIVIAL_CLAIMS = new Set([
  'done', 'ok', 'okay', 'k', 'yes', 'yep', 'sure', 'finished', 'complete', 'completed', 'np',
  'thanks', 'thank you', 'great', 'cool', 'got it',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function truncate(text, max) {
  const str = String(text);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function messageRole(message) {
  return (stringOrNull(message.role) || stringOrNull(message.type) || '').toLowerCase();
}

function extractMessageText(message) {
  if (!isRecord(message)) return null;
  for (const key of ['content', 'text', 'message']) {
    const value = message[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const content = message.content;
  if (Array.isArray(content)) {
    return content
      .map((part) => isRecord(part) && typeof part.text === 'string' ? part.text : '')
      .filter(Boolean)
      .join('\n')
      .trim() || null;
  }
  return null;
}

function findLastAssistantText(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!isRecord(message)) continue;
    const role = messageRole(message);
    if (role && !/assistant|agent|message_end|output/.test(role)) continue;
    const text = extractMessageText(message);
    if (text) return truncate(text.trim(), 2000);
  }
  return null;
}

function extractUserRequest(messages) {
  const first = (messages || []).find(
    (message) => isRecord(message) && /user|human/.test(messageRole(message)),
  );
  if (!first) return null;
  let text = extractMessageText(first);
  if (!text) return null;
  text = text
    .replace(/\[[A-Za-z]{3}\s+\d{4}-\d{2}-\d{2}[^\]]*\]/g, ' ')
    .replace(/\[Subagent Context\][^\n]*/gi, ' ')
    .replace(/\[Subagent Task\]/gi, ' ')
    .replace(/\[Reply[^\]]*\]/gi, ' ')
    .replace(/Begin\.\s*Execute the assigned task to completion\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

function summarizeTools(messages) {
  const counts = new Map();
  for (const message of messages || []) {
    if (!isRecord(message)) continue;
    const role = messageRole(message);
    const isTool = Boolean(message.toolName || message.name) && /tool|function/.test(role);
    if (!isTool) continue;
    const name = stringOrNull(message.toolName) || stringOrNull(message.name) || 'tool';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const names = [...counts.keys()];
  return { total, names, counts };
}

function isTrivialClaimText(text) {
  if (!text) return true;
  const normalized = text.replace(/[.!]+$/, '').trim().toLowerCase();
  if (TRIVIAL_CLAIMS.has(normalized)) return true;
  return normalized.length < 8 && !normalized.includes(' ');
}

function summarizeOpenClawClaim({ event = {}, ctx = {}, messages = [] }) {
  const agentId = stringOrNull(ctx.agentId) || 'agent';
  if (event.success === false) {
    return `OpenClaw ${agentId} task failed${event.error ? `: ${truncate(String(event.error), 96)}` : ''}`;
  }
  const tools = summarizeTools(messages);
  const toolSuffix = tools.total
    ? ` (${tools.total} tool call${tools.total === 1 ? '' : 's'}: ${tools.names.slice(0, 4).join(', ')}${tools.names.length > 4 ? ', …' : ''})`
    : '';
  const request = extractUserRequest(messages);
  if (request) return `OpenClaw ${agentId}: ${truncate(request, 100)}${toolSuffix}`;
  const lastAssistant = findLastAssistantText(messages);
  if (lastAssistant && !isTrivialClaimText(lastAssistant)) {
    return `OpenClaw ${agentId} completed: ${truncate(lastAssistant.replace(/\s+/g, ' '), 120)}`;
  }
  return `OpenClaw ${agentId} completed an agent turn${toolSuffix}`;
}

function resolveModelString({ ctx = {}, resolvedModel } = {}) {
  const ctxModel = joinModel(stringOrNull(ctx.modelProviderId), stringOrNull(ctx.modelId));
  if (ctxModel) return ctxModel;
  if (resolvedModel && typeof resolvedModel === 'object') {
    const joined = joinModel(stringOrNull(resolvedModel.provider), stringOrNull(resolvedModel.model));
    if (joined) return joined;
    if (stringOrNull(resolvedModel.ref)) return stringOrNull(resolvedModel.ref);
  }
  if (typeof resolvedModel === 'string' && resolvedModel.trim()) return resolvedModel.trim();
  return null;
}

function joinModel(provider, model) {
  if (provider && model) return model.startsWith(`${provider}/`) ? model : `${provider}/${model}`;
  return model || null;
}

function sanitizeMessage(message) {
  if (!isRecord(message)) return { type: typeof message, content: truncate(String(message), 1000) };
  const role = stringOrNull(message.role) || stringOrNull(message.type) || 'unknown';
  const text = extractMessageText(message);
  return {
    role,
    type: stringOrNull(message.type),
    toolName: stringOrNull(message.toolName) || stringOrNull(message.name),
    content: text ? truncate(text, 2000) : undefined,
  };
}

function sanitizeOpenClawPayload({ event = {}, ctx = {} }) {
  return {
    event: {
      runId: stringOrNull(event.runId),
      success: event.success !== false,
      error: stringOrNull(event.error),
      durationMs: typeof event.durationMs === 'number' ? event.durationMs : undefined,
      messages: Array.isArray(event.messages) ? event.messages.map(sanitizeMessage).slice(-20) : [],
    },
    ctx: {
      agentId: stringOrNull(ctx.agentId),
      sessionId: stringOrNull(ctx.sessionId),
      sessionKey: stringOrNull(ctx.sessionKey),
      runId: stringOrNull(ctx.runId),
      workspaceDir: stringOrNull(ctx.workspaceDir),
      modelProviderId: stringOrNull(ctx.modelProviderId),
      modelId: stringOrNull(ctx.modelId),
      messageProvider: stringOrNull(ctx.messageProvider),
      channelId: stringOrNull(ctx.channelId),
    },
  };
}

module.exports = {
  isRecord,
  stringOrNull,
  truncate,
  extractMessageText,
  findLastAssistantText,
  extractUserRequest,
  summarizeTools,
  isTrivialClaimText,
  summarizeOpenClawClaim,
  resolveModelString,
  sanitizeMessage,
  sanitizeOpenClawPayload,
};
