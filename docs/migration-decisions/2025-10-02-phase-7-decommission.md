# 2025-10-02 – Phase 7 AWS Decommission

## Decision Summary
- **Decision**: Decommission legacy AWS stack (Amplify hosting, API Gateway, Lambda, DynamoDB, Cognito, IAM artefacts) following successful Vercel + Supabase production run.
- **Rationale**: 48-hour post-cutover monitoring recorded no issues; stakeholders confirmed Supabase feature parity and sign-off on 2025-09-30. Maintaining AWS resources incurred unnecessary operational overhead and risk of divergence.
- **Impact**: All production traffic now flows through Vercel + Supabase. Rolling back would require redeploying the archived SAM template and restoring DynamoDB export snapshots.

## Approvals
- Product owner: R. Shaw (`2025-09-30T15:42` in #planning-tracker)
- Service manager: L. Grant (`2025-09-30T15:42` in #planning-tracker)
- Operations: Razvan B. (executor, CR-PT-2025-102)

## Conditions / Safeguards
- Final DynamoDB export captured and stored at `supabase/exports/final-dynamodb-export-20251002T075501Z.json`.
- Runbook evidence archived under `docs/runbooks/archives/aws-decommission-20251002.md`.
- Legacy AWS IAM roles removed; no lingering credentials remain active.

## Follow-Up Actions
1. Update `docs/vercel-supabase-migration-plan.md` Phase 7 checklist (completed 2025-10-02).
2. Refresh public-facing documentation (`README`, architecture overview) to describe the Supabase/Vercel stack exclusively.
3. Schedule a lightweight retrospective to capture lessons learned (target 2025-10-04 stand-up).

## Rollback Notes
- Restore using `docs/archive/aws-sam/` resources and the final DynamoDB export if a critical regression forces return to AWS. Expect 4–6 hours to redeploy and fully rehydrate.
