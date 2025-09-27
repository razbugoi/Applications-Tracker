# AWS Decommission Runbook

Use this guide to execute Phase 7 of the Vercel + Supabase migration once monitoring and DNS cutover are signed off.

## 1. Preconditions
1. Monitoring window (48h) after Phase 6 cutover has completed with no Sev-1 incidents.
2. Data owner confirms the 12 previously skipped spreadsheet rows are migrated.
3. Supabase dashboards show healthy metrics and Vercel deploy is marked Production Ready.
4. Change request for AWS decommission approved by service owner (record decision in `docs/migration-decisions/`).
5. AWS CLI configured with credentials that can delete the legacy stack (prefer `AdministratorAccess` scoped to the former application account).

## 2. Freeze Safeguards
1. Take final DynamoDB export for archive:
   ```bash
   aws dynamodb scan \
     --table-name PlanningApplications \
     --region eu-west-2 \
     --output json > supabase/exports/final-dynamodb-export-$(date -u +%Y%m%dT%H%M%SZ).json
   ```
2. Confirm Cognito sign-in disabled by removing the hosted UI domain and user pool app client.
3. Stop any EventBridge schedules targeting Phase 6 Lambdas (should already be disabled from cutover).

## 3. Resource Deletion Sequence
1. **Amplify Hosting**
   ```bash
   aws amplify delete-app --app-id <AMPLIFY_APP_ID>
   ```
   - Ensure DNS records now point to Vercel before deletion.
2. **AWS SAM Stack (API + Lambdas + DynamoDB)**
   ```bash
   aws cloudformation delete-stack --stack-name planning-tracker
   aws cloudformation wait stack-delete-complete --stack-name planning-tracker
   ```
3. **Cognito**
   ```bash
   aws cognito-idp delete-user-pool --user-pool-id <USER_POOL_ID>
   aws cognito-identity delete-identity-pool --identity-pool-id <IDENTITY_POOL_ID>
   ```
4. **IAM Roles/Policies**
   - Detach inline policies from `PlanningTrackerLambdaRole` and delete the role.
   - Remove service-linked roles created by Amplify if no other apps rely on them.
5. **S3 Buckets** (if used for document uploads)
   ```bash
   aws s3 rm s3://planning-tracker-documents --recursive
   aws s3 rb s3://planning-tracker-documents
   ```
6. **Budgets & CloudWatch Alarms** – Delete or archive any dedicated billing alerts configured for the legacy stack.

## 4. Verification
1. Re-run health check targeting Supabase + Vercel to confirm production path remains healthy:
   ```bash
   cd scripts
   node health-check.js --api https://applications-tracker.vercel.app --supabase-url $NEXT_PUBLIC_SUPABASE_URL --supabase-key $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
2. Confirm no AWS CloudWatch logs or Lambda invocations occur after deletion (check AWS usage reports the next day).
3. Verify IAM credential report shows no active users limited to the legacy stack.
4. Update `docs/vercel-supabase-migration-plan.md` Phase 7 checklist with execution timestamp.

## 5. Post-Decommission
1. Move SAM/Amplify infrastructure code into `docs/archive/aws-sam/` (completed in repo before deleting cloud resources).
2. Commit runbook evidence logs under `docs/runbooks/archives/`.
3. Notify stakeholders in #planning-tracker that AWS stack has been retired and reference rollback instructions (DNS flip + DynamoDB export) if rollback ever needed.
4. Close out the migration project ticket / epic with links to the decision record and archive artifacts.

Maintain CLI transcripts (e.g., `aws cloudformation delete-stack ...`) in the archive file for audit readiness.
