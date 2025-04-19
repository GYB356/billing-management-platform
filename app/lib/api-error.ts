import { ApiError } from '@/types/api';

export class APIError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = status;
  }

  static fromResponse(error: ApiError): APIError {
    return new APIError(error.message, error.code, error.status);
  }
}

export function handleAPIError(error: unknown): APIError {
  if (error instanceof APIError) {
    return error;
  }

  if (error instanceof Response) {
    return new APIError(
      'An unexpected error occurred',
      'UNKNOWN_ERROR',
      error.status
    );
  }

  if (error instanceof Error) {
    return new APIError(error.message, 'UNKNOWN_ERROR', 500);
  }

  return new APIError(
    'An unexpected error occurred',
    'UNKNOWN_ERROR',
    500
  );
}

export async function fetchWithError(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let error: ApiError;
    try {
      error = await response.json();
    } catch {
      throw new APIError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR',
        response.status
      );
    }
    throw APIError.fromResponse(error);
  }

  return response;
} 