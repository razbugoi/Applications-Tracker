#!/usr/bin/env node
'use strict';

/**
 * Cognito User Creation Script
 * 
 * Creates a new user in the Cognito User Pool for production access.
 * This is needed before running the production import script.
 */

const { execSync } = require('child_process');

const PRODUCTION_CONFIG = {
  region: 'eu-west-2',
  userPoolId: 'eu-west-2_Mp5QuBMEE',
  clientId: '7p4cb8l4k8g9s2e9infoqoc6id'
};

async function createUser(email, password, confirmUser = true) {
  console.log(`Creating user: ${email}`);
  
  try {
    // Step 1: Sign up the user
    console.log('📝 Signing up user...');
    const signUpCommand = `aws cognito-idp sign-up \
      --region ${PRODUCTION_CONFIG.region} \
      --client-id ${PRODUCTION_CONFIG.clientId} \
      --username "${email}" \
      --password "${password}" \
      --user-attributes Name=email,Value="${email}" \
      --output json`;
    
    const signUpResult = execSync(signUpCommand, { encoding: 'utf8' });
    const signUpData = JSON.parse(signUpResult);
    
    console.log('✅ User signed up successfully');
    console.log(`User Sub: ${signUpData.UserSub}`);
    
    if (confirmUser) {
      // Step 2: Admin confirm the user (skip email verification)
      console.log('✅ Confirming user (admin)...');
      const confirmCommand = `aws cognito-idp admin-confirm-sign-up \
        --region ${PRODUCTION_CONFIG.region} \
        --user-pool-id ${PRODUCTION_CONFIG.userPoolId} \
        --username "${email}"`;
      
      execSync(confirmCommand, { encoding: 'utf8' });
      console.log('✅ User confirmed successfully');
      
      // Step 3: Set permanent password
      console.log('🔐 Setting permanent password...');
      const setPasswordCommand = `aws cognito-idp admin-set-user-password \
        --region ${PRODUCTION_CONFIG.region} \
        --user-pool-id ${PRODUCTION_CONFIG.userPoolId} \
        --username "${email}" \
        --password "${password}" \
        --permanent`;
      
      execSync(setPasswordCommand, { encoding: 'utf8' });
      console.log('✅ Password set as permanent');
    }
    
    return {
      userSub: signUpData.UserSub,
      email: email,
      confirmed: confirmUser
    };
    
  } catch (error) {
    if (error.message.includes('UsernameExistsException')) {
      console.log('ℹ️  User already exists');
      return { email: email, exists: true };
    } else {
      console.error('❌ User creation failed:', error.message);
      throw error;
    }
  }
}

async function testUserLogin(email, password) {
  console.log(`Testing login for: ${email}`);
  
  try {
    const loginCommand = `aws cognito-idp initiate-auth \
      --region ${PRODUCTION_CONFIG.region} \
      --client-id ${PRODUCTION_CONFIG.clientId} \
      --auth-flow USER_PASSWORD_AUTH \
      --auth-parameters USERNAME="${email}",PASSWORD="${password}" \
      --output json`;
    
    const result = execSync(loginCommand, { encoding: 'utf8' });
    const authResult = JSON.parse(result);
    
    if (authResult.AuthenticationResult && authResult.AuthenticationResult.AccessToken) {
      console.log('✅ Login test successful');
      return true;
    } else {
      console.log('❌ Login test failed - no access token');
      return false;
    }
  } catch (error) {
    console.error('❌ Login test failed:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find(arg => arg.startsWith('--email='));
  const passwordArg = args.find(arg => arg.startsWith('--password='));
  const testOnly = args.includes('--test-only');
  
  if (!emailArg || (!passwordArg && !testOnly)) {
    console.error('Usage: node create-user.js --email=your@email.com --password=YourPassword123!');
    console.error('   or: node create-user.js --email=your@email.com --test-only');
    console.error('');
    console.error('Options:');
    console.error('  --email=EMAIL       Email address for the new user');
    console.error('  --password=PASS     Password for the new user (min 8 chars, uppercase, lowercase, number)');
    console.error('  --test-only         Only test login, don\'t create user');
    process.exit(1);
  }
  
  const email = emailArg.split('=')[1];
  const password = passwordArg ? passwordArg.split('=')[1] : null;
  
  try {
    console.log('🚀 Cognito User Management');
    console.log(`📧 Email: ${email}`);
    console.log(`🌐 Region: ${PRODUCTION_CONFIG.region}`);
    console.log(`🏊 User Pool: ${PRODUCTION_CONFIG.userPoolId}`);
    console.log('');
    
    if (testOnly) {
      if (!password) {
        console.error('❌ Password required for login test');
        process.exit(1);
      }
      
      const loginSuccess = await testUserLogin(email, password);
      if (loginSuccess) {
        console.log('');
        console.log('🎉 User login test successful!');
        console.log('You can now run the production import script.');
      } else {
        console.log('');
        console.log('❌ User login test failed.');
        console.log('Please check your credentials or create the user first.');
      }
    } else {
      const result = await createUser(email, password);
      
      if (result.exists) {
        console.log('');
        console.log('ℹ️  User already exists. Testing login...');
        const loginSuccess = await testUserLogin(email, password);
        if (loginSuccess) {
          console.log('✅ Existing user login successful!');
        } else {
          console.log('❌ Existing user login failed. Password may be incorrect.');
        }
      } else {
        console.log('');
        console.log('🎉 User created and configured successfully!');
        console.log('');
        console.log('Next steps:');
        console.log(`1. Test login: node create-user.js --email=${email} --password=*** --test-only`);
        console.log(`2. Import data: node production-import.js --username=${email} --password=*** --dry-run`);
      }
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Operation failed:', error.message);
    console.error('');
    console.error('Make sure you have:');
    console.error('1. AWS CLI installed and configured');
    console.error('2. Permissions to manage Cognito users');
    console.error('3. Correct region and user pool configuration');
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createUser, testUserLogin, PRODUCTION_CONFIG };