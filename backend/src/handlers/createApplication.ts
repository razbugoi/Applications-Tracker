import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createApplication } from '../services/applicationService.js';
import { handleError, jsonResponse, parseBody } from './http.js';

interface CreateApplicationRequest {
  prjCodeName: string;
  ppReference: string;
  lpaReference?: string;
  description: string;
  council: string;
  submissionDate: string;
  validationDate?: string;
  caseOfficer?: string;
  caseOfficerEmail?: string;
  determinationDate?: string;
  eotDate?: string;
  planningPortalUrl?: string;
  notes?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const payload = parseBody<CreateApplicationRequest>(event.body ?? null);
    if (!payload.prjCodeName || !payload.ppReference || !payload.description || !payload.council || !payload.submissionDate) {
      throw new Error('prjCodeName, ppReference, description, council, and submissionDate are required');
    }
    const application = await createApplication(payload);
    return jsonResponse(201, application);
  } catch (error) {
    return handleError(error);
  }
};
