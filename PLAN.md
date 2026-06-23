# Receipts Product Plan

**Working name:** Receipts  
**Tagline:** Receipts or it didn’t happen.  
**Serious tagline:** Verifiable proof-of-work for AI teams.  
**Status:** Product concept / v0 planning  
**Created:** 2026-06-22  
**Origin:** Nori × Beaux product ideation

## 1. Executive Summary

Receipts is a standalone proof-of-work layer for AI-native teams.

It turns vague agent status updates like “fixed it”, “done”, or “reviewed” into structured, verifiable completion artifacts containing claims, evidence, verification results, risks, artifacts, and recommended next actions.

The product should stand on its own as a lightweight CLI/schema/SDK, while Beaux’s Ginnung stack can make it substantially more capable through native integrations with Sonder, Lattice, ACR, Engram, Parliament, and related systems.

The core wedge is simple:

> Every meaningful AI task should end with a receipt.

## 2. Product Thesis

As AI agents become teammates, the primary bottleneck shifts from generation to trust.

Teams do not just need agents that can do work. They need a reliable way to answer:

- What exactly did the agent claim it did?
- What changed?
- What evidence supports the claim?
- What commands, tests, or checks were run?
- What remains unverified?
- What should a human do next?

Today, this evidence is scattered across chat threads, terminal logs, diffs, screenshots, CI output, issue trackers, memory systems, and human judgment.

Receipts packages that evidence into a portable artifact that humans and machines can inspect.

## 3. Positioning

### Public positioning

**Receipts is verifiable completion reporting for AI work.**

It works with developer agents, coding assistants, research agents, ops agents, and future autonomous workflows.

### Internal Ginnung-stack positioning

Receipts is the evidence artifact standard that the stack can generate, enrich, govern, remember, supervise, and audit.

- **Sonder** captures event streams.
- **Lattice** contributes governance, authority, approval, and risk verdicts.
- **ACR** records capabilities, tools, and specialist agents used or requested.
- **Engram** preserves task contracts, expected outputs, evidence requirements, decisions, and continuity.
- **Ginnung** displays receipt state in the supervision cockpit.
- **Parliament** can deliberate on high-risk or disputed receipts.

Receipts should not depend on this stack, but it should become obviously stronger when connected to it.

## 4. Problem

AI work often fails at the reporting boundary.

Common failure modes:

1. **Vibes-based status**  
   Agents say “done” without enough evidence.

2. **Human re-verification tax**  
   The human must manually inspect diffs, logs, tests, screenshots, CI, and task history.

3. **Scattered artifacts**  
   Proof lives across tools and disappears from the work summary.

4. **Unclear risk**  
   Agents often omit what was not tested, what assumptions were made, and where confidence is weak.

5. **Weak auditability**  
   Teams lack durable records of what happened, who/what acted, which tools were used, and which checks passed.

6. **No standard handoff object**  
   Each agent, IDE, CI system, and chat tool reports completion differently.

## 5. Target Users

### Initial users

- AI-native developers using coding agents
- Founders managing small agentic teams
- Engineering leads reviewing agent-generated PRs
- Consultants/freelancers using AI agents for client work
- Internal teams experimenting with autonomous workflows

### Later users

- Compliance-sensitive teams
- Enterprise AI platform teams
- AI QA/evaluation teams
- Managed service providers using agents for repeatable work
- Agent marketplaces and capability ecosystems

## 6. Core Product Promise

Receipts should answer six questions quickly:

1. **Claim:** What is being asserted?
2. **Change:** What changed or was produced?
3. **Evidence:** What proof supports the claim?
4. **Verification:** What checks passed or failed?
5. **Risk:** What remains uncertain or untested?
6. **Action:** What should happen next?

## 7. MVP Scope

The first version should be aggressively boring and immediately useful.

### MVP deliverables

- A portable receipt schema
- A local CLI
- Markdown receipt output
- JSON receipt output
- Git diff/file-change collection
- Command/test evidence capture
- Manual evidence attachment
- Risk/open-question prompts
- Basic validation of required receipt fields

### MVP CLI sketch

