import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createExtensionOfTime } from '../services/applicationService.js';
import { handleError, jsonResponse, parseBody } from './http.js';

interface CreateExtensionRequest {
  agreedDate: string;
  requestedDate?: string;
  notes?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const applicationId = event.pathParameters?.id;
    if (!applicationId) {
      throw new Error('Application id not provided');
    }

    const payload = parseBody<CreateExtensionRequest>(event.body ?? null);
    if (!payload.agreedDate) {
      throw new Error('agreedDate is required');
    }

    await createExtensionOfTime(applicationId, payload);
    return jsonResponse(201, { message: 'Extension recorded' });
  } catch (error) {
    return handleError(error);
  }
};
