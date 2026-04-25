import type { NextFunction, Request, Response } from "express";
import { isDatabaseConfigured } from "../utils/prisma";

export const requireDatabase = (_request: Request, response: Response, next: NextFunction): void => {
  if (!isDatabaseConfigured()) {
    response.status(503).json({
      status: "error",
      error: "Database is not configured"
    });
    return;
  }

  next();
};