```bash
receipts init
receipts claim "Fixed auth callback bug"
receipts evidence add --cmd "npm test" --exit-code 0 --output test.log
receipts evidence add --file screenshots/login-flow.png --kind screenshot
receipts done
```

### MVP output

- `.receipts/receipts/<receipt-id>.json`
- `.receipts/receipts/<receipt-id>.md`
- Optional terminal summary

## 8. Non-Goals for v0

Avoid bloating the first release.

Not v0:

- Hosted SaaS dashboard
- Complex trust scoring
- Blockchain provenance
- Multi-org permissions
- Enterprise compliance exports
- Full agent runtime
- Replacing Sonder, Lattice, ACR, Engram, or Ginnung
- Automatically proving semantic correctness

Receipts should start as a thin, sharp artifact layer.

## 9. Core Concepts

### Receipt

A durable proof-of-work artifact describing a completed or attempted task.

### Claim

A specific assertion about work performed.

Example:

> Fixed Telegram reaction handling so routine messages no longer receive excessive reactions.

### Evidence

Artifacts supporting or refuting the claim.

Examples:

- Git diff
- Changed files
- Test output
- Build logs
- Screenshots
- URLs
- PR links
- CI runs
- Terminal commands
- Browser traces
- Human approvals

### Verification

Checks performed against the claim.

Examples:

- `npm test` passed
- `pnpm lint` failed
- Manual browser smoke test passed
- CI pending
- Not run

### Risk

Known unknowns, untested areas, assumptions, and rollback considerations.

### Verdict

Current review state of the receipt.

Example values:

- `draft`
- `self_verified`
- `needs_review`
- `human_approved`
- `rejected`
- `superseded`

## 10. Draft Receipt Schema

```json
{
  "schema_version": "0.1.0",
  "id": "rcpt_20260622_203800_ab12cd",
  "created_at": "2026-06-22T20:38:00-07:00",
  "status": "needs_review",
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
    "engram_contract_id": null
  },
  "recommended_next_action": "Review diff and run browser login smoke test."
}
```

## 11. Product Architecture

### Receipts Core

Portable and stack-independent.

Responsibilities:

- Receipt schema
- Receipt validation
- Markdown rendering
- JSON rendering
- Local filesystem layout
- IDs, timestamps, provenance basics
- CLI workflow

### Evidence Collectors

Composable collectors that gather proof.

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

Adapters should be optional.

- GitHub: comment receipt on PR
- Linear/Jira: attach receipt to task
- Slack/Discord: post receipt summary
- CI: upload receipt artifact
- OpenClaw: generate receipt at agent task completion
- Claude Code/Codex/Cursor: convert session/tool history into receipt evidence

### heybeaux Stack Adapters

These are not required for public v0, but they are the internal power path.

#### Sonder adapter

- Ingest Sonder event streams
- Convert action/delegation/task events into receipt timelines
- Link receipt evidence to event IDs
- Emit receipt-created / receipt-updated events

#### Lattice adapter

- Attach authority and governance verdicts
- Record approval state
- Mark actions requiring human approval
- Represent policy/risk gates in the receipt

#### ACR adapter

- Record mounted capabilities
- Record requested capabilities
- Identify missing capabilities discovered during work
- Link capability version/manifest to evidence

#### Engram adapter

- Link receipt to delegation contract
- Compare expected outputs against produced evidence
- Preserve receipt summaries for future continuity
- Store decisions and evidence requirements

#### Ginnung adapter

- Display live receipt state
- Show missing evidence before completion
- Highlight high-risk/low-evidence claims
- Provide supervision cockpit review controls

#### Parliament adapter

- Escalate disputed/high-risk receipts
- Generate multi-agent critique
- Attach deliberation verdicts

## 12. User Journey: Developer Agent MVP

1. Developer or agent starts work:

   ```bash
   receipts claim "Add CSV export to reports dashboard"
   ```

2. Agent performs the task.

3. Agent records evidence:

   ```bash
   receipts evidence add --cmd "pnpm test" --exit-code 0 --output artifacts/test.log
   receipts evidence add --file artifacts/export-screenshot.png --kind screenshot
   ```

