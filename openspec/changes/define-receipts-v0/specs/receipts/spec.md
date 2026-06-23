# Delta for Receipts

## ADDED Requirements

### Requirement: Receipt Artifact

The system SHALL represent completed or attempted AI work as a durable receipt artifact.

A receipt SHALL distinguish claims from observed evidence and verification outcomes.

#### Scenario: Receipt captures the core proof-of-work fields

- GIVEN an agent or human has completed or attempted a task
- WHEN a receipt is generated
- THEN it SHALL include a claim summary
- AND it SHALL identify the actor
- AND it SHALL describe the task or source context when known
- AND it SHALL list changed or produced artifacts when known
- AND it SHALL include evidence entries
- AND it SHALL include verification results
- AND it SHALL include risks, assumptions, or unverified areas
- AND it SHALL recommend a next action

#### Scenario: Receipt makes uncertainty visible

- GIVEN a task has incomplete verification
- WHEN the receipt is rendered
- THEN it SHALL explicitly identify checks that were not run
- AND it SHALL NOT imply that unverified claims are proven

### Requirement: Claim Model

The system SHALL model a claim as a specific assertion about work performed or attempted.

#### Scenario: Claim records summary and details

- GIVEN a user or agent starts a receipt
- WHEN they provide a work claim
- THEN the system SHALL store a short claim summary
- AND it MAY store longer claim details

### Requirement: Evidence Model

The system SHALL support attaching evidence entries to a receipt.

Evidence entries SHALL support at least command output, files, links, logs, screenshots, git diffs, and manual notes.

#### Scenario: Command evidence is recorded

- GIVEN a user runs or records a command as evidence
- WHEN the evidence is added
- THEN the system SHALL store the command string
- AND it SHALL store the exit code when known
- AND it SHALL store or link to command output when provided

#### Scenario: File evidence is recorded

- GIVEN a user attaches a file as evidence
- WHEN the evidence is added
- THEN the system SHALL record the evidence kind
- AND it SHALL store or link to the file path
- AND it SHALL preserve a human-readable label when provided

### Requirement: Verification Model

The system SHALL record verification checks separately from raw evidence.

Verification checks SHALL support passed, failed, pending, and not-run states.

#### Scenario: Successful check is rendered

- GIVEN a receipt includes a test command that passed
- WHEN the receipt is rendered
- THEN the verification section SHALL show the check as passed
- AND it SHALL link to the supporting evidence when available

#### Scenario: Not-run check is rendered

- GIVEN a relevant verification check was not run
- WHEN the receipt is rendered
- THEN the verification section SHALL show the check as not run
- AND it SHALL preserve any explanation provided

### Requirement: Risk Model

The system SHALL require receipts to expose known risks, assumptions, rollback notes, or untested areas.

#### Scenario: Risk is present in the receipt

- GIVEN a receipt is completed
- WHEN the receipt is rendered
- THEN it SHALL include a risk section
- AND the risk section SHALL be allowed to state that no known risks were identified

### Requirement: Receipt Status

The system SHALL support a review status for receipts.

Allowed initial statuses SHOULD include draft, self-verified, needs-review, human-approved, rejected, and superseded.

#### Scenario: New receipt starts as draft

- GIVEN a user starts a receipt claim
- WHEN the receipt is created
- THEN its status SHALL be draft unless explicitly set otherwise

#### Scenario: Completed receipt requires review by default

- GIVEN a receipt is completed without human approval
- WHEN output is generated
- THEN its status SHOULD be needs-review or self-verified rather than human-approved

### Requirement: Machine-Readable Output

The system SHALL emit receipts as machine-readable JSON.

#### Scenario: JSON receipt is generated

- GIVEN a receipt has been completed
- WHEN the user runs the completion command
- THEN the system SHALL write a JSON receipt file
- AND the JSON SHALL include a schema version
- AND the JSON SHALL include a stable receipt id
- AND the JSON SHALL include creation time

### Requirement: Human-Readable Output

The system SHALL emit receipts as human-readable Markdown.

#### Scenario: Markdown receipt is generated

- GIVEN a receipt has been completed
- WHEN the user runs the completion command
- THEN the system SHALL write a Markdown receipt file
- AND the Markdown SHALL include claim, changes, evidence, verification, risks, and recommended next action sections

### Requirement: Local CLI Workflow

The system SHALL provide a local CLI workflow for creating and completing receipts.

The initial command set SHOULD include init, claim, evidence add, run, and done.

#### Scenario: Project is initialized

- GIVEN a project does not have a Receipts workspace
- WHEN the user runs receipts init
- THEN the system SHALL create local Receipts storage
- AND it SHALL prepare configuration for future receipts

#### Scenario: Claim is started

- GIVEN a project is initialized
- WHEN the user runs receipts claim with a claim summary
- THEN the system SHALL create a draft receipt
- AND it SHALL mark that receipt as the active receipt

#### Scenario: Evidence is added

- GIVEN a draft receipt exists
- WHEN the user runs receipts evidence add
- THEN the system SHALL attach the evidence to the active receipt

#### Scenario: Command is wrapped

- GIVEN a draft receipt exists
- WHEN the user runs receipts run followed by a command
- THEN the system SHALL execute the command
- AND it SHALL capture stdout, stderr, and exit code as evidence
- AND it SHALL return the command exit code to the caller

#### Scenario: Receipt is completed

- GIVEN a draft receipt exists
- WHEN the user runs receipts done
- THEN the system SHALL collect available workspace metadata
- AND it SHALL render JSON output
- AND it SHALL render Markdown output
- AND it SHALL mark the receipt as ready for review unless configured otherwise

### Requirement: Git Evidence Collection

The system SHALL collect git workspace evidence when used inside a git repository.

#### Scenario: Git diff is collected

- GIVEN the current project is a git repository
- WHEN a receipt is completed
- THEN the system SHOULD record branch name
- AND it SHOULD record before and after commit identifiers when available
- AND it SHOULD summarize changed files
- AND it SHOULD store or reference a git diff artifact

#### Scenario: Non-git workspace is supported

- GIVEN the current project is not a git repository
- WHEN a receipt is completed
- THEN the system SHALL still generate a receipt
- AND it SHALL indicate that git evidence was unavailable

### Requirement: Optional Integration Adapters

The system SHALL keep integrations optional and adapter-based.

#### Scenario: External integration unavailable

- GIVEN a receipt is generated without GitHub, Linear, Sonder, Lattice, ACR, Engram, Ginnung, or Parliament integration configured
- WHEN the receipt is completed
- THEN the system SHALL still generate valid local JSON and Markdown output

#### Scenario: Ginnung stack metadata is attached

- GIVEN optional Ginnung stack adapters are configured
- WHEN a receipt is completed
- THEN it MAY attach Sonder event ids
- AND it MAY attach Lattice governance verdicts
- AND it MAY attach ACR capability records
- AND it MAY attach Engram delegation contract ids
- AND it MAY attach Ginnung supervision state
- AND it MAY attach Parliament deliberation verdicts

### Requirement: Receipt Honesty

The system SHALL avoid overstating evidence strength.

#### Scenario: Evidence is weak

- GIVEN a receipt has a claim but no verification checks
- WHEN the receipt is rendered
- THEN it SHALL make the missing verification visible
- AND it SHALL recommend review rather than approval

#### Scenario: Check failed

- GIVEN a verification check failed
- WHEN the receipt is rendered
- THEN it SHALL show the failure prominently
- AND it SHALL not mark the receipt as human-approved automatically
