import { createIssue } from '../services/applicationService.js';
import { handleError, jsonResponse, parseBody } from './http.js';
export const handler = async (event) => {
    try {
        const applicationId = event.pathParameters?.id;
        if (!applicationId) {
            throw new Error('Application id not provided');
        }
        const payload = parseBody(event.body ?? null);
        if (!payload.ppReference || !payload.title || !payload.category || !payload.description || !payload.dateRaised) {
            throw new Error('ppReference, title, category, description, and dateRaised are required');
        }
        const issue = await createIssue({
            applicationId,
            ...payload,
        });
        return jsonResponse(201, issue);
    }
    catch (error) {
        return handleError(error);
    }
};
//# sourceMappingURL=createIssue.js.map