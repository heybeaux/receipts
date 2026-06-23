# Verification Workflow Example

This example shows the Receipts v1 trust loop: generate, inspect, verify, and detect tampering.

## Clean self-verified receipt

```bash
receipts init
receipts claim "Implement Receipts v1 Track 1+2" \
  --details "Added verify/list/show commands, shared integrity helpers, conservative policy verdicts, schema support, tests, and docs."
receipts evidence add \
  --cmd "npm test" \
  --exit-code 0 \
  --label "Full test suite" \
  --note "OpenSpec validation, unit tests, and CLI smoke test passed."
receipts done --self-verified --next "Review diff, then continue release tasks."
receipts verify latest
```

Expected verification shape:

```text
Receipt: rcpt_...
Status:  CLEAN
Payload: ok
Artifacts:
  - .receipts/artifacts/rcpt_.../git.diff: ok
```

The receipt may be `self-verified` because at least one check passed and no checks failed, were pending, or were marked not-run.

## Policy downgrade for weak evidence

```bash
receipts claim "Update browser login flow"
receipts done --self-verified --not-run "Browser OAuth smoke test"
receipts show latest
```

Expected policy section:

```text
## Policy

- Verdict: **needs-review**
- Requested: self-verified
- Self-verified allowed: no
- Reasons:
  - 1 not-run check
```

`--self-verified` is a request, not permission to overstate confidence.

## Receipt payload tampering

If someone edits the completed receipt JSON after it was written:

```bash
python3 - <<'PY'
import json, pathlib
path = pathlib.Path('.receipts/receipts/rcpt_....json')
receipt = json.loads(path.read_text())
receipt['claim']['summary'] = 'A different claim'
path.write_text(json.dumps(receipt, indent=2) + '\n')
PY
receipts verify rcpt_...
```

Expected result:

```text
Status:  FAILED
Payload: MISMATCH
Problems:
  - receipt payload hash mismatch
```

## Artifact tampering or deletion

If a recorded artifact changes or disappears:

```bash
echo tampered >> .receipts/artifacts/rcpt_.../git.diff
receipts verify rcpt_...
```

Expected result:

```text
Artifacts:
  - .receipts/artifacts/rcpt_.../git.diff: ARTIFACT HASH MISMATCH
Problems:
  - .receipts/artifacts/rcpt_.../git.diff: artifact hash mismatch
```

This is tamper-evidence, not tamper-prevention: Receipts tells reviewers the stored proof no longer matches what was originally completed.
