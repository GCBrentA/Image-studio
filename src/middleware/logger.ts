import type { NextFunction, Request, Response } from "express";

export const logger = (request: Request, response: Response, next: NextFunction): void => {
  const startedAt = Date.now();

  response.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const log = {
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs,
      ip: request.ip
    };

    console.info(JSON.stringify(log));
  });

  next();
};
