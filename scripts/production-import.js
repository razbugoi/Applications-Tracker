#!/usr/bin/env node
'use strict';

/**
 * Production Data Import Script
 * 
 * This script imports data from the Excel spreadsheet to the production API.
 * It handles Cognito authentication and safely imports data to the deployed backend.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PRODUCTION_CONFIG = {
  apiBase: 'https://hv16oj3j92.execute-api.eu-west-2.amazonaws.com/prod',
  region: 'eu-west-2',
  userPoolId: 'eu-west-2_Mp5QuBMEE',
  clientId: '7p4cb8l4k8g9s2e9infoqoc6id',
  excelFile: '/Users/razbugoi/master-applications-tracker/ApplicationsTrackerMaster.xlsm'
};

async function getAuthToken(username, password) {
  console.log('Authenticating with Cognito...');
  
  try {
    // Use AWS CLI to authenticate and get JWT token
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

async function testApiAccess(token) {
  console.log('Testing API access...');
  
  try {
    const response = await fetch(`${PRODUCTION_CONFIG.apiBase}/health`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✅ API access confirmed');
      return true;
    } else {
      console.error('❌ API access failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    return false;
  }
}

async function importData(token, dryRun = true) {
  console.log(`${dryRun ? '🔍 DRY RUN:' : '📥 IMPORTING:'} Processing Excel data...`);
  
  // Check if Excel file exists
  if (!fs.existsSync(PRODUCTION_CONFIG.excelFile)) {
    throw new Error(`Excel file not found: ${PRODUCTION_CONFIG.excelFile}`);
  }
  
  // Build the import command
  const importArgs = [
    '--file', PRODUCTION_CONFIG.excelFile,
    '--api', PRODUCTION_CONFIG.apiBase,
    '--token', token
  ];
  
  if (dryRun) {
    importArgs.push('--dry-run');
  }
  
  // Execute the import
  try {
    const importProcess = require('child_process').spawn('node', [
      path.join(__dirname, 'import-applications.js'),
      ...importArgs
    ], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    return new Promise((resolve, reject) => {
      importProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Import ${dryRun ? 'preview' : 'completed'} successfully`);
          resolve();
        } else {
          reject(new Error(`Import process exited with code ${code}`));
        }
      });
      
      importProcess.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error(`❌ Import ${dryRun ? 'preview' : ''} failed:`, error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const usernameArg = args.find(arg => arg.startsWith('--username='));
  const passwordArg = args.find(arg => arg.startsWith('--password='));
  
  if (!usernameArg || !passwordArg) {
    console.error('Usage: node production-import.js --username=your@email.com --password=YourPassword [--dry-run]');
    console.error('');
    console.error('Options:');
    console.error('  --username=EMAIL    Your Cognito username (email)');
    console.error('  --password=PASS     Your Cognito password');
    console.error('  --dry-run          Preview import without making changes');
    process.exit(1);
  }
  
  const username = usernameArg.split('=')[1];
  const password = passwordArg.split('=')[1];
  
  try {
    console.log('🚀 Starting production data import...');
    console.log(`📊 Excel file: ${PRODUCTION_CONFIG.excelFile}`);
    console.log(`🌐 API endpoint: ${PRODUCTION_CONFIG.apiBase}`);
    console.log(`${dryRun ? '🔍 Mode: DRY RUN (preview only)' : '📥 Mode: LIVE IMPORT'}`);
    console.log('');
    
    // Step 1: Authenticate
    const token = await getAuthToken(username, password);
    
    // Step 2: Test API access
    const apiAccessible = await testApiAccess(token);
    if (!apiAccessible) {
      throw new Error('API is not accessible with the provided credentials');
    }
    
    // Step 3: Import data
    await importData(token, dryRun);
    
    console.log('');
    console.log('🎉 Production import process completed successfully!');
    
    if (dryRun) {
      console.log('');
      console.log('To perform the actual import, run:');
      console.log(`node production-import.js --username=${username} --password=*** (without --dry-run)`);
    } else {
      console.log('');
      console.log('✅ Data has been imported to production database');
      console.log('🌐 Check your application at: https://main.d254cstb1eo74n.amplifyapp.com');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Production import failed:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getAuthToken, testApiAccess, importData, PRODUCTION_CONFIG };