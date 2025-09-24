#!/usr/bin/env node
'use strict';

/**
 * Production Data Export Script
 * 
 * Exports data from the production API to JSON files for backup purposes.
 * This provides a safety net and allows for data recovery if needed.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PRODUCTION_CONFIG = {
  apiBase: 'https://hv16oj3j92.execute-api.eu-west-2.amazonaws.com/prod',
  region: 'eu-west-2',
  userPoolId: 'eu-west-2_Mp5QuBMEE',
  clientId: '7p4cb8l4k8g9s2e9infoqoc6id'
};

async function getAuthToken(username, password) {
  console.log('Authenticating with Cognito...');
  
  try {
    const command = `aws cognito-idp initiate-auth \
      --region ${PRODUCTION_CONFIG.region} \
      --client-id ${PRODUCTION_CONFIG.clientId} \
      --auth-flow USER_PASSWORD_AUTH \
      --auth-parameters USERNAME=${username},PASSWORD=${password} \
      --output json`;
    
    const result = execSync(command, { encoding: 'utf8' });
    const authResult = JSON.parse(result);
    
    if (authResult.AuthenticationResult && authResult.AuthenticationResult.AccessToken) {
      console.log('✅ Authentication successful');
      return authResult.AuthenticationResult.AccessToken;
    } else {
      throw new Error('No access token in response');
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

async function fetchApplicationsByStatus(token, status) {
  console.log(`📥 Fetching ${status} applications...`);
  
  try {
    const response = await fetch(`${PRODUCTION_CONFIG.apiBase}/applications?status=${status}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Found ${data.items ? data.items.length : 0} ${status} applications`);
    return data.items || [];
  } catch (error) {
    console.error(`❌ Failed to fetch ${status} applications:`, error.message);
    return [];
  }
}

async function fetchAllIssues(token) {
  console.log('📥 Fetching all issues...');
  
  try {
    const response = await fetch(`${PRODUCTION_CONFIG.apiBase}/issues`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const issues = await response.json();
    console.log(`✅ Found ${issues.length} issues`);
    return issues;
  } catch (error) {
    console.error('❌ Failed to fetch issues:', error.message);
    return [];
  }
}

async function exportAllData(token, outputDir) {
  console.log(`📁 Exporting data to: ${outputDir}`);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportData = {
    exportDate: new Date().toISOString(),
    timestamp: timestamp,
    applications: {},
    issues: [],
    summary: {}
  };
  
  // Fetch applications by status
  const statuses = ['Submitted', 'Live', 'Determined', 'Invalidated'];
  let totalApplications = 0;
  
  for (const status of statuses) {
    const applications = await fetchApplicationsByStatus(token, status);
    exportData.applications[status] = applications;
    totalApplications += applications.length;
  }
  
  // Fetch all issues
  exportData.issues = await fetchAllIssues(token);
  
  // Create summary
  exportData.summary = {
    totalApplications,
    applicationsByStatus: Object.fromEntries(
      Object.entries(exportData.applications).map(([status, apps]) => [status, apps.length])
    ),
    totalIssues: exportData.issues.length,
    exportedAt: new Date().toISOString()
  };
  
  // Write main export file
  const mainExportFile = path.join(outputDir, `production-export-${timestamp}.json`);
  fs.writeFileSync(mainExportFile, JSON.stringify(exportData, null, 2));
  console.log(`✅ Main export saved: ${mainExportFile}`);
  
  // Write individual status files
  for (const [status, applications] of Object.entries(exportData.applications)) {
    if (applications.length > 0) {
      const statusFile = path.join(outputDir, `${status.toLowerCase()}-applications-${timestamp}.json`);
      fs.writeFileSync(statusFile, JSON.stringify(applications, null, 2));
      console.log(`✅ ${status} applications saved: ${statusFile}`);
    }
  }
  
  // Write issues file
  if (exportData.issues.length > 0) {
    const issuesFile = path.join(outputDir, `issues-${timestamp}.json`);
    fs.writeFileSync(issuesFile, JSON.stringify(exportData.issues, null, 2));
    console.log(`✅ Issues saved: ${issuesFile}`);
  }
  
  // Write summary file
  const summaryFile = path.join(outputDir, `export-summary-${timestamp}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(exportData.summary, null, 2));
  console.log(`✅ Summary saved: ${summaryFile}`);
  
  // Write latest symlinks (for easy access to most recent export)
  try {
    const latestExportLink = path.join(outputDir, 'latest-export.json');
    const latestSummaryLink = path.join(outputDir, 'latest-summary.json');
    
    if (fs.existsSync(latestExportLink)) fs.unlinkSync(latestExportLink);
    if (fs.existsSync(latestSummaryLink)) fs.unlinkSync(latestSummaryLink);
    
    fs.symlinkSync(path.basename(mainExportFile), latestExportLink);
    fs.symlinkSync(path.basename(summaryFile), latestSummaryLink);
    
    console.log('✅ Latest export symlinks created');
  } catch (error) {
    console.warn('⚠️  Could not create symlinks:', error.message);
  }
  
  return {
    exportData,
    files: {
      main: mainExportFile,
      summary: summaryFile,
      applications: Object.fromEntries(
        Object.entries(exportData.applications)
          .filter(([, apps]) => apps.length > 0)
          .map(([status]) => [status, path.join(outputDir, `${status.toLowerCase()}-applications-${timestamp}.json`)])
      ),
      issues: exportData.issues.length > 0 ? path.join(outputDir, `issues-${timestamp}.json`) : null
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const usernameArg = args.find(arg => arg.startsWith('--username='));
  const passwordArg = args.find(arg => arg.startsWith('--password='));
  const outputArg = args.find(arg => arg.startsWith('--output='));
  
  if (!usernameArg || !passwordArg) {
    console.error('Usage: node export-data.js --username=your@email.com --password=YourPassword [--output=./exports]');
    console.error('');
    console.error('Options:');
    console.error('  --username=EMAIL    Your Cognito username (email)');
    console.error('  --password=PASS     Your Cognito password');
    console.error('  --output=DIR        Output directory for export files (default: ./exports)');
    process.exit(1);
  }
  
  const username = usernameArg.split('=')[1];
  const password = passwordArg.split('=')[1];
  const outputDir = outputArg ? outputArg.split('=')[1] : './exports';
  
  try {
    console.log('🚀 Starting production data export...');
    console.log(`🌐 API endpoint: ${PRODUCTION_CONFIG.apiBase}`);
    console.log(`📁 Output directory: ${path.resolve(outputDir)}`);
    console.log('');
    
    // Step 1: Authenticate
    const token = await getAuthToken(username, password);
    
    // Step 2: Export all data
    const result = await exportAllData(token, outputDir);
    
    console.log('');
    console.log('🎉 Export completed successfully!');
    console.log('');
    console.log('📊 Export Summary:');
    console.log(`   Total Applications: ${result.exportData.summary.totalApplications}`);
    Object.entries(result.exportData.summary.applicationsByStatus).forEach(([status, count]) => {
      if (count > 0) {
        console.log(`   - ${status}: ${count}`);
      }
    });
    console.log(`   Total Issues: ${result.exportData.summary.totalIssues}`);
    console.log('');
    console.log('📁 Files Created:');
    console.log(`   Main Export: ${result.files.main}`);
    console.log(`   Summary: ${result.files.summary}`);
    Object.entries(result.files.applications).forEach(([status, file]) => {
      console.log(`   ${status}: ${file}`);
    });
    if (result.files.issues) {
      console.log(`   Issues: ${result.files.issues}`);
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getAuthToken, fetchApplicationsByStatus, fetchAllIssues, exportAllData, PRODUCTION_CONFIG };