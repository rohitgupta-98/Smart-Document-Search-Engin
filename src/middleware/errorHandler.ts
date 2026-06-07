// ============================================================
// ERROR HANDLER MIDDLEWARE - src/middleware/errorHandler.ts
//
// In Express, an error-handling middleware has EXACTLY 4 params:
//   (err, req, res, next)
// Express identifies it as error handler by the 4th param.
// Any route that throws or calls next(error) reaches here.
//
// WHY CENTRALIZE ERROR HANDLING?
// Avoids repeating try/catch in every route. One place to:
//   - Format error responses consistently
//   - Log errors
//   - Hide sensitive details in production
// ============================================================

import { Request, Response, NextFunction } from 'express';

// Custom error class with an HTTP status code
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    // Required fix for TypeScript classes extending built-ins
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Global error handler — catches ALL unhandled errors in routes
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction // Must include even if unused (Express requirement)
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal server error';

  // Log the error server-side
  console.error(`❌ Error [${statusCode}]:`, message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack); // Full stack trace in development only
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Show stack trace in development, hide in production (security!)
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// 404 handler — for routes that don't exist at all
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};
