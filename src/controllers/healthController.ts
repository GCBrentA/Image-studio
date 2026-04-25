import type { Request, Response } from "express";
import { getHealthStatus } from "../services/healthService";

export const healthCheck = (_request: Request, response: Response): void => {
  response.status(200).json(getHealthStatus());
};
