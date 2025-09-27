import { patchApplication } from '../services/applicationService.js';
import { handleError, jsonResponse, parseBody } from './http.js';
export const handler = async (event) => {
    try {
        const applicationId = event.pathParameters?.id;
        if (!applicationId) {
            throw new Error('Application id not provided');
        }
        const payload = parseBody(event.body ?? null);
        await patchApplication(applicationId, payload);
        return jsonResponse(204, {});
    }
    catch (error) {
        return handleError(error);
    }
};
//# sourceMappingURL=updateApplication.js.map