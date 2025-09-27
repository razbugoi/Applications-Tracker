import { createApplication } from '../services/applicationService.js';
import { handleError, jsonResponse, parseBody } from './http.js';
export const handler = async (event) => {
    try {
        const payload = parseBody(event.body ?? null);
        if (!payload.prjCodeName || !payload.ppReference || !payload.description || !payload.council || !payload.submissionDate) {
            throw new Error('prjCodeName, ppReference, description, council, and submissionDate are required');
        }
        const application = await createApplication(payload);
        return jsonResponse(201, application);
    }
    catch (error) {
        return handleError(error);
    }
};
//# sourceMappingURL=createApplication.js.map