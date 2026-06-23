const SCHEMA_VERSION = '0.1.0';
const ALLOWED_STATUSES = ['draft', 'self-verified', 'needs-review', 'human-approved', 'rejected', 'superseded'];
const ALLOWED_CHECK_STATUSES = ['passed', 'failed', 'pending', 'not-run'];

function validateReceipt(receipt) {
  const errors = [];
  requireObject(receipt, 'receipt', errors);
  if (errors.length) return errors;

  requireString(receipt.schema_version, 'schema_version', errors);
  if (receipt.schema_version && receipt.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  requireString(receipt.id, 'id', errors);
  requireString(receipt.created_at, 'created_at', errors);
  requireString(receipt.updated_at, 'updated_at', errors);
  requireString(receipt.status, 'status', errors);
  if (receipt.status && !ALLOWED_STATUSES.includes(receipt.status)) errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);

  requireObject(receipt.claim, 'claim', errors);
  if (receipt.claim) requireString(receipt.claim.summary, 'claim.summary', errors);
  requireObject(receipt.actor, 'actor', errors);
  if (receipt.actor) {
    requireString(receipt.actor.type, 'actor.type', errors);
    requireString(receipt.actor.id, 'actor.id', errors);
  }
  requireArray(receipt.changes, 'changes', errors);
  requireArray(receipt.evidence, 'evidence', errors);
  for (const [index, entry] of (receipt.evidence || []).entries()) {
    requireString(entry.id, `evidence[${index}].id`, errors);
    requireString(entry.kind, `evidence[${index}].kind`, errors);
    requireString(entry.label, `evidence[${index}].label`, errors);
  }
  requireObject(receipt.verification, 'verification', errors);
  if (receipt.verification) {
    requireString(receipt.verification.summary, 'verification.summary', errors);
    requireArray(receipt.verification.checks, 'verification.checks', errors);
    for (const [index, check] of (receipt.verification.checks || []).entries()) {
      requireString(check.label, `verification.checks[${index}].label`, errors);
      requireString(check.status, `verification.checks[${index}].status`, errors);
      if (check.status && !ALLOWED_CHECK_STATUSES.includes(check.status)) errors.push(`verification.checks[${index}].status must be one of: ${ALLOWED_CHECK_STATUSES.join(', ')}`);
    }
  }
  requireObject(receipt.risk, 'risk', errors);
  if (receipt.risk) {
    requireString(receipt.risk.level, 'risk.level', errors);
    requireArray(receipt.risk.notes, 'risk.notes', errors);
    requireArray(receipt.risk.assumptions, 'risk.assumptions', errors);
  }
  if (receipt.policy !== undefined) {
    requireObject(receipt.policy, 'policy', errors);
    if (receipt.policy) {
      requireString(receipt.policy.verdict, 'policy.verdict', errors);
      requireArray(receipt.policy.reasons, 'policy.reasons', errors);
    }
  }
  requireString(receipt.recommended_next_action, 'recommended_next_action', errors);
  return errors;
}

function assertValidReceipt(receipt) {
  const errors = validateReceipt(receipt);
  if (errors.length) {
    const error = new Error(`Receipt failed validation:\n- ${errors.join('\n- ')}`);
    error.validationErrors = errors;
    throw error;
  }
}

function requireObject(value, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) errors.push(`${path} must be an object`);
}
function requireArray(value, path, errors) {
  if (!Array.isArray(value)) errors.push(`${path} must be an array`);
}
function requireString(value, path, errors) {
  if (typeof value !== 'string' || value.length === 0) errors.push(`${path} must be a non-empty string`);
}

module.exports = { SCHEMA_VERSION, ALLOWED_STATUSES, ALLOWED_CHECK_STATUSES, validateReceipt, assertValidReceipt };
