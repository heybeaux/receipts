# Delta for Receipts v1

## ADDED Requirements

### Requirement: Receipt Verification

The system SHALL provide a local command that verifies receipt integrity.

#### Scenario: Clean receipt verifies successfully

- GIVEN a completed receipt with an integrity block
- AND all referenced artifacts still match their recorded hashes
- WHEN the user runs `receipts verify <receipt-id>`
- THEN the command SHALL recompute the receipt payload hash
- AND it SHALL recompute all recorded artifact hashes
- AND it SHALL report the receipt as clean
- AND it SHALL exit with code 0

#### Scenario: Receipt payload tampering is detected

- GIVEN a completed receipt with an integrity block
- AND the receipt JSON payload has been modified after completion
- WHEN the user runs `receipts verify <receipt-id>`
- THEN the command SHALL report a payload hash mismatch
- AND it SHALL exit non-zero

#### Scenario: Artifact tampering is detected

- GIVEN a completed receipt with recorded artifact hashes
- AND a referenced artifact has changed or is missing
- WHEN the user runs `receipts verify <receipt-id>`
- THEN the command SHALL identify the affected artifact
- AND it SHALL exit non-zero

#### Scenario: JSON verification output is available

- GIVEN a completed receipt
- WHEN the user runs `receipts verify <receipt-id> --json`
- THEN the command SHALL emit structured verification results suitable for CI

### Requirement: Policy-Driven Receipt Verdicts

The system SHALL apply conservative policy rules before marking a receipt self-verified.

#### Scenario: Self-verification is allowed for clean passed checks

- GIVEN a draft receipt has at least one passed verification check
- AND it has no failed, pending, or not-run checks
- WHEN the user runs `receipts done --self-verified`
- THEN the completed receipt MAY have status `self-verified`
- AND it SHALL record the policy verdict and reasons

#### Scenario: Self-verification is downgraded when checks are weak

- GIVEN a draft receipt has failed, pending, or not-run checks
- OR it has no verification checks
- WHEN the user runs `receipts done --self-verified`
- THEN the completed receipt SHALL NOT have status `self-verified`
- AND it SHALL have status `needs-review`
- AND it SHALL record the policy reasons for the downgrade

#### Scenario: Human approval is not automatic

- GIVEN a receipt is completed by local CLI automation
- WHEN output is generated
- THEN the system SHALL NOT automatically mark it `human-approved`

### Requirement: Receipt Listing

The system SHALL provide a local command for browsing completed receipts.

#### Scenario: Completed receipts are listed

- GIVEN one or more completed receipts exist
- WHEN the user runs `receipts list`
- THEN the command SHALL print receipt ids, statuses, timestamps, and claim summaries
- AND it SHOULD sort newest first

#### Scenario: List output is machine-readable

- GIVEN one or more completed receipts exist
- WHEN the user runs `receipts list --json`
- THEN the command SHALL emit a JSON array of receipt summaries

### Requirement: Receipt Inspection

The system SHALL provide a local command for inspecting one receipt.

#### Scenario: Receipt is shown as Markdown by default

- GIVEN a completed receipt exists
- WHEN the user runs `receipts show <receipt-id>`
- THEN the command SHALL print the human-readable Markdown receipt when available
- AND it SHALL fall back to rendering Markdown from JSON when the Markdown file is absent

#### Scenario: Receipt is shown as JSON

- GIVEN a completed receipt exists
- WHEN the user runs `receipts show <receipt-id> --json`
- THEN the command SHALL print the receipt JSON

#### Scenario: Latest receipt can be referenced

- GIVEN at least one completed receipt exists
- WHEN the user runs `receipts show latest` or `receipts verify latest`
- THEN the command SHALL resolve the newest completed receipt
