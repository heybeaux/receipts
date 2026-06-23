# Tasks

## 1. Trust Core

- [ ] 1.1 Extract shared integrity helpers so writing and verifying use the same canonical payload/hash logic.
- [ ] 1.2 Implement `receipts verify [<receipt-id>|latest]` with human-readable output and explicit exit codes.
- [ ] 1.3 Add `receipts verify --json` for CI/tool consumption.
- [ ] 1.4 Add tests proving clean receipts verify successfully.
- [ ] 1.5 Add tests proving receipt payload tampering is detected.
- [ ] 1.6 Add tests proving artifact tampering and missing artifacts are detected.
- [ ] 1.7 Implement policy verdict evaluation for `receipts done`.
- [ ] 1.8 Enforce that `--self-verified` downgrades to `needs-review` when checks failed, are pending/not-run, or no checks exist.
- [ ] 1.9 Record policy verdict/reasons in completed receipts.

## 2. Local UX Core

- [ ] 2.1 Implement `receipts list` with default compact output.
- [ ] 2.2 Add `receipts list --json`, `--limit`, and `--status`.
- [ ] 2.3 Implement `receipts show [<receipt-id>|latest]` with Markdown-first default output.
- [ ] 2.4 Add `receipts show --json` and `--markdown`.
- [ ] 2.5 Add tests for list/show latest and explicit id resolution.

## 3. Docs and Adoption

- [ ] 3.1 Update README quickstart for v1 commands (`list`, `show`, `verify`).
- [ ] 3.2 Add a trust workflow section: generate → verify → tamper detection.
- [ ] 3.3 Add OpenClaw adoption docs, including conversation-access opt-in and ClawHub install path.
- [ ] 3.4 Add GitHub PR comment adoption docs.
- [ ] 3.5 Add CI-style usage docs, including verify exit codes.
- [ ] 3.6 Add at least one worked example receipt or transcript in docs.

## 4. Spec, Versioning, and Release

- [ ] 4.1 Update receipt JSON Schema for v1 policy metadata.
- [ ] 4.2 Bump package/schema version when implementation is complete.
- [ ] 4.3 Validate OpenSpec change and all specs.
- [ ] 4.4 Run unit and smoke tests.
- [ ] 4.5 Dogfood Receipts on the v1 implementation sprint.
- [ ] 4.6 Commit and push v1 implementation.
- [ ] 4.7 Publish a follow-up ClawHub release when ready.
