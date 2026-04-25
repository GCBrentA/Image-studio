import type { NextFunction, Request, Response } from "express";
import { verifyJwt } from "../utils/jwt";

export type JwtAuthContext = {
  userId: string;
  email: string;
};

export type JwtAuthenticatedRequest = Request & {
  user?: JwtAuthContext;
};

const getBearerToken = (request: Request): string | null => {
  const authorization = request.header("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return null;
};

export const jwtAuth = (
  request: JwtAuthenticatedRequest,
  response: Response,
  next: NextFunction
): void => {
  try {
    const token = getBearerToken(request);

    if (!token) {
      response.status(401).json({
        error: "Missing auth token"
      });
      return;
    }

    const payload = verifyJwt(token);
    request.user = {
      userId: payload.sub,
      email: payload.email
    };

    next();
  } catch (error) {
    next(error);
  }
};
