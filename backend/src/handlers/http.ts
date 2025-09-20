import type { APIGatewayProxyResult } from 'aws-lambda';

export function jsonResponse(statusCode: number, payload: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

export function parseBody<T>(body: string | null): T {
  if (!body) {
    throw new Error('Request body is required');
  }
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
}

export function handleError(error: unknown): APIGatewayProxyResult {
  if (error instanceof Error) {
    const status = error.message.includes('not found') ? 404 : 400;
    return jsonResponse(status, { message: error.message });
  }
  return jsonResponse(500, { message: 'Unexpected error' });
}
