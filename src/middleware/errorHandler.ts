import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;

  console.error(error);

  response.status(statusCode).json({
    error: {
      message: statusCode === 500 ? "Internal server error" : error.message,
      ...(env.nodeEnv === "development" ? { stack: error.stack } : {})
    }
  });
};
