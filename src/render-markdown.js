function renderMarkdown(receipt) {
  const actor = [receipt.actor && receipt.actor.id, receipt.actor && receipt.actor.model].filter(Boolean).join(' / ') || 'unknown';
  const changes = receipt.changes && receipt.changes.length
    ? receipt.changes.map((change) => `- \`${change.path}\` — ${change.kind}${change.summary ? ` (${change.summary})` : ''}`).join('\n')
    : '- No changed files recorded.';
  const evidence = receipt.evidence && receipt.evidence.length
    ? receipt.evidence.map(renderEvidenceLine).join('\n')
    : '- No evidence attached.';
  const checks = receipt.verification.checks && receipt.verification.checks.length
    ? receipt.verification.checks.map(renderCheckLine).join('\n')
    : '- No verification checks recorded.';
  const risks = [
    ...(receipt.risk.notes || []),
    ...(receipt.risk.assumptions || []).map((assumption) => `Assumption: ${assumption}`),
    receipt.risk.rollback ? `Rollback: ${receipt.risk.rollback}` : null,
  ].filter(Boolean);
  const integrity = renderIntegrity(receipt.integrity);

  return `# Receipt: ${receipt.claim.summary}

**Status:** ${receipt.status}  
**Actor:** ${actor}  
**Created:** ${receipt.created_at}  
**Completed:** ${receipt.completed_at || 'Not completed'}  
**Receipt ID:** ${receipt.id}

## Claim

${receipt.claim.details || receipt.claim.summary}

## Changes

${changes}

## Evidence

${evidence}

## Verification

**Summary:** ${receipt.verification.summary}

${checks}

## Risks

**Level:** ${receipt.risk.level}

${risks.length ? risks.map((risk) => `- ${risk}`).join('\n') : '- No known risks were identified.'}

## Recommended Next Action

${receipt.recommended_next_action}

## Integrity

${integrity}

## Workspace

- Git available: ${receipt.workspace.git_available === false ? 'no' : receipt.workspace.git_available ? 'yes' : 'unknown'}
${receipt.workspace.repo ? `- Repo: \`${receipt.workspace.repo}\`\n` : ''}${receipt.workspace.branch ? `- Branch: \`${receipt.workspace.branch}\`\n` : ''}${receipt.workspace.commit_after ? `- Commit: \`${receipt.workspace.commit_after}\`\n` : ''}${receipt.workspace.git_diff_artifact ? `- Diff artifact: \`${receipt.workspace.git_diff_artifact}\`\n` : ''}`;
}

function renderEvidenceLine(entry) {
  const parts = [`- ${entry.label || entry.kind} — ${entry.kind}`];
  if (entry.command) parts.push(`command: \`${entry.command}\``);
  if (entry.exit_code !== undefined) parts.push(`exit code: ${entry.exit_code}`);
  if (entry.path) parts.push(`path: \`${entry.path}\``);
  if (entry.output) parts.push(`output: \`${entry.output}\``);
  if (entry.stdout) parts.push(`stdout: \`${entry.stdout}\``);
  if (entry.stderr) parts.push(`stderr: \`${entry.stderr}\``);
  if (entry.url) parts.push(`url: ${entry.url}`);
  if (entry.note) parts.push(entry.note);
  return parts.join('; ');
}

function renderCheckLine(check) {
  const icon = check.status === 'passed' ? '✅' : check.status === 'failed' ? '❌' : check.status === 'not-run' ? '⚪' : '🟡';
  const details = [];
  if (check.command) details.push(`\`${check.command}\``);
  if (check.exit_code !== undefined && check.exit_code !== null) details.push(`exit code ${check.exit_code}`);
  if (check.explanation) details.push(check.explanation);
  return `- ${icon} **${check.status}** — ${check.label}${details.length ? ` (${details.join('; ')})` : ''}`;
}

function renderIntegrity(integrity) {
  if (!integrity) return '- Not recorded.';
  const lines = [];
  if (integrity.receipt_payload_sha256) lines.push(`- Receipt payload SHA-256: \`${integrity.receipt_payload_sha256}\``);
  if (integrity.artifacts && integrity.artifacts.length) {
    lines.push('- Artifact hashes:');
    for (const artifact of integrity.artifacts) lines.push(`  - \`${artifact.path}\` — \`${artifact.sha256}\``);
  }
  return lines.length ? lines.join('\n') : '- Not recorded.';
}

module.exports = { renderMarkdown, renderEvidenceLine, renderCheckLine, renderIntegrity };
