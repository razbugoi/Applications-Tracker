# Production Data Import Guide

This guide explains how to import data from the Excel spreadsheet to the production database.

## Overview

The production database was initially empty because data was only imported locally during development. This guide provides the tools and process to safely import the Excel data to the production AWS DynamoDB table.

## Prerequisites

1. **AWS CLI** installed and configured with appropriate permissions
2. **Node.js** and npm installed
3. **Excel file** available at `/Users/razbugoi/master-applications-tracker/ApplicationsTrackerMaster.xlsm`
4. **Cognito user** created for authentication

## Production Configuration

- **API Endpoint**: `https://hv16oj3j92.execute-api.eu-west-2.amazonaws.com/prod`
- **Region**: `eu-west-2`
- **User Pool ID**: `eu-west-2_Mp5QuBMEE`
- **Client ID**: `7p4cb8l4k8g9s2e9infoqoc6id`
- **Frontend URL**: `https://main.d254cstb1eo74n.amplifyapp.com`

## Step-by-Step Process

### Step 1: Install Dependencies

```bash
cd scripts
npm install
```

### Step 2: Create Cognito User

Create a user account for accessing the production API:

```bash
# Create a new user
npm run create:user -- --email=your@email.com --password=YourSecurePassword123!

# Or test an existing user
npm run test:user -- --email=your@email.com --password=YourSecurePassword123!
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- Special characters recommended

### Step 3: Preview Import (Dry Run)

Always run a dry run first to preview what will be imported:

```bash
npm run import:production -- --username=your@email.com --password=YourSecurePassword123! --dry-run
```

This will:
- Authenticate with Cognito
- Test API access
- Parse the Excel file
- Show a preview of the first 5 records
- Display total count and any skipped records
- **NOT make any changes** to the database

### Step 4: Execute Production Import

Once you're satisfied with the preview, run the actual import:

```bash
npm run import:production -- --username=your@email.com --password=YourSecurePassword123!
```

This will:
- Authenticate with Cognito
- Import all valid records from the Excel file
- Create applications in the production database
- Apply any status updates (for determined applications)
- Report success/failure counts

### Step 5: Verify Import

1. **Check the frontend**: Visit `https://main.d254cstb1eo74n.amplifyapp.com`
2. **Sign in** with your Cognito credentials
3. **Navigate through the different status pages**:
   - `/submitted` - Submitted applications
   - `/live` - Live applications  
   - `/determined` - Determined applications
   - `/issues` - Issues log
   - `/calendar` - Calendar view
   - `/outcomes` - Outcome summary

## Excel File Structure

The import script processes three sheets from `ApplicationsTrackerMaster.xlsm`:

### 1. SubmittedApplications Sheet
- **Status**: `Submitted`
- **Required fields**: PRJ Code and Name, PP reference, Description, Council, Submission date
- **Creates**: Basic application records

### 2. LiveApplications Sheet  
- **Status**: `Live`
- **Required fields**: Same as Submitted + Validation date
- **Creates**: Applications with validation information

### 3. DeterminedApplications Sheet
- **Status**: `Determined` 
- **Required fields**: Same as Live + Outcome, Determination date
- **Creates**: Applications with outcome information
- **Updates**: Status to 'Determined' with outcome details

## Data Mapping

| Excel Column | Database Field | Notes |
|--------------|----------------|-------|
| PRJ Code and Name | `prjCodeName` | Required |
| PP reference | `ppReference` | Required, used as unique key |
| Application ref. | `lpaReference` | Optional |
| Description of development | `description` | Required |
| Council | `council` | Required, maps to planning portal URLs |
| Submission date | `submissionDate` | Required, ISO date format |
| Validation date | `validationDate` | Required for Live/Determined |
| Case officer | `caseOfficer` | Optional |
| Determination date | `determinationDate` | Required for Determined |
| EOT | `eotDate` | Optional extension of time date |
| Outcome | `outcome` | Required for Determined applications |
| Notes | `notes` | Optional |

## Council Portal Mapping

