import type { Response } from "express";
import type { JwtAuthenticatedRequest } from "../middleware/jwtAuth";
import { getDashboardSummary } from "../services/dashboardService";

export const getDashboard = async (
  request: JwtAuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.user) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  response.status(200).json(await getDashboardSummary(request.user.userId));
};
