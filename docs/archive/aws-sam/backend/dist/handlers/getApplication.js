import { getApplication } from '../services/applicationService.js';
import { handleError, jsonResponse } from './http.js';
export const handler = async (event) => {
    try {
        const applicationId = event.pathParameters?.id;
        if (!applicationId) {
            throw new Error('Application id not provided');
        }
        const aggregate = await getApplication(applicationId);
        if (!aggregate) {
            return jsonResponse(404, { message: 'Application not found' });
        }
        return jsonResponse(200, aggregate);
    }
    catch (error) {
        return handleError(error);
    }
};
//# sourceMappingURL=getApplication.js.map