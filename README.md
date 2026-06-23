# Receipts

> **Receipts or it didn’t happen.** Verifiable proof-of-work for AI teams.

Receipts is a local-first, standalone proof-of-work layer for AI-native teams. It turns vague agent status updates like *“done”*, *“fixed”*, or *“reviewed”* into **structured, verifiable completion artifacts** — capturing the claim, the evidence, what was actually verified, the risks, and the recommended next action.

The core wedge is simple:

> **Every meaningful AI task should end with a receipt.**

Receipts stands on its own as a thin CLI + schema, and gets stronger when wired into your stack (GitHub, OpenClaw, and beyond) through optional adapters.

---

## Why Receipts?

As agents become teammates, the bottleneck shifts from *generation* to *trust*. When an agent says “done,” a human still has to reconstruct what happened from diffs, logs, test output, screenshots, CI, and chat.

Receipts packages that proof into one portable artifact that answers six questions fast:

1. **Claim** — what is being asserted?
2. **Changes** — what was produced or modified?
3. **Evidence** — what proof supports the claim?
4. **Verification** — what checks passed, failed, or were not run?
5. **Risk** — what is uncertain, untested, or assumed?
6. **Next action** — what should a human do next?

It is designed to be **brutally honest**: a good receipt does not pretend everything passed. It makes unverified areas explicit and distinguishes *claims* from *verified facts*.

---

## What a receipt looks like

Every completed task produces both machine-readable JSON and human-readable Markdown.

```markdown
# Receipt: Fixed auth callback bug

**Status:** needs-review
**Actor:** nori / sakana/fugu
**Receipt ID:** rcpt_20260623_131512_c0237a

## Claim
Handled the missing OAuth `state` parameter and added a regression test.

## Changes
- `src/auth/callback.ts` — modified
- `tests/auth-callback.test.ts` — added

## Evidence
- `npm test` — exit code 0 (stdout/stderr captured)
- Git diff captured

## Verification
**Summary:** 1 passed; 1 not run
- ✅ passed — npm test
- ⚪ not-run — Browser OAuth smoke test

## Risks
**Level:** medium
- Provider-specific OAuth edge cases not manually tested.

## Recommended Next Action
Review the diff and run a browser login smoke test before merge.

## Integrity
- Receipt payload SHA-256: `…`
- Artifact hashes: `…`
```

---

## Features

- **Local-first, zero runtime dependencies.** Pure Node.js; no hosted service required.
- **Portable schema.** A published JSON Schema (`schemas/receipt.schema.json`) is the product primitive.
- **JSON + Markdown output.** Machine-readable for tooling, human-readable for PRs/Slack/Linear.
- **Automatic evidence capture.** `receipts run -- <cmd>` records stdout/stderr/exit code; `receipts done` collects git branch, commits, status, and a diff artifact.
- **Honest verification.** Separate passed / failed / pending / not-run states, surfaced prominently.
- **Tamper-evident integrity.** SHA-256 hash of the receipt payload plus per-artifact hashes.
- **GitHub adapter.** Post a receipt straight onto a PR.
- **OpenClaw adapter.** Auto-generate a receipt whenever an OpenClaw agent finishes a task.

---

## Install

From a local checkout (development / private use):

```bash
git clone https://github.com/heybeaux/receipts.git
cd receipts
npm install
```

This exposes the `receipts` executable via `bin/receipts.js` (also runnable as `npm run cli -- <args>`).

---

## Quickstart

```bash
receipts init                                   # create local .receipts/ storage
receipts claim "Fixed auth callback bug" \
  --details "Handled missing state parameter."
receipts run -- npm test                        # wrap a command, capture output + exit code
receipts evidence add --file screenshots/login.png --kind screenshot --label "Login smoke test"
receipts done \
  --risk "OAuth provider edge cases not manually tested." \
  --not-run "Browser OAuth smoke test" \
  --next "Review diff and run browser smoke test."
receipts list                                   # browse completed receipts
receipts show latest                            # inspect the newest receipt
receipts verify latest                          # recompute payload + artifact hashes
```

Generated artifacts live under `.receipts/`:

