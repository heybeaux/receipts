# Tasks

## 1. Trust Core

- [x] 1.1 Extract shared integrity helpers so writing and verifying use the same canonical payload/hash logic.
- [x] 1.2 Implement `receipts verify [<receipt-id>|latest]` with human-readable output and explicit exit codes.
- [x] 1.3 Add `receipts verify --json` for CI/tool consumption.
- [x] 1.4 Add tests proving clean receipts verify successfully.
- [x] 1.5 Add tests proving receipt payload tampering is detected.
- [x] 1.6 Add tests proving artifact tampering and missing artifacts are detected.
- [x] 1.7 Implement policy verdict evaluation for `receipts done`.
- [x] 1.8 Enforce that `--self-verified` downgrades to `needs-review` when checks failed, are pending/not-run, or no checks exist.
- [x] 1.9 Record policy verdict/reasons in completed receipts.

## 2. Local UX Core

- [x] 2.1 Implement `receipts list` with default compact output.
- [x] 2.2 Add `receipts list --json`, `--limit`, and `--status`.
- [x] 2.3 Implement `receipts show [<receipt-id>|latest]` with Markdown-first default output.
- [x] 2.4 Add `receipts show --json` and `--markdown`.
- [x] 2.5 Add tests for list/show latest and explicit id resolution.

## 3. Docs and Adoption

- [x] 3.1 Update README quickstart for v1 commands (`list`, `show`, `verify`).
- [x] 3.2 Add a trust workflow section: generate → verify → tamper detection.
- [x] 3.3 Add OpenClaw adoption docs, including conversation-access opt-in and ClawHub install path.
- [x] 3.4 Add GitHub PR comment adoption docs.
- [x] 3.5 Add CI-style usage docs, including verify exit codes.
- [x] 3.6 Add at least one worked example receipt or transcript in docs.
- [x] 3.7 Add GitHub Actions CI workflow for lint, test, and build.

## 4. Spec, Versioning, and Release

- [x] 4.1 Update receipt JSON Schema for v1 policy metadata.
- [ ] 4.2 Bump package/schema version when implementation is complete.
- [x] 4.3 Validate OpenSpec change and all specs.
- [x] 4.4 Run unit and smoke tests.
- [x] 4.5 Dogfood Receipts on the v1 implementation sprint.
- [x] 4.6 Commit and push v1 implementation.
- [ ] 4.7 Publish a follow-up ClawHub release when ready.
