function evaluateReceiptPolicy(receipt, options = {}) {
  const checks = receipt && receipt.verification && Array.isArray(receipt.verification.checks)
    ? receipt.verification.checks
    : [];
  const requestedSelfVerified = Boolean(options.selfVerified || options.requestedStatus === 'self-verified');
  const reasons = [];

  const failed = checks.filter((check) => check.status === 'failed').length;
  const pending = checks.filter((check) => check.status === 'pending').length;
  const notRun = checks.filter((check) => check.status === 'not-run').length;
  const passed = checks.filter((check) => check.status === 'passed').length;

  if (checks.length === 0) reasons.push('no verification checks recorded');
  if (failed) reasons.push(`${failed} failed check${failed === 1 ? '' : 's'}`);
  if (pending) reasons.push(`${pending} pending check${pending === 1 ? '' : 's'}`);
  if (notRun) reasons.push(`${notRun} not-run check${notRun === 1 ? '' : 's'}`);

  const canSelfVerify = passed > 0 && failed === 0 && pending === 0 && notRun === 0;
  let verdict = 'needs-review';
  if (requestedSelfVerified && canSelfVerify) verdict = 'self-verified';
  if (!requestedSelfVerified && options.requestedStatus && options.requestedStatus !== 'human-approved') {
    verdict = options.requestedStatus;
  }
  if (options.requestedStatus === 'human-approved') {
    reasons.push('human-approved cannot be set automatically by receipts done');
    verdict = 'needs-review';
  }
  if (requestedSelfVerified && !canSelfVerify) verdict = 'needs-review';
  if (reasons.length === 0) reasons.push(canSelfVerify ? 'all verification checks passed' : 'review required by default');

  return {
    verdict,
    requested: requestedSelfVerified ? 'self-verified' : (options.requestedStatus || 'needs-review'),
    self_verified_allowed: canSelfVerify,
    enforced: true,
    reasons,
  };
}

function applyReceiptPolicy(receipt, options = {}) {
  const policy = evaluateReceiptPolicy(receipt, options);
  receipt.policy = policy;
  receipt.status = policy.verdict;
  return policy;
}

module.exports = { applyReceiptPolicy, evaluateReceiptPolicy };