```text
.receipts/
├── config.json
├── active.json
├── receipts/   <receipt-id>.json        # machine-readable receipts
├── markdown/   <receipt-id>.md          # human-readable receipts
└── artifacts/  <receipt-id>/            # captured command output, git diff, evidence
```

---

## CLI reference

| Command | Description |
| --- | --- |
| `receipts init` | Create `.receipts/` storage and config. |
| `receipts claim "<summary>"` | Start a draft receipt and mark it active. Flags: `--details`, `--actor-id`, `--actor-type`, `--model`, `--task-source`, `--task-id`, `--task-url`. |
| `receipts evidence add` | Attach evidence to the active receipt: `--file`, `--link`, `--note`, `--cmd`, `--exit-code`, `--output`, `--kind`, `--label`. |
| `receipts run -- <cmd>` | Run a command, capture stdout/stderr/exit code as evidence, and return the command's exit code. |
| `receipts done` | Collect git/workspace metadata, apply policy verdicts, render JSON + Markdown, hash for integrity. Flags: `--risk`, `--assumption`, `--rollback`, `--not-run`, `--next`, `--self-verified`. |
| `receipts list` | List completed receipts newest-first. Flags: `--json`, `--limit <n>`, `--status <status>`. |
| `receipts show [id|latest]` | Show one receipt. Defaults to Markdown; flags: `--json`, `--markdown`. |
| `receipts verify [id|latest]` | Recompute receipt payload and artifact hashes. Flag: `--json`; exits 0 clean, 1 failed verification. |
| `receipts github comment --pr <n>` | Post the latest (or `--receipt <id>`) receipt Markdown to a GitHub PR. `--repo`, `--dry-run`. |
| `receipts openclaw agent-end --event <file>` | Convert an exported OpenClaw `agent_end` payload into a receipt (used by tests / custom integrations). |

### Browse, inspect, and verify receipts

```bash
receipts list
receipts list --status needs-review --limit 5
receipts list --json

receipts show latest
receipts show rcpt_20260623_131512_c0237a --json

receipts verify latest
receipts verify rcpt_20260623_131512_c0237a --json
```

`receipts verify` checks two things:

1. The receipt payload hash still matches the JSON content with the `integrity` block removed.
2. Every artifact listed in `integrity.artifacts` still exists and matches its recorded SHA-256.

Exit codes are intentionally CI-friendly:

- `0` — clean
- `1` — payload mismatch, artifact mismatch, missing artifact, missing integrity, or malformed receipt
- `64` — usage error
- `65` — no matching receipt
- `66` — receipt/artifact read failure

### Policy verdicts

Receipts is conservative about `self-verified`. Passing `--self-verified` is a request, not a blank cheque. The CLI records a `policy` block and downgrades the final status to `needs-review` when:

- no verification checks exist,
- any check failed,
- any check is pending, or
- any check is marked `not-run`.

A receipt can become `self-verified` only when at least one verification check passed and none failed/pending/not-run. `human-approved` is never assigned automatically.

### Post a receipt to a GitHub PR

Requires an authenticated `gh` CLI.

```bash
receipts github comment --pr 123                       # uses latest receipt + origin repo
receipts github comment --pr 123 --repo heybeaux/receipts --dry-run
```

---

## OpenClaw integration

Receipts ships an optional [OpenClaw](https://openclaw.ai) plugin adapter. When enabled, it listens to the `agent_end` lifecycle hook and generates a local receipt every time an agent finishes a meaningful task — no manual CLI step.

```bash
openclaw plugins install /path/to/receipts
openclaw plugins enable receipts
```

Because `agent_end` exposes conversation content, OpenClaw requires an explicit conversation-access opt-in for this non-bundled plugin:

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

Configure capture behavior under `plugins.entries.receipts.config`:

```json
{
  "captureMode": "tool-runs",          // "all" | "tool-runs" | "failures"
  "includeFailed": true,
  "workspaceDir": "/optional/fixed/output/workspace",
  "dryRun": false,
  "skipSessionKeyPrefixes": []
}
```

Behavior notes:

- **Safe by default.** The runtime plugin writes receipts in-process and never shells out, so OpenClaw's dangerous-code scanner installs it without `--dangerously-force-unsafe-install`.
- **Meaningful claims.** Claims are derived from the originating task request plus a tool-action summary — not just the trailing assistant line — and trivial completions like “done” are avoided.
- **Model attribution.** `actor.model` is resolved from `model_call_started` / `model_call_ended` telemetry when the `agent_end` context omits it; the source is recorded as `integrations.openclaw.model_source`.
- **OpenClaw metadata.** Run id, session id/key, message provider, and channel are recorded under `integrations.openclaw`, alongside a bounded `openclaw-agent-end.json` evidence artifact.

---

## The receipt schema

The portable contract lives at [`schemas/receipt.schema.json`](./schemas/receipt.schema.json) (JSON Schema 2020-12). Core fields:

- `schema_version`, `id`, `created_at`, `status`
- `claim` (`summary`, `details`)
- `actor` (`type`, `id`, `model`)
- `task`, `workspace`, `changes`
- `evidence[]`, `verification` (`summary`, `checks[]`)
- `risk` (`level`, `notes`, `assumptions`, `rollback`)
- `integrations`, `policy`, `integrity`, `recommended_next_action`

**Status values:** `draft`, `self-verified`, `needs-review`, `human-approved`, `rejected`, `superseded`.
**Check states:** `passed`, `failed`, `pending`, `not-run`.

### Integrity

On `done` and on OpenClaw hook completion, each receipt records a SHA-256 hash of its own payload plus SHA-256 hashes of every captured artifact under `integrity`, so tampering with a stored receipt or its evidence is detectable. Use `receipts verify [id|latest]` to recompute those hashes later.

---

## Architecture

```text
bin/receipts.js            thin executable
src/cli.js                 command dispatch + workflow (init/claim/evidence/run/done/list/show/verify/github/openclaw)
src/render-markdown.js     Markdown rendering
src/schema.js              receipt validation
src/integrity.js           shared payload/artifact hashing + verification
src/policy.js              conservative status/policy verdict logic
src/openclaw-receipt.js    shared claim extraction + model resolution (CLI + plugin)
openclaw/plugin.js         OpenClaw agent_end plugin adapter (in-process, no shell-out)
schemas/receipt.schema.json published JSON Schema
```

Design principles: intentionally boring (local filesystem, portable JSON, Markdown), adapters not dependencies, and honesty over polish.

---

## Adoption Guide

Receipts v1 adoption docs are being tracked in [`docs/adoption.md`](./docs/adoption.md), covering local CLI use, trust verification, OpenClaw, GitHub PR comments, CI usage, and worked examples.

---

## Development

```bash
npm run lint        # syntax-check all first-party JS
npm test            # OpenSpec validation + unit tests + CLI smoke test
npm run build       # npm package dry-run
npm run cli -- help
```

GitHub Actions runs the same contract on Node 20.x and 22.x via [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

The product spec is managed with [OpenSpec](https://github.com/Fission-AI/OpenSpec):

```bash
npm run openspec:list
npm run openspec:validate
npm run openspec:show
```

Spec artifacts:

- [`proposal.md`](./openspec/changes/define-receipts-v0/proposal.md)
- [`specs/receipts/spec.md`](./openspec/changes/define-receipts-v0/specs/receipts/spec.md)
- [`design.md`](./openspec/changes/define-receipts-v0/design.md)
- [`tasks.md`](./openspec/changes/define-receipts-v0/tasks.md)

The original monolithic plan is preserved in [`PLAN.md`](./PLAN.md).

---

## Roadmap

**Shipped (v0.1):**

- Local CLI: `init`, `claim`, `evidence add`, `run`, `done`
- JSON + Markdown output, git evidence collection
- Schema validation, unit/smoke tests
- SHA-256 integrity hashing
- GitHub PR comment adapter
- OpenClaw `agent_end` hook adapter (live-verified)
- Claim extraction + model attribution refinements

**Next:**

- Semantic claim summarization for long/multi-tool turns
- Additional adapters (Linear/Jira, Slack/Discord, CI artifact upload)
- Optional content signing
- Deeper Ginnung-stack integrations (Sonder, Lattice, ACR, Engram, Parliament)

Receipts must not depend on any of those — they make it stronger when present, not required.

---

## License

ISC. See repository metadata.

---

Built by [heybeaux](https://github.com/heybeaux). Receipts or it didn’t happen.
