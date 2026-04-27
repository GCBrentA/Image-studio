import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/apiTokenAuth";
import { getUsageForUser } from "../services/usageService";

export const getUsage = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.auth) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  response.status(200).json({
    ...(await getUsageForUser(request.auth.userId)),
    domain: request.auth.domain,
    canonical_domain: request.auth.canonicalDomain,
    claim_status: request.auth.claimStatus,
    free_credit_message: request.auth.freeCreditMessage
  });
};
