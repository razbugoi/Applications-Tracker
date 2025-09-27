import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { patchApplication } from '../services/applicationService.js';
import { handleError, jsonResponse, parseBody } from './http.js';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const applicationId = event.pathParameters?.id;
    if (!applicationId) {
      throw new Error('Application id not provided');
    }
    const payload = parseBody<Record<string, unknown>>(event.body ?? null);
    await patchApplication(applicationId, payload);
    return jsonResponse(204, {});
  } catch (error) {
    return handleError(error);
  }
};
