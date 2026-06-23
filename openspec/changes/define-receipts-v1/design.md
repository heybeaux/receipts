# Design: Receipts v1

## Overview

Receipts v1 remains local-first and boring by design: Node.js, filesystem artifacts, JSON Schema, Markdown rendering, and adapter-based integrations. The v1 delta adds the missing consumption and trust layer on top of the existing writer.

## Track 1: Trust Core

### Verification command

Add:

```bash
receipts verify [<receipt-id>|latest] [--json]
```

Default behavior:

- Resolve a completed receipt JSON file.
- Recompute the receipt payload SHA-256 using the same canonical payload used by `attachIntegrity`: JSON of the receipt with `integrity` removed.
- Recompute SHA-256 for every artifact listed in `integrity.artifacts`.
- Print a human-readable summary.
- Exit with explicit codes:
  - `0` clean
  - `1` integrity mismatch, missing artifact, malformed receipt, or missing integrity block
  - `64` usage error
  - `65` no matching receipt
  - `66` receipt/artifact file could not be read

JSON mode returns structured results for CI:

```json
{
  "receipt_id": "rcpt_...",
  "status": "clean",
  "payload": { "expected": "...", "actual": "...", "ok": true },
  "artifacts": [
    { "path": ".receipts/artifacts/...", "expected": "...", "actual": "...", "ok": true }
  ]
}
```

### Policy verdicts

Add policy evaluation before completed receipts are written.

Initial policy is intentionally simple and deterministic:

- Failed checks force `needs-review` and high risk.
- Pending or not-run checks force `needs-review`.
- No verification checks force `needs-review` and visible risk.
- `--self-verified` is allowed only when at least one check passed and no checks failed, pending, or not-run.
- Human-approved remains out of reach for automatic CLI completion.

The policy result should be recorded under a new `policy` field:

```json
{
  "policy": {
    "verdict": "needs-review",
    "reasons": ["not-run checks present"],
    "enforced": true
  }
}
```

This keeps status honest while preserving the user's requested intent in logs/docs if needed.

## Track 2: Local UX Core

### List command

Add:

```bash
receipts list [--json] [--limit <n>] [--status <status>]
```

Default output should be compact and terminal-friendly:

```text
rcpt_...  needs-review   2026-06-23  Fixed auth callback bug
rcpt_...  self-verified  2026-06-23  Update docs
```

Sort by completion/updated time descending.

### Show command

Add:

```bash
receipts show [<receipt-id>|latest] [--json|--markdown]
```

Default behavior:

- Prefer Markdown if it exists.
- Fall back to rendering Markdown from JSON.
- `--json` prints the raw JSON receipt.

## Track 3: Docs and Adoption

Create or update documentation for:

- Local CLI quickstart.
- Trust workflow: generate → verify → tamper demo.
- OpenClaw plugin installation and conversation-access opt-in.
- GitHub PR comment usage.
- CI-style usage with `receipts verify` exit codes.
- ClawHub install path once scan/publishing is fully available.

Docs can live in README initially. If README gets too large, split into `docs/` pages and link from README.

## Schema Compatibility

v1 may keep old v0.1 receipts readable. `receipts verify` should report missing integrity as a verification failure rather than crashing.

The schema should be bumped to `1.0.0` when the policy field and verify behavior are implemented and documented.

## Risks

### Canonical hash drift

The verify command must use exactly the same payload canonicalization as completion. Keep hashing logic shared rather than duplicated.

### False confidence

Policy verdicts should be conservative. `self-verified` is earned, not assumed.

### CLI bloat

Keep v1 commands narrow. Hosted dashboards, analytics, org policies, and external issue trackers stay out of v1.
