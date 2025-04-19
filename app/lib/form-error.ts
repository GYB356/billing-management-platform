import { ZodError } from 'zod';

export interface FormError {
  message: string;
  field?: string;
}

export function handleFormError(error: unknown): FormError {
  if (error instanceof ZodError) {
    const firstError = error.errors[0];
    return {
      message: firstError.message,
      field: firstError.path.join('.'),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: 'An unexpected error occurred',
  };
}

export function mapZodErrorToFormErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return errors;
}

export function formatValidationErrors(errors: Record<string, string>): string {
  return Object.values(errors).join('\n');
} 