# Receipts Adoption Guide

Receipts v1 should be self-contained: no hosted backend, no OpenClaw requirement, no Ginnung-stack dependency. This guide tracks the adoption paths that should be documented and tested before v1 is cut.

## 1. Local CLI Adoption

Target user: a developer or agent running in a git checkout.

Expected flow:

```bash
npm install -g @beaux-riel/receipts
receipts init
receipts claim "Implement feature X" --details "Short implementation summary."
receipts run -- npm test
receipts done --risk "Manual browser smoke not run." --not-run "Browser smoke test" --next "Review diff and smoke test manually."
receipts list
receipts show latest
receipts verify latest
```

Docs need to explain:

- Where receipts are stored (`.receipts/`).
- What JSON vs Markdown outputs are for.
- Why `needs-review` is the default.
- What `self-verified` means and when policy allows it.

## 2. Trust / Verification Adoption

Target user: a reviewer who wants to know whether the receipt and evidence still match what was generated.

Expected flow:

```bash
receipts verify latest
receipts verify rcpt_... --json
```

Docs need to explain:

- Payload hash vs artifact hashes.
- Expected clean output.
- Failure output for tampered receipt JSON.
- Failure output for modified/missing artifacts.
- Exit codes for CI.

## 3. OpenClaw Adoption

Target user: OpenClaw users who want automatic receipts for agent turns.

Expected flow:

```bash
openclaw plugins install @beaux-riel/receipts
openclaw plugins enable receipts
```

Required config note:

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

Docs need to explain:

- Why conversation access is required.
- Default capture behavior (`tool-runs`, failed turns included).
- Where generated OpenClaw receipts land.
- What OpenClaw metadata is captured.
- How model attribution is resolved.

## 4. GitHub PR Adoption

Target user: a developer or agent posting proof-of-work to a PR.

Expected flow:

```bash
receipts github comment --pr 123
receipts github comment --pr 123 --repo heybeaux/receipts --dry-run
```

Docs need to explain:

- Requires authenticated `gh`.
- Uses latest receipt by default.
- Markdown is posted as the PR comment body.

## 5. CI Adoption

Target user: CI job that wants to attach and verify a receipt.

Expected flow:

```bash
receipts init
receipts claim "CI verification for $GITHUB_SHA" --actor-type ci --actor-id github-actions
receipts run -- npm test
receipts done --self-verified --next "Merge if branch protection is green."
receipts verify latest --json
```

Docs need to explain:

- Non-zero verify exit codes fail CI.
- Policy may downgrade `--self-verified` if checks are weak.
- Upload `.receipts/` as a CI artifact.

## 6. Worked Examples

Before v1, add at least one worked example showing:

- A clean receipt.
- A receipt with a not-run check.
- A tampered receipt or artifact detected by `verify`.

Examples can live under `docs/examples/` or inline in README if short.
