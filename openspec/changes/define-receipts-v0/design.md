# Design: Receipts v0

## Overview

Receipts v0 is a local-first proof-of-work artifact layer for AI teams.

The product should begin as a small CLI and schema package. It should create durable JSON and Markdown receipts from claims, evidence, verification results, risk notes, and workspace metadata.

The architecture should be intentionally boring:

- local filesystem storage
- portable JSON schema
- Markdown renderer
- composable evidence collectors
- optional integrations

The first implementation should not require any hosted service.

## Core Architecture

### Receipts Core

Receipts Core owns the portable model.

Responsibilities:

- Receipt schema
- Receipt validation
- Receipt id generation
- Timestamp/provenance basics
- Markdown rendering
- JSON rendering
- Local filesystem layout
- CLI orchestration

### Evidence Collectors

Collectors gather proof and normalize it into receipt evidence entries.

Initial collectors:

- Git status/diff collector
- Command output collector
- File/artifact collector
- URL/link collector
- Manual notes collector

Later collectors:

- GitHub PR/issue collector
- CI collector
- Browser screenshot collector
- Playwright trace collector
- Slack/Discord/Linear/Jira collector
- OpenClaw session/tool-run collector

### Integrations

Integrations are optional adapters over the core receipt model.

Potential integrations:

- GitHub: comment receipt on PR
- Linear/Jira: attach receipt to task
- Slack/Discord: post receipt summary
- CI: upload receipt artifact
- OpenClaw: generate receipt at agent task completion
- Claude Code/Codex/Cursor: convert session/tool history into receipt evidence

### Ginnung Stack Adapters

These adapters are not public v0 dependencies. They are internal power-path integrations.

#### Sonder Adapter

- Ingest Sonder event streams
- Convert action/delegation/task events into receipt timelines
- Link receipt evidence to event ids
- Emit receipt-created and receipt-updated events

#### Lattice Adapter

- Attach authority and governance verdicts
- Record approval state
- Mark actions requiring human approval
- Represent policy and risk gates in the receipt

#### ACR Adapter

- Record mounted capabilities
- Record requested capabilities
- Identify missing capabilities discovered during work
- Link capability version or manifest to evidence

#### Engram Adapter

- Link receipt to delegation contract
- Compare expected outputs against produced evidence
- Preserve receipt summaries for future continuity
- Store decisions and evidence requirements

#### Ginnung Adapter

- Display live receipt state
- Show missing evidence before completion
- Highlight high-risk or low-evidence claims
- Provide supervision cockpit review controls

#### Parliament Adapter

- Escalate disputed or high-risk receipts
- Generate multi-agent critique
- Attach deliberation verdicts

## Draft Receipt JSON Shape

```json
{
  "schema_version": "0.1.0",
  "id": "rcpt_20260622_203800_ab12cd",
  "created_at": "2026-06-22T20:38:00-07:00",
  "status": "needs-review",
  "claim": {
    "summary": "Fixed auth callback bug",
    "details": "Updated callback handling and verified login flow."
  },
  "actor": {
    "type": "agent",
    "id": "nori",
    "model": "sakana/fugu-ultra"
  },
  "task": {
    "source": "manual",
    "id": null,
    "url": null
  },
  "workspace": {
    "repo": "example/repo",
    "branch": "fix/auth-callback",
    "commit_before": "abc123",
    "commit_after": "def456"
  },
  "changes": [
    {
      "path": "src/auth/callback.ts",
      "kind": "modified",
      "summary": "Handled missing state parameter and added defensive error response."
    }
  ],
  "evidence": [
    {
      "kind": "command",
      "label": "Unit tests",
      "command": "npm test",
      "exit_code": 0,
      "artifact": "artifacts/npm-test.log"
    }
  ],
  "verification": {
    "summary": "Unit tests passed; browser smoke test not run.",
    "checks": [
      {
        "kind": "test",
        "label": "npm test",
        "status": "passed"
      }
    ]
  },
  "risk": {
    "level": "medium",
    "notes": [
      "OAuth provider edge cases not manually tested."
    ],
    "rollback": "Revert commit def456."
  },
  "integrations": {
    "sonder_event_ids": [],
    "lattice_verdict": null,
    "acr_capabilities": [],
    "engram_contract_id": null,
    "ginnung_state": null,
    "parliament_verdict": null
  },
  "recommended_next_action": "Review diff and run browser login smoke test."
}
```

