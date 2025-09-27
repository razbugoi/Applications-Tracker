import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { listApplications } from '../services/applicationService.js';
import { ApplicationStatus } from '../models/application.js';
import { handleError, jsonResponse } from './http.js';

const validStatuses: ApplicationStatus[] = ['Submitted', 'Invalidated', 'Live', 'Determined'];

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const status = event.queryStringParameters?.status as ApplicationStatus | undefined;
    if (!status || !validStatuses.includes(status)) {
      throw new Error('Query parameter "status" is required and must be one of Submitted, Invalidated, Live, Determined');
    }
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit, 10) : 25;
    const next = event.queryStringParameters?.next ? JSON.parse(Buffer.from(event.queryStringParameters.next, 'base64').toString()) : undefined;

    const result = await listApplications(status, limit, next);
    const nextToken = result.next ? Buffer.from(JSON.stringify(result.next)).toString('base64') : undefined;

    return jsonResponse(200, { items: result.items, nextToken });
  } catch (error) {
    return handleError(error);
  }
};
