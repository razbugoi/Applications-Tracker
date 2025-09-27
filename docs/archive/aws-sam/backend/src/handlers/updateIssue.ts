import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { updateIssue } from '../services/applicationService.js';
import { handleError, jsonResponse, parseBody } from './http.js';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const applicationId = event.pathParameters?.id;
    const issueId = event.pathParameters?.issueId;
    if (!applicationId || !issueId) {
      throw new Error('Application id and issue id are required');
    }
    const payload = parseBody<Record<string, unknown>>(event.body ?? null);
    await updateIssue({
      applicationId,
      issueId,
      updates: payload,
    });
    return jsonResponse(204, {});
  } catch (error) {
    return handleError(error);
  }
};
