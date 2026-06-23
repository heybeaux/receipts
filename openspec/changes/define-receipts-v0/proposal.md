# Proposal: Define Receipts v0

## Intent

Receipts should become a standalone proof-of-work layer for AI-native teams.

The v0 product will turn vague agent status updates like “done”, “fixed”, or “reviewed” into structured, verifiable completion artifacts containing claims, evidence, verification results, risks, artifacts, and recommended next actions.

The product must stand on its own as a lightweight local CLI/schema/SDK direction, while remaining designed for deeper optional integrations with Beaux’s Ginnung stack.

Core wedge:

> Every meaningful AI task should end with a receipt.

## Problem

AI work often fails at the reporting boundary.

Common failure modes:

- **Vibes-based status:** agents say “done” without enough evidence.
- **Human re-verification tax:** humans manually reconstruct work from diffs, logs, test output, screenshots, CI, task history, and chat.
- **Scattered artifacts:** proof is distributed across tools and rarely survives in the final summary.
- **Unclear risk:** agents omit assumptions, untested areas, and weak confidence boundaries.
- **Weak auditability:** teams lack durable records of what happened, who or what acted, what capabilities were used, and which checks passed.
- **No standard handoff object:** every agent, IDE, CI system, and chat tool reports completion differently.

## Scope

This change defines the initial product plan and specification for Receipts v0.

Included:

- Product positioning
- MVP requirements
- Receipt schema requirements
- Local CLI workflow requirements
- Evidence collection requirements
- Markdown and JSON output requirements
- Risk and verification reporting requirements
- Optional integration strategy for external tools and the Ginnung stack
- Implementation task plan

## Non-Goals

Receipts v0 will not include:

- Hosted SaaS dashboard
- Complex trust scoring
- Blockchain provenance
- Multi-organization permissions
- Enterprise compliance exports
- Full agent runtime
- Replacement for Sonder, Lattice, ACR, Engram, Ginnung, or Parliament
- Automatic proof of semantic correctness

## Product Positioning

### Public Positioning

Receipts is verifiable completion reporting for AI work.

It works with developer agents, coding assistants, research agents, ops agents, and future autonomous workflows.

### Ginnung-Stack Positioning

Receipts is the evidence artifact standard that the Ginnung stack can generate, enrich, govern, remember, supervise, and audit.

- **Sonder** captures event streams.
- **Lattice** contributes governance, authority, approval, and risk verdicts.
- **ACR** records capabilities, tools, and specialist agents used or requested.
- **Engram** preserves task contracts, expected outputs, evidence requirements, decisions, and continuity.
- **Ginnung** displays receipt state in the supervision cockpit.
- **Parliament** can deliberate on high-risk or disputed receipts.

Receipts must not depend on this stack, but should become obviously stronger when connected to it.

## Initial Users

- AI-native developers using coding agents
- Founders managing small agentic teams
- Engineering leads reviewing agent-generated PRs
- Consultants/freelancers using AI agents for client work
- Internal teams experimenting with autonomous workflows

## Approach

Define Receipts around a small, portable artifact model:

1. A user or agent creates a claim.
2. Evidence is collected manually and automatically.
3. Verification checks are recorded with pass/fail/not-run states.
4. Risks, assumptions, and open questions are made explicit.
5. A receipt is emitted as both machine-readable JSON and human-readable Markdown.

v0 should be a local-first CLI with a schema-first core. Integrations should be adapters, not dependencies.

## Success Criteria

MVP success:

- A developer can create a useful receipt in under two minutes.
- A reviewer can understand what happened without opening the terminal.
- A receipt clearly states what was not verified.
- Generated Markdown is good enough to paste into GitHub, Slack, Linear, or a PR comment.

Product success:

- Reduces human review/reconstruction time.
- Increases trust in AI-agent work.
- Surfaces missing evidence before humans ask for it.
- Becomes a default completion artifact for agent tasks.
