import type { NextFunction, Response } from "express";
import type { JwtAuthenticatedRequest } from "./jwtAuth";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";
import { ensureEnvAdminRolePersisted, isInternalAdminRole } from "../services/internalAdminService";

export type InternalAdminRequest = JwtAuthenticatedRequest & {
  internalAdmin?: {
    userId: string;
    email: string;
    role: string;
  };
};

const logDeniedAttempt = (
  request: JwtAuthenticatedRequest,
  reason: string,
  user?: { id: string; email: string | null }
): void => {
  console.warn("Denied internal admin access", {
    userId: user?.id ?? request.user?.userId ?? null,
    email: user?.email ?? request.user?.email ?? null,
    route: request.originalUrl,
    timestamp: new Date().toISOString(),
    ip: request.ip,
    reason
  });
};

export const requireInternalAdmin = async (
  request: InternalAdminRequest,
  _response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!request.user) {
      logDeniedAttempt(request, "missing_jwt");
      throw new HttpError(401, "Unauthorized");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: request.user.userId
      },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      logDeniedAttempt(request, "missing_user");
      throw new HttpError(401, "Unauthorized");
    }

    const role = await ensureEnvAdminRolePersisted(user);

    if (!isInternalAdminRole(role)) {
      logDeniedAttempt(request, "not_internal_admin", user);
      throw new HttpError(403, "Forbidden");
    }

    request.internalAdmin = {
      userId: user.id,
      email: user.email,
      role
    };

    next();
  } catch (error) {
    next(error);
  }
};
