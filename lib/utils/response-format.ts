export function createSuccessResponse(data: any) {
  return {
    success: true,
    data: data,
  };
}

export function createErrorResponse(error: any) {
  return {
    success: false,
    error: error,
  };
}