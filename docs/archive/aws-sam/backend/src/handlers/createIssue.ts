import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createIssue } from '../services/applicationService.js';
import { handleError, jsonResponse, parseBody } from './http.js';

interface CreateIssueRequest {
  ppReference: string;
  lpaReference?: string;
  title: string;
  category: string;
  description: string;
  raisedBy?: string;
  dateRaised: string;
  assignedTo?: string;
  status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  dueDate?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const applicationId = event.pathParameters?.id;
    if (!applicationId) {
      throw new Error('Application id not provided');
    }
    const payload = parseBody<CreateIssueRequest>(event.body ?? null);
    if (!payload.ppReference || !payload.title || !payload.category || !payload.description || !payload.dateRaised) {
      throw new Error('ppReference, title, category, description, and dateRaised are required');
    }
    const issue = await createIssue({
      applicationId,
      ...payload,
    });
    return jsonResponse(201, issue);
  } catch (error) {
    return handleError(error);
  }
};
