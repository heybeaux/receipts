# Tasks

## 1. Project Setup

- [x] 1.1 Initialize Receipts repository.
- [x] 1.2 Add OpenSpec as a project dependency.
- [x] 1.3 Initialize OpenSpec project structure.
- [x] 1.4 Migrate monolithic `PLAN.md` into OpenSpec proposal, spec, design, and tasks artifacts.

## 2. Product Definition

- [x] 2.1 Define product intent and problem statement.
- [x] 2.2 Define public and Ginnung-stack positioning.
- [x] 2.3 Define target users and success criteria.
- [x] 2.4 Define non-goals for v0.

## 3. Requirements

- [x] 3.1 Define receipt artifact requirements.
- [x] 3.2 Define claim, evidence, verification, risk, and status requirements.
- [x] 3.3 Define JSON and Markdown output requirements.
- [x] 3.4 Define local CLI workflow requirements.
- [x] 3.5 Define git evidence collection requirements.
- [x] 3.6 Define optional integration adapter requirements.
- [x] 3.7 Define receipt honesty requirements.

## 4. Design

- [x] 4.1 Define Receipts Core responsibilities.
- [x] 4.2 Define evidence collector architecture.
- [x] 4.3 Define optional integration architecture.
- [x] 4.4 Define Ginnung-stack adapters.
- [x] 4.5 Draft receipt JSON shape.
- [x] 4.6 Draft local filesystem layout.
- [x] 4.7 Draft CLI shape.
- [x] 4.8 Draft Markdown output shape.
- [x] 4.9 Capture technical choices and risks.

## 5. Validation

- [x] 5.1 Validate OpenSpec change with `openspec validate define-receipts-v0`.
- [x] 5.2 Validate all OpenSpec files with `openspec validate --all`.
- [x] 5.3 Verify package dependency install state.
- [x] 5.4 Commit migration changes.

## 6. Next Implementation Phase

- [x] 6.1 Decide runtime language for the first CLI implementation. (Node.js, zero runtime deps.)
- [x] 6.2 Create initial receipt schema module. (Inlined in `bin/receipts.js`, schema_version 0.1.0.)
- [x] 6.3 Implement local filesystem layout. (`.receipts/` config/active/receipts/markdown/artifacts.)
- [x] 6.4 Implement `receipts init`.
- [x] 6.5 Implement `receipts claim`.
- [x] 6.6 Implement `receipts evidence add`.
- [x] 6.7 Implement `receipts run -- <command>`.
- [x] 6.8 Implement `receipts done` with git metadata collection.
- [x] 6.9 Render JSON receipts.
- [x] 6.10 Render Markdown receipts.
- [x] 6.11 Dogfood Receipts on the next agent-coded task. (Self-receipt generated for this CLI build.)

## 7. Follow-up Implementation Phase

- [x] 7.1 Extract schema/renderer into modules with unit tests. (`src/` modules + `test/unit.js`, JSON Schema in `schemas/`.)
- [x] 7.2 Add GitHub PR comment integration adapter. (`receipts github comment` via `gh`, with `--dry-run`.)
- [x] 7.3 Add OpenClaw task-completion receipt hook. (`openclaw/plugin.js` registers `agent_end`; `receipts openclaw agent-end` converts hook payloads.)
- [x] 7.4 Add content hashing for completed receipts. (SHA-256 payload + artifact hashes in `integrity`.)

## 8. OpenClaw Hook Refinements

Discovered during the first live `agent_end` receipt (`rcpt_20260623_125717_3b8b89`),
where the claim collapsed to a trivial last line ("done") and `actor.model` was null.

- [x] 8.1 Improve claim extraction for OpenClaw receipts. (Shared `src/openclaw-receipt.js`: strips subagent/timestamp preamble, prefers originating user request + tool-action summary, falls back away from trivial lines like "done".)
- [x] 8.2 Resolve actor model metadata for OpenClaw receipts. (Plugin caches `model_call_started`/`model_call_ended` provider+model per `runId` and resolves `actor.model` on `agent_end`; records `integrations.openclaw.model_source`.)
