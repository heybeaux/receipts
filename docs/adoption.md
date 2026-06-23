# Receipts Adoption Guide

Receipts v1 is designed to be self-contained: no hosted backend, no OpenClaw requirement, no Ginnung-stack dependency. Start with the local CLI, then opt into adapters when they help.

## 1. Local CLI Adoption

Target user: a developer or agent running in a git checkout.

```bash
npm install -g @beaux-riel/receipts
receipts init
receipts claim "Implement feature X" --details "Short implementation summary."
receipts run -- npm test
receipts done \
  --risk "Manual browser smoke not run." \
  --not-run "Browser smoke test" \
  --next "Review diff and smoke test manually."
receipts list
receipts show latest
receipts verify latest
```

Generated files live under `.receipts/`:

- `receipts/<id>.json` — machine-readable proof-of-work artifact.
- `markdown/<id>.md` — human-readable receipt for PRs, chat, and review.
- `artifacts/<id>/` — captured command output, git diff, and attached evidence.
- `active.json` — mutable pointer to the current/latest receipt.

Default completed status is `needs-review`. `self-verified` is allowed only when policy sees at least one passed verification check and no failed/pending/not-run checks.

## 2. Trust / Verification Adoption

Target user: a reviewer who wants to know whether the receipt and evidence still match what was generated.

```bash
receipts verify latest
receipts verify rcpt_20260623_152306_ad0a0c --json
```

Verification checks:

1. Recompute the receipt payload SHA-256 using the receipt JSON with `integrity` removed.
2. Recompute every artifact SHA-256 listed under `integrity.artifacts`.
3. Report mismatches and missing artifacts explicitly.

Exit codes:

- `0` — clean.
- `1` — payload mismatch, artifact mismatch, missing artifact, missing integrity, or malformed receipt.
- `64` — usage error.
- `65` — no matching receipt.
- `66` — receipt/artifact read failure.

Human output is for local review; `--json` is for CI and automation.

## 3. OpenClaw Adoption

Target user: OpenClaw users who want automatic receipts for agent turns.

### Install

From ClawHub, once the package is available to your OpenClaw gateway:

```bash
openclaw plugins install @beaux-riel/receipts
openclaw plugins enable receipts
```

From a local checkout during development:

```bash
openclaw plugins install /path/to/receipts
openclaw plugins enable receipts
```

### Required conversation-access opt-in

The plugin listens to `agent_end` and needs the task transcript to produce a useful claim and evidence artifact. OpenClaw therefore requires explicit conversation access for this non-bundled plugin:

```json
{
  "plugins": {
    "entries": {
      "receipts": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true }
      }
    }
  }
}
```

### Capture configuration

Configure under `plugins.entries.receipts.config`:

```json
{
  "captureMode": "tool-runs",
  "includeFailed": true,
  "workspaceDir": "/optional/fixed/output/workspace",
  "dryRun": false,
  "skipSessionKeyPrefixes": []
}
```

Modes:

- `tool-runs` — default; capture agent turns that used tools.
- `all` — capture every completed turn.
- `failures` — capture failed turns only.

The adapter is safe-by-default: it writes receipts in-process and does not shell out from the plugin runtime. It records OpenClaw run/session metadata, model attribution when available, and a bounded `openclaw-agent-end.json` evidence artifact.

## 4. GitHub PR Adoption

Target user: a developer or agent posting proof-of-work to a pull request.

Requires authenticated GitHub CLI (`gh auth status`).

```bash
receipts github comment --pr 123
receipts github comment --pr 123 --repo heybeaux/receipts --dry-run
receipts github comment --pr 123 --receipt rcpt_20260623_152306_ad0a0c
```

Behavior:

- Uses the latest completed receipt by default.
- Infers `owner/repo` from `origin` when possible.
- Posts the Markdown receipt body as the PR comment.
- `--dry-run` prints the comment body without posting.

Recommended review pattern:

1. Agent generates receipt with `receipts done`.
2. Agent posts receipt to the PR.
3. Reviewer checks the receipt status, policy verdict, failed/not-run checks, and risks before approving.

## 5. CI Adoption

Target user: CI jobs that want to generate or verify receipts.

### Generate a receipt in CI

```bash
receipts init
receipts claim "CI verification for $GITHUB_SHA" \
  --actor-type ci \
  --actor-id github-actions \
  --task-source github-actions \
  --task-id "$GITHUB_RUN_ID"
receipts run -- npm test
receipts done --self-verified --next "Merge if branch protection is green."
receipts verify latest --json
```

If tests fail, `receipts run -- npm test` exits non-zero, so place cleanup/upload steps in `always()` blocks in GitHub Actions if you need artifacts from failed runs.

### Verify an existing receipt in CI

```bash
receipts verify latest
receipts verify latest --json > receipt-verification.json
```

Non-zero `verify` exits should fail CI. Upload `.receipts/` as a workflow artifact when you want the receipt bundle available after the job.

This repository’s CI is intentionally small and mirrors the local contract:

```bash
npm run lint
npm test
npm run build
```

## 6. Worked Examples

See [`docs/examples/verification-workflow.md`](./examples/verification-workflow.md) for a clean receipt, a not-run policy downgrade, and tamper detection examples.

## 7. Agent Entry Point Adoption

Target user: coding agents dropped into an unfamiliar repository that need a clear Receipts operating procedure.

Point agents at the repository-level [`AGENTS.md`](../AGENTS.md). It explains how to:

- install or invoke the CLI,
- start a receipt from the target project root,
- capture command/file/link/note evidence,
- complete with honest risk and not-run checks,
- verify the receipt before reporting success,
- and post the receipt to a GitHub PR when appropriate.

This file is intentionally short and imperative so agents can follow it without reading the full product docs.
