import type { NextFunction, Request, Response } from "express";

export const notFound = (request: Request, response: Response, _next: NextFunction): void => {
  response.status(404).json({
    error: {
      message: `Route not found: ${request.method} ${request.originalUrl}`
    }
  });
};