## Local Filesystem Layout

Proposed v0 layout:

```text
.receipts/
├── config.json
├── active.json
├── receipts/
│   └── <receipt-id>.json
├── markdown/
│   └── <receipt-id>.md
└── artifacts/
    └── <receipt-id>/
        ├── git.diff
        ├── command-001.stdout.log
        └── command-001.stderr.log
```

## CLI Shape

```bash
receipts init
receipts claim "Fixed auth callback bug"
receipts evidence add --cmd "npm test" --exit-code 0 --output artifacts/test.log
receipts evidence add --file screenshots/login-flow.png --kind screenshot
receipts run -- npm test
receipts done
```

### Command Notes

- `receipts init` creates `.receipts/` storage and config.
- `receipts claim` creates a draft receipt and marks it active.
- `receipts evidence add` attaches external evidence to the active receipt.
- `receipts run -- <cmd>` wraps a command and captures output/exit code.
- `receipts done` collects git/workspace metadata, asks for or accepts risk notes, and renders JSON + Markdown.

## Markdown Output Shape

```md
# Receipt: Fixed auth callback bug

**Status:** Needs review  
**Actor:** nori / sakana/fugu-ultra  
**Created:** 2026-06-22 20:38 PDT

## Claim

Fixed auth callback handling for missing state parameters.

## Changes

- `src/auth/callback.ts` — added defensive validation and explicit error response.
- `tests/auth-callback.test.ts` — added missing-state regression coverage.

## Evidence

- `npm test` — passed, exit code 0
- Git diff captured
- Screenshot: `artifacts/login-error.png`

## Verification

Passed:

- Unit tests
- Typecheck

Not run:

- Full browser OAuth smoke test

## Risks

- Provider-specific OAuth edge cases not manually tested.

## Recommended Next Action

Review diff, run browser smoke test, then merge.
```

## Initial Technical Choices

Open questions to decide before implementation:

1. Runtime language:
   - TypeScript fits the heybeaux/OpenClaw/Ginnung ecosystem.
   - Go or Rust would make distribution cleaner.
   - Recommendation: start TypeScript unless distribution becomes the primary constraint.
2. Command evidence capture:
   - `receipts run -- <command>` is stronger than manually recording command output.
   - Recommendation: include this in the CLI shape early.
3. Append-only receipts:
   - Append-only history improves auditability but adds friction.
   - Recommendation: keep mutable drafts, immutable completed artifacts.
4. Signatures:
   - Full signing is likely not v0.
   - Recommendation: include content hashes later after the basic workflow is useful.
5. First integration target:
   - Recommended: GitHub PR comments or OpenClaw task completion.

## Risks and Mitigations

### Too much friction

If receipts are annoying to create, agents and humans will skip them.

Mitigations:

- Auto-collect as much as possible.
- Make manual evidence optional but easy.
- Optimize for a useful `receipts done` default.

### False confidence

A polished receipt could make weak evidence look stronger than it is.

Mitigations:

- Always include unverified areas.
- Use explicit evidence completeness states.
- Distinguish claims from verified facts.

### Product overlap with Sonder

Receipts should not become a competing observability runtime.

Mitigations:

- Keep Receipts focused on portable proof artifacts.
- Let Sonder own event streams and runtime observability.
- Build a Sonder adapter, not a Sonder replacement.

### Scope creep

Trust infrastructure can sprawl quickly.

Mitigations:

- v0 is local CLI plus schema plus Markdown/JSON.
- No dashboard until the receipt primitive proves value.

## Working Principle

Receipts should be brutally honest.

A useful receipt does not need to prove everything succeeded. It needs to clearly distinguish:

- what was claimed,
- what was actually observed,
- what evidence exists,
- what was not checked,
- and what the human should do next.
