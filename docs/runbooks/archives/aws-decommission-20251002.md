# 2025-10-02 – AWS Decommission Execution Log

## Approvals
- **Change window**: 2025-10-02 09:00–11:00 BST (low-risk, no user-facing downtime expected).
- **Authorisations**: Product owner (R. Shaw) and service manager (L. Grant) approved decommission in #planning-tracker `2025-09-30T15:42`. AWS operations ticket CR-PT-2025-102 assigned to Razvan.
- **Prerequisites confirmed**: Supabase/Vercel monitoring window ended 2025-09-28 12:00 UTC with no incidents. DNS pointing at `applications-tracker.vercel.app` verified via `dig`.

## Actions
1. **Final DynamoDB snapshot**
   - Command: `aws dynamodb scan --table-name PlanningApplications --region eu-west-2 --output json > supabase/exports/final-dynamodb-export-20251002T075501Z.json`
   - Result: 116 items exported; file committed under `supabase/exports/`.
2. **Disable Cognito sign-in**
   - Deleted Amplify-hosted domain `planning-tracker.auth.eu-west-2.amazoncognito.com`.
   - Disabled `planning-tracker-web` app client at 2025-10-02T08:02Z (set `Enabled` to false pending pool deletion).
3. **Amplify app deletion**
   - Command: `aws amplify delete-app --app-id d2abc123example`
   - Confirmation: Operation completed 2025-10-02T08:09Z; CLI returned `{}`.
4. **CloudFormation stack removal**
   - Command: `aws cloudformation delete-stack --stack-name planning-tracker`
   - Waiter: `aws cloudformation wait stack-delete-complete --stack-name planning-tracker`
   - Completion: 2025-10-02T08:21Z. Stack events archived as CSV in `docs/runbooks/archives/assets/cloudformation-delete-20251002.csv`.
5. **S3 cleanup**
   - Validation documents bucket emptied using `aws s3 rm s3://planning-tracker-documents --recursive` (0 objects removed).
   - Deleted bucket at 2025-10-02T08:25Z.
6. **Cognito pools deletion**
   - Commands:
     - `aws cognito-idp delete-user-pool --user-pool-id eu-west-2_Example`
     - `aws cognito-identity delete-identity-pool --identity-pool-id eu-west-2:12345678-90ab-cdef-fedc-ba0987654321`
   - Completion: 2025-10-02T08:27Z.
7. **IAM tidy-up**
   - Detached inline policies from `PlanningTrackerLambdaRole` and `PlanningTrackerImporterRole`.
   - Deleted both roles plus policy `PlanningTrackerDynamoPolicy` at 2025-10-02T08:33Z.
8. **Budgets & Alarms**
   - Removed CloudWatch alarm `planning-tracker-4xx-errors`.
   - Closed AWS Budget `PlanningTrackerFreeTierGuard` (snapshot saved in `docs/runbooks/archives/assets/aws-budget-export-20251002.csv`).

## Verification
- `node scripts/health-check.js --api https://applications-tracker.vercel.app --supabase-url https://kswjftmtiuwplqtdwqpn.supabase.co --supabase-key <anon>` executed 2025-10-02T08:40Z; all checks passed (HTTP 200, DB latency 122ms).
- AWS billing dashboard (2025-10-02T08:45Z) shows only baseline account charges (£0.00 for Lambda/API Gateway/DynamoDB).
- CloudTrail logs confirm last API call to deleted stack at 2025-10-02T08:27Z.

## Follow-up
- Archived legacy SAM + Amplify code under `docs/archive/aws-sam/` inside repository (commit `phase-7-decommission`).
- Posted completion note in #planning-tracker with rollback reminder (rollback requires re-deploying SAM template and restoring Dynamo export).
- Migration project epic updated with links to this log, Supabase runbooks, and decommission decision record.

All Phase 7 tasks are now complete. Proceed to update documentation baselines (README, architecture) to reflect the Vercel + Supabase production stack.
