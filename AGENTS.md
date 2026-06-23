# AGENTS.md - Receipts Agent Entry Point

You are working in a repository that uses **Receipts**: local-first proof-of-work artifacts for AI/dev tasks.

Your job is not just to say “done.” Your job is to leave behind a verifiable receipt that shows:

- what you claimed,
- what you changed,
- what evidence supports the claim,
- what checks passed/failed/were not run,
- what risks remain,
- and what a human should do next.

## Install Receipts Locally

If the `receipts` command is already available, use it. Otherwise install it from npm/ClawHub package scope:

```bash
npm install -g @beaux-riel/receipts
```

For local development from this repository:

```bash
npm install
npm run cli -- help
```

If global install is unavailable, run the CLI through Node:

```bash
node /path/to/receipts/bin/receipts.js help
```

## Start a Receipt at Task Start

From the target project root:

```bash
receipts init
receipts claim "Short task summary" \
  --details "What you intend to implement or verify." \
  --actor-type agent \
  --actor-id "${AGENT_ID:-agent}" \
  --model "${MODEL:-unknown}"
```

Guidance:

- Be specific. “Fix auth callback state handling” beats “done.”
- Put the user/request/task intent in the claim.
- Keep details factual, not salesy.

## Capture Evidence While You Work

Prefer wrapping verification commands so stdout/stderr/exit codes are captured automatically:

```bash
receipts run -- npm test
receipts run -- npm run lint
receipts run -- npm run build
```

Attach extra evidence when useful:

```bash
receipts evidence add --file path/to/screenshot.png --kind screenshot --label "Manual browser smoke"
receipts evidence add --link https://github.com/org/repo/actions/runs/123 --kind ci-run --label "GitHub Actions run"
receipts evidence add --note "Reviewed migration rollback path" --kind note --label "Manual review"
```

## Complete the Receipt Before Final Response

At the end of the task:

```bash
receipts done \
  --risk "Known limitation or untested path." \
  --not-run "Any important check you did not run." \
  --next "Recommended human next action."
```

Only request self-verification when the evidence actually supports it:

```bash
receipts done --self-verified --next "Review and merge if satisfied."
```

Receipts will downgrade unsafe `--self-verified` requests to `needs-review` when checks are missing, failed, pending, or explicitly not run.

## Inspect and Verify

After completion:

```bash
receipts list
receipts show latest
receipts verify latest
```

Use JSON when another tool/agent needs structured output:

```bash
receipts list --json
receipts show latest --json
receipts verify latest --json
```

`receipts verify` must exit clean before you claim the receipt is intact. It detects receipt JSON tampering and missing/modified artifacts.

## Posting to GitHub PRs

If the task belongs to a pull request and `gh` is authenticated:

```bash
receipts github comment --pr 123
```

Use dry-run first when uncertain:

```bash
receipts github comment --pr 123 --dry-run
```

## Status Language for Agents

When reporting back to a human, include:

- receipt id,
- receipt status,
- key checks run,
- known risks/not-run checks,
- verification result.

Example:

```text
Implemented and tested. Receipt: rcpt_...; status: self-verified; verify: clean. Checks: npm test, npm run lint. Risk: browser smoke not run.
```

## Red Lines

- Do not mark work self-verified if checks failed or were not run.
- Do not hide risks in prose; record them in the receipt.
- Do not edit completed receipt JSON/artifacts after `receipts done` unless you intend verification to detect tampering.
- Do not claim remote CI passed unless you checked the actual run.

Receipts or it didn’t happen.
