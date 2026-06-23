const { existsSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { relative, resolve } = require('node:path');

function canonicalReceiptPayload(receipt) {
  return JSON.stringify({ ...receipt, integrity: undefined });
}

function sha256String(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function normalizePath(root, path) {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  return rel.startsWith('..') ? absolute : rel || '.';
}

function collectArtifactHashes(receipt, root = process.cwd()) {
  const artifacts = [];
  for (const entry of receipt.evidence || []) {
    for (const key of ['path', 'output', 'stdout', 'stderr']) {
      if (!entry[key]) continue;
      const artifactPath = resolve(root, entry[key]);
      if (!existsSync(artifactPath)) continue;
      artifacts.push({ path: normalizePath(root, artifactPath), sha256: sha256File(artifactPath) });
    }
  }
  return artifacts;
}

function attachIntegrity(receipt, root = process.cwd()) {
  receipt.integrity = {
    algorithm: 'sha256',
    receipt_payload_sha256: sha256String(canonicalReceiptPayload(receipt)),
    artifacts: collectArtifactHashes(receipt, root),
  };
  return receipt;
}

function verifyReceiptIntegrity(receipt, root = process.cwd()) {
  const result = {
    receipt_id: receipt && receipt.id || null,
    status: 'clean',
    ok: true,
    payload: null,
    artifacts: [],
    errors: [],
  };

  if (!receipt || typeof receipt !== 'object') {
    result.status = 'invalid';
    result.ok = false;
    result.errors.push('receipt is not an object');
    return result;
  }

  const integrity = receipt.integrity;
  if (!integrity || typeof integrity !== 'object') {
    result.status = 'missing-integrity';
    result.ok = false;
    result.errors.push('receipt has no integrity block');
    return result;
  }
  if (integrity.algorithm && integrity.algorithm !== 'sha256') {
    result.status = 'unsupported-algorithm';
    result.ok = false;
    result.errors.push(`unsupported integrity algorithm: ${integrity.algorithm}`);
  }

  const expectedPayload = integrity.receipt_payload_sha256 || null;
  const actualPayload = sha256String(canonicalReceiptPayload(receipt));
  result.payload = {
    expected: expectedPayload,
    actual: actualPayload,
    ok: Boolean(expectedPayload) && expectedPayload === actualPayload,
  };
  if (!result.payload.ok) {
    result.ok = false;
    result.errors.push('receipt payload hash mismatch');
  }

  for (const artifact of integrity.artifacts || []) {
    const artifactPath = artifact && artifact.path;
    const expected = artifact && artifact.sha256 || null;
    const absolute = artifactPath ? resolve(root, artifactPath) : null;
    const exists = Boolean(absolute && existsSync(absolute));
    let actual = null;
    let ok = false;
    let error = null;
    if (!artifactPath) {
      error = 'artifact path missing';
    } else if (!exists) {
      error = 'artifact missing';
    } else {
      actual = sha256File(absolute);
      ok = Boolean(expected) && expected === actual;
      if (!ok) error = 'artifact hash mismatch';
    }
    const entry = { path: artifactPath || null, expected, actual, ok, exists, error };
    result.artifacts.push(entry);
    if (!ok) {
      result.ok = false;
      result.errors.push(`${artifactPath || '<missing path>'}: ${error}`);
    }
  }

  if (!result.ok && result.status === 'clean') result.status = 'failed';
  return result;
}

module.exports = {
  attachIntegrity,
  canonicalReceiptPayload,
  collectArtifactHashes,
  sha256File,
  sha256String,
  verifyReceiptIntegrity,
};
