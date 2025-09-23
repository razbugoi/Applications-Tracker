#!/usr/bin/env node
'use strict';

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const tableName = process.env.TABLE_NAME_OVERRIDE || process.argv[2] || 'app-tracker-applications';
const endpoint = process.env.AWS_ENDPOINT_URL_DYNAMODB || 'http://localhost:8000';
const region = process.env.AWS_REGION || 'eu-west-2';

const client = new DynamoDBClient({
  endpoint,
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
  },
});

(async () => {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table '${tableName}' already exists at ${endpoint}`);
    return;
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') {
      console.error('Failed to describe table:', error);
      process.exit(1);
    }
  }

  const command = new CreateTableCommand({
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
      { AttributeName: 'GSI2PK', AttributeType: 'S' },
      { AttributeName: 'GSI2SK', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GSI2',
        KeySchema: [
          { AttributeName: 'GSI2PK', KeyType: 'HASH' },
          { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });

  await client.send(command);
  console.log(`Created table '${tableName}' at ${endpoint}`);
})();
