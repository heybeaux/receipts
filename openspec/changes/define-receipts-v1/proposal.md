# Proposal: Define Receipts v1

## Intent

Move Receipts from a working v0 primitive into a self-contained v1 tool that a developer or AI team can install, inspect, verify, and adopt without relying on Beaux, OpenClaw internals, or a hosted service.

v0 proved that Receipts can generate durable proof-of-work artifacts. v1 makes those artifacts practically trustworthy and easy to consume.

## Problem

Receipts now emits integrity hashes, JSON, Markdown, GitHub comments, and OpenClaw task-completion artifacts, but several core trust and adoption loops remain incomplete:

- There is no CLI command to verify whether a stored receipt or evidence artifact has been tampered with.
- Receipt status is still mostly user/config driven rather than policy driven.
- Users cannot browse or inspect completed receipts from the CLI.
- The docs explain what Receipts is, but do not yet provide enough adoption paths for strangers: local workflow, OpenClaw install, GitHub PR usage, CI usage, and examples.

Without those pieces, Receipts is useful but not yet a self-contained v1.

## Scope

v1 SHALL focus on local trust, local discoverability, and adoption documentation.

Included:

- Add receipt verification (`receipts verify`) that recomputes payload and artifact hashes.
- Add policy-driven verdict/status logic so self-verification cannot overstate weak evidence.
- Add receipt browsing and inspection (`receipts list`, `receipts show`).
- Add docs/adoption assets for local CLI, OpenClaw, GitHub PRs, and CI-style usage.
- Update schema/spec/docs to describe v1 behavior and compatibility.
- Dogfood the v1 workflow with receipts for implementation work.

## Non-goals

- Hosted dashboard, search service, team analytics, or multi-repo history.
- Org policy management UI.
- Full public key signing infrastructure.
- Linear/Jira/Slack adapters unless they fall out as trivial docs-only examples.
- Breaking the local-first, zero-runtime-dependency architecture.

## Tracks

### Track 1 — Trust Core

Make the trust claim real:

- Verify receipt payload hashes and artifact hashes.
- Report clean/tampered/missing-artifact states with explicit exit codes.
- Enforce policy-based status decisions on `receipts done`.

### Track 2 — Local UX Core

Make receipts usable after generation:

- List completed receipts.
- Show receipt JSON or Markdown.
- Support latest receipt shortcuts.

### Track 3 — Docs and Adoption

Make Receipts independently adoptable:

- Quickstart path for local CLI.
- OpenClaw plugin install/config path.
- GitHub PR comment path.
- CI-style recipe.
- Worked example receipts and verification examples.

## Success Criteria

Receipts v1 is ready when:

- A new user can install and run the CLI from the README.
- A user can generate, list, show, and verify a receipt locally.
- Tampering with a receipt or evidence artifact is detected by `receipts verify`.
- `receipts done --self-verified` refuses or downgrades unsafe claims when policy conditions are not met.
- OpenSpec validation, unit tests, and smoke tests pass.
- The public README and docs describe the adoption paths clearly enough for third-party use.
