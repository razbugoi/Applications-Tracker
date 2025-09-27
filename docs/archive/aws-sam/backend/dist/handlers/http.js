export function jsonResponse(statusCode, payload) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    };
}
export function parseBody(body) {
    if (!body) {
        throw new Error('Request body is required');
    }
    try {
        return JSON.parse(body);
    }
    catch (error) {
        throw new Error('Invalid JSON payload');
    }
}
export function handleError(error) {
    if (error instanceof Error) {
        const status = error.message.includes('not found') ? 404 : 400;
        return jsonResponse(status, { message: error.message });
    }
    return jsonResponse(500, { message: 'Unexpected error' });
}
//# sourceMappingURL=http.js.map