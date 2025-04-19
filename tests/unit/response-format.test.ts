import { createSuccessResponse, createErrorResponse } from '@/lib/utils/response-format';
import { describe, expect, it } from 'vitest';

describe('Response Format', () => {
  it('should return a success response', () => {
    const data = { message: 'Success!' };
    const response = createSuccessResponse(data);

    expect(response.status).toBe('success');
    expect(response.data).toEqual(data);
  });

  it('should return an error response', () => {
    const error = 'An error occurred';
    const response = createErrorResponse(error);

    expect(response.status).toBe('error');
    expect(response.error).toBe(error);
  });
});