

import { NextResponse } from 'next/server';

interface ErrorResponse {
  error: {
    message: string;
    code?: string;
  };
}

function createErrorResponse(message: string, code?: string): ErrorResponse {
  return { error: { message, code } };
}

function handleApiError(error: any): NextResponse {
  console.error('API Error:', error);
    return NextResponse.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
}
function createErrorResponse(message: string, status: number): NextResponse {
    return NextResponse.json({ error: { message } }, { status });
}
  
export { createErrorResponse, handleApiError };

  return NextResponse.json(createErrorResponse(message, code), { status });
}

export { createErrorResponse, handleApiError };