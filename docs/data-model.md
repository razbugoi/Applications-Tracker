# Data Model & Workflow

## Entities
### Application
| Field | Description |
| --- | --- |
| `applicationId` | UUID generated on creation. |
| `prjCodeName` | Combined project code and name (from spreadsheet). |
| `ppReference` | Internal PP reference. |
| `lpaReference` | Local Planning Authority reference. Optional until validated. |
| `description` | Description of development. |
| `council` | Council / Authority name. |
| `submissionDate` | ISO date string. |
| `validationDate` | ISO date string when validated. Null until validation. |
| `caseOfficer` | Officer handling the case. |
| `determinationDate` | Expected/actual determination date. |
| `eotDate` | Extension of Time deadline if agreed. |
| `status` | Enum: `Submitted`, `Invalidated`, `Live`, `Determined`. |
| `outcome` | Enum: `Approved`, `Refused`, `Withdrawn`, `Pending`, etc. |
| `notes` | Free-form notes. |
| `issuesCount` | Derived count of open issues (maintained by backend). |

### Issue
| Field | Description |
| --- | --- |
| `issueId` | UUID. |
| `applicationId` | FK to Application. |
| `ppReference` | Denormalised for quick lookups. |
| `title` | Short issue headline. |
| `category` | Enum: `Validation`, `Technical`, `Design`, etc. |
| `description` | Detailed issue text. |
| `raisedBy` | Person or organisation raising the issue. |
| `dateRaised` | ISO date string. |
| `assignedTo` | Responsible colleague. |
| `status` | Enum: `Open`, `In Progress`, `Resolved`, `Closed`. |
| `dueDate` | Deadline provided by authority. |
| `resolutionNotes` | Summary of resolution. |
| `dateResolved` | When marked resolved. |

### TimelineEvent
| Field | Description |
| --- | --- |
| `eventId` | UUID. |
| `applicationId` | FK to Application. |
| `timestamp` | ISO timestamp. |
| `stage` | Enum reflecting pipeline stage (`Submitted`, `Live`, `Invalidated`, `Determined`). |
| `event` | Human-readable event name (`Submission`, `Validation`, `Revalidation`, `Decision Issued`, etc.). |
| `details` | Optional notes. |
| `durationDays` | Numeric for reporting (derived). |

## DynamoDB Single-Table Design
- **Partition Key (`PK`)** and **Sort Key (`SK`)** patterns:
  - Application root record: `PK = APP#<applicationId>`, `SK = APP#<applicationId>`.
  - Issues: `PK = APP#<applicationId>`, `SK = ISSUE#<issueId>`.
  - Timeline events: `PK = APP#<applicationId>`, `SK = EVENT#<timestamp ISO>`.
  - Global secondary index `GSI1` for queries by status and submission date: `GSI1PK = STATUS#<status>`, `GSI1SK = SUBMITTED#<submissionDate>#APP#<applicationId>`.
  - Global secondary index `GSI2` for PP reference lookup: `GSI2PK = PP#<ppReference>`, `GSI2SK = APP#<applicationId>` and `ISSUE#<issueId>`.

## Access Patterns
1. **List Live Applications**: Query `GSI1` with `STATUS#Live`, paginate by `SUBMITTED#` descending.
2. **List Submitted (Awaiting Validation)**: Query `GSI1` with `STATUS#Submitted`.
3. **List Invalidated Applications**: Query `GSI1` with `STATUS#Invalidated` and include issues count.
4. **Track Issues for an Application**: Query base table by `PK = APP#<id>` filtering `SK` prefix `ISSUE#`.
5. **Find Application by PP Reference or LPA reference**: Use `GSI2` (PP) or add `GSI3` for `LPA#<lpaReference>` if needed.
6. **Timeline View**: Query base table by `PK = APP#<id>` filtering `SK` prefix `EVENT#` sorted ascending.
7. **Determinination Outcomes**: Query `GSI1` with `STATUS#Determined`, filter by `outcome` in application item attributes.

## Workflow States
1. **Submitted**: Capture core fields, status `Submitted`. Optionally allow attachments.
2. **Validation**:
   - If validated: update application (`status = Live`, set `validationDate`, add timeline event `Validated`).
   - If invalidated: update `status = Invalidated`, create one or more issues. Each issue tracked until resolved.
3. **Issue Resolution**:
   - When all issues `status = Resolved`, backend transitions application to `Live` automatically or via user action, recording timeline event `Revalidated`.
4. **Determination**:
   - Add outcome, determination date, update `status = Determined`, create timeline event `Decision Issued`.
5. **Extensions of Time**:
   - Store `eotDate` and optionally create scheduled reminder events using EventBridge (Lambda checks approaching deadlines).

## Validation Rules
- `submissionDate <= validationDate <= determinationDate` when values exist.
- Issues cannot move to `Resolved` without `resolutionNotes` and `dateResolved`.
- Application cannot transition to `Live` while any issue `status != Resolved`.
- Outcome required before marking `Determined`.

## API Contracts (initial draft)
- `POST /applications` create application.
- `GET /applications?status=Live` list by status.
- `GET /applications/{id}` retrieve application with embedded issues & timeline.
- `PATCH /applications/{id}` update fields or transition status.
- `POST /applications/{id}/issues` create issue.
- `PATCH /applications/{id}/issues/{issueId}` update/resolve issue.
- `POST /applications/{id}/timeline` add event (for manual override).
- `GET /applications/{id}/timeline` list timeline events.
- `POST /applications/{id}/documents` start S3 pre-signed upload (future enhancement).

These APIs map directly to Lambda handlers and align with the DynamoDB access patterns above.
