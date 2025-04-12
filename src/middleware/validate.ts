import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from './errorHandler';

export const validate = (schema: AnyZodObject) => async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = new Error('Validation failed') as AppError;
      validationError.statusCode = 400;
      validationError.code = 'VALIDATION_ERROR';
      validationError.message = error.errors.map(e => e.message).join(', ');
      return next(validationError);
    }
    return next(error);
  }
}; 