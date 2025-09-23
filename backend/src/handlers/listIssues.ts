import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { listIssues } from '../services/applicationService.js';
import type { Issue } from '../models/application.js';
import { handleError, jsonResponse } from './http.js';

const issueStatuses: Issue['status'][] = ['Open', 'In Progress', 'Resolved', 'Closed'];

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const statusParam = event.queryStringParameters?.status;
    let status: Issue['status'] | undefined;

    if (statusParam) {
      if (!issueStatuses.includes(statusParam as Issue['status'])) {
        throw new Error('Invalid status. Must be one of Open, In Progress, Resolved, Closed.');
      }
      status = statusParam as Issue['status'];
    }

    const issues = await listIssues(status);
    return jsonResponse(200, { items: issues });
  } catch (error) {
    return handleError(error);
  }
};