Planning portal URLs are automatically mapped from `config/council-portals.json` based on the Council field. Currently supported councils:

- Ashford Borough Council
- Basingstoke and Deane Borough Council
- Bromley Borough
- Chichester District Council
- Crawley Borough Council
- Gravesham Borough Council
- Guildford Borough Council
- Horsham District Council
- London Borough of Hillingdon
- Mid Sussex District Council
- Mole Valley District Council
- Sevenoaks District Council
- Tandridge District Council
- Waverley Borough Council
- Wealden District Council

## Troubleshooting

### Authentication Issues

**Problem**: `401 Unauthorized` errors
**Solution**: 
1. Verify user exists: `npm run test:user -- --email=your@email.com --password=***`
2. Check AWS CLI configuration: `aws sts get-caller-identity`
3. Ensure correct region and user pool settings

### Import Failures

**Problem**: Records being skipped
**Solution**:
1. Check the dry run output for skip reasons
2. Common issues:
   - Missing required fields (PRJ Code, PP reference, Description, Council, dates)
   - Invalid date formats
   - Duplicate PP references

**Problem**: API timeout or connection errors
**Solution**:
1. Check internet connection
2. Verify API endpoint is accessible
3. Try importing in smaller batches if needed

### Data Validation

**Problem**: Data doesn't appear in frontend
**Solution**:
1. Check browser console for errors
2. Verify authentication in frontend
3. Check API responses in browser network tab
4. Confirm data was actually imported (check import script output)

## Security Considerations

1. **Never commit credentials** to version control
2. **Use strong passwords** for Cognito users
3. **Limit access** to production import scripts
4. **Run dry runs** before production imports
5. **Monitor import logs** for any issues

## Backup and Recovery

### Before Import
- The production database should be empty initially
- No backup needed for first import

### After Import
- Consider exporting data periodically
- Use AWS DynamoDB backup features for production data
- Keep the original Excel file as a reference

### Recovery Process
If import fails or data is corrupted:
1. Clear the DynamoDB table (if needed)
2. Fix any data issues in the Excel file
3. Re-run the import process

## Future Maintenance

### Adding New Data
- Update the Excel file with new applications
- Re-run the import script (it will skip duplicates based on PP reference)
- Or use the frontend interface to add individual applications

### Updating Existing Data
- Use the frontend interface for individual updates
- Or update the Excel file and re-import (existing records will be skipped)

### Council Portal Updates
- Edit `config/council-portals.json` to add/update planning portal URLs
- Re-run import to update existing applications with new portal URLs

## Script Reference

### Available Scripts

```bash
# Install dependencies
npm install

# Create Cognito user
npm run create:user -- --email=EMAIL --password=PASSWORD

# Test user login
npm run test:user -- --email=EMAIL --password=PASSWORD

# Preview production import (dry run)
npm run import:production -- --username=EMAIL --password=PASSWORD --dry-run

# Execute production import
npm run import:production -- --username=EMAIL --password=PASSWORD

# Local development (DynamoDB Local)
npm run import:applications -- --file PATH --api http://localhost:3001 --dry-run
```

### Direct Script Usage

```bash
# User management
node create-user.js --email=your@email.com --password=SecurePass123!
node create-user.js --email=your@email.com --test-only

# Production import
node production-import.js --username=your@email.com --password=SecurePass123! --dry-run
node production-import.js --username=your@email.com --password=SecurePass123!

# Local import (existing functionality)
node import-applications.js --file /path/to/file.xlsm --api http://localhost:3001 --dry-run
```

## Support

If you encounter issues:

1. **Check the logs** - All scripts provide detailed output
2. **Run dry runs** - Always preview before making changes  
3. **Verify prerequisites** - AWS CLI, Node.js, file paths
4. **Test authentication** - Use the user test script
5. **Check AWS permissions** - Ensure Cognito and API access

For additional help, refer to:
- `README.md` - General project setup
- `docs/architecture.md` - System architecture
- `docs/data-model.md` - Database schema
- AWS Cognito documentation
- AWS DynamoDB documentation