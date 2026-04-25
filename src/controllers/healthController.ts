import type { Request, Response } from "express";
import { getHealthStatus } from "../services/healthService";

export const healthCheck = async (_request: Request, response: Response): Promise<void> => {
  response.status(200).json(await getHealthStatus());
};