4. Agent completes the receipt:

   ```bash
   receipts done
   ```

5. Human receives a Markdown card:

   - Claim
   - Changed files
   - Tests run
   - Screenshots/artifacts
   - Risks
   - Next action

6. Human reviews evidence instead of reconstructing the work from scratch.

## 13. Markdown Receipt Template

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

## 14. Roadmap

### Phase 0 — Spec and Repo

- Create repo
- Draft product plan
- Draft schema
- Decide package/runtime language
- Decide CLI interface

### Phase 1 — Local CLI

- `receipts init`
- `receipts claim`
- `receipts evidence add`
- `receipts done`
- Markdown and JSON output
- Git collector
- Command evidence collector

### Phase 2 — Developer Workflow Integrations

- GitHub PR comment output
- GitHub Actions artifact upload
- CI check summary
- Linear/Jira task attachment
- OpenClaw run adapter

### Phase 3 — Trust and Governance

- Receipt validation rules
- Required evidence policies
- Signed receipts / hash chain
- Lattice governance adapter
- Human approval states
- Risk scoring

### Phase 4 — Hosted Product

- Team dashboard
- Receipt search
- Agent performance analytics
- Evidence completeness analytics
- Cross-repo history
- Organization policies
- Client-facing reports

### Phase 5 — Ecosystem

- Public schema registry
- SDKs
- Third-party agent adapters
- Capability marketplace tie-in through ACR
- Compliance exports

## 15. Initial Technical Choices to Decide

Open questions:

1. Should v0 be TypeScript, Go, Rust, or Python?
   - TypeScript fits the existing heybeaux/OpenClaw/Ginnung ecosystem.
   - Go/Rust would make distribution cleaner.

2. Should command evidence be captured by wrapping commands?
   - Example: `receipts run -- npm test`
   - This gives stronger evidence than manual `evidence add`.

3. Should receipts be append-only by default?
   - Stronger auditability.
   - Slightly more friction.

4. Should receipts support signatures in v0?
   - Probably not.
   - Hashing receipt content may be enough initially.

5. What is the first integration target?
   - Recommended: GitHub PR comment or OpenClaw task completion.

## 16. Success Metrics

### MVP success

- A developer can create a useful receipt in under two minutes.
- A reviewer can understand what happened without opening the terminal.
- A receipt clearly states what was not verified.
- The generated Markdown is good enough to paste into GitHub/Slack/Linear.

### Product success

- Reduces human review/reconstruction time.
- Increases trust in AI-agent work.
- Surfaces missing evidence before humans ask for it.
- Becomes a default completion artifact for agent tasks.

## 17. Risks

### Risk: Too much friction

If receipts are annoying to create, agents and humans will skip them.

Mitigation:

- Auto-collect as much as possible.
- Make manual evidence optional but easy.
- Optimize for a great `receipts done` default.

### Risk: False confidence

A pretty receipt could make weak evidence look stronger than it is.

Mitigation:

- Always include unverified areas.
- Use explicit evidence completeness states.
- Distinguish claims from verified facts.

### Risk: Product overlap with Sonder

Receipts should not become a competing observability runtime.

Mitigation:

- Keep Receipts focused on portable proof artifacts.
- Let Sonder own event streams and runtime observability.
- Build a Sonder adapter, not a Sonder replacement.

### Risk: Scope creep

Trust infrastructure can sprawl quickly.

Mitigation:

- v0 is local CLI + schema + Markdown/JSON.
- No dashboard until the receipt primitive proves value.

## 18. Recommended Immediate Next Steps

1. Confirm repo language/runtime.
2. Create initial schema file.
3. Implement local filesystem layout.
4. Build `receipts done` around git diff + manual risk notes.
5. Dogfood it on the next agent-coded task.
6. Add GitHub PR comment integration once the Markdown output feels right.

## 19. Working Principle

Receipts should be brutally honest.

A useful receipt does not need to prove everything succeeded. It needs to clearly distinguish:

- what was claimed,
- what was actually observed,
- what evidence exists,
- what was not checked,
- and what the human should do next.

That is the product.
