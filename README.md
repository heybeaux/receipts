# Receipts

**Receipts or it didn’t happen.**

Receipts is a standalone proof-of-work layer for AI-native teams. It turns vague agent status updates into structured, verifiable completion artifacts containing claims, evidence, verification results, risks, artifacts, and recommended next actions.

## Product Plan

The original monolithic plan is preserved in [`PLAN.md`](./PLAN.md).

The active OpenSpec migration lives at:

- [`openspec/changes/define-receipts-v0/proposal.md`](./openspec/changes/define-receipts-v0/proposal.md)
- [`openspec/changes/define-receipts-v0/specs/receipts/spec.md`](./openspec/changes/define-receipts-v0/specs/receipts/spec.md)
- [`openspec/changes/define-receipts-v0/design.md`](./openspec/changes/define-receipts-v0/design.md)
- [`openspec/changes/define-receipts-v0/tasks.md`](./openspec/changes/define-receipts-v0/tasks.md)

## CLI

Receipts now has a local-first Node.js CLI.

```bash
npm install
npm run cli -- init
npm run cli -- claim "Fixed auth callback bug" --details "Handled missing state."
npm run cli -- evidence add --note "Reviewed changed callback flow." --label "Manual review"
npm run cli -- run -- npm test
npm run cli -- done \
  --risk "OAuth provider edge cases not manually tested." \
  --not-run "Browser OAuth smoke test" \
  --next "Review diff and run browser smoke test."
```

When linked or installed as a package, the executable is `receipts`:

```bash
receipts init
receipts claim "Fixed auth callback bug"
receipts run -- npm test
receipts done
```

Generated artifacts live under `.receipts/`:

- `.receipts/config.json`
- `.receipts/active.json`
- `.receipts/receipts/<receipt-id>.json`
- `.receipts/markdown/<receipt-id>.md`
- `.receipts/artifacts/<receipt-id>/...`

### Post a receipt to a GitHub PR

The completed receipt Markdown can be posted as a PR comment (requires `gh` authenticated):

```bash
receipts github comment --pr 123
receipts github comment --pr 123 --repo heybeaux/receipts --dry-run
```

With no `--receipt`, it uses the most recently completed receipt. With no `--repo`, it infers the repo from `origin`.

### OpenClaw task-completion hook

Receipts ships an optional OpenClaw plugin adapter. When enabled, it listens to OpenClaw's `agent_end` lifecycle hook and generates a local receipt from completed agent turns.

Install from this checkout:

```bash
openclaw plugins install /path/to/receipts
openclaw plugins enable receipts
```

Because `agent_end` exposes conversation messages, OpenClaw requires an explicit conversation-access opt-in for this non-bundled plugin:

```json
{
  "plugins": {
    "entries": {
      "receipts": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        }
      }
    }
  }
}
```

Default behavior captures failed turns and successful turns that include tool evidence. Configure under `plugins.entries.receipts.config`:

```json
{
  "captureMode": "tool-runs",
  "includeFailed": true,
  "workspaceDir": "/optional/fixed/output/workspace",
  "dryRun": false
}
```

The adapter writes receipts into the agent turn workspace by default. It records OpenClaw run/session metadata under `integrations.openclaw` and stores a bounded `openclaw-agent-end.json` evidence artifact. The runtime plugin writes receipts in-process and does not shell out, so OpenClaw's dangerous-code scanner can install it without `--dangerously-force-unsafe-install`.

Claims are derived from the originating task request plus a tool-action summary (not just the trailing assistant line), and `actor.model` is resolved from `model_call_started`/`model_call_ended` telemetry when `agent_end` context omits the model. The resolution source is recorded as `integrations.openclaw.model_source`.

For tests or custom integrations, the CLI can convert an exported OpenClaw `agent_end` event directly:

```bash
receipts openclaw agent-end --event /tmp/agent-end.json --workspace-dir .
```

### Integrity

On `done` and OpenClaw hook completion, every receipt records a SHA-256 hash of its own payload plus SHA-256 hashes of captured artifacts under `integrity`, so tampering with a stored receipt or its evidence is detectable.

## Architecture

- `bin/receipts.js` — thin entrypoint
- `src/cli.js` — command dispatch and workflow
- `src/render-markdown.js` — Markdown rendering
- `src/schema.js` — receipt validation
- `schemas/receipt.schema.json` — published JSON Schema for the receipt artifact

## Validation

```bash
npm test
```

This runs OpenSpec validation, unit tests, and the CLI smoke test.

## OpenSpec

OpenSpec is installed as a local dev dependency.

Useful commands:

```bash
npm run openspec:list
npm run openspec:validate
npm run openspec:show
```
