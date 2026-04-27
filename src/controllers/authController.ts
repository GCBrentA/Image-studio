import type { Request, Response } from "express";
import type { JwtAuthenticatedRequest } from "../middleware/jwtAuth";
import { getCurrentUser, loginUser, registerUser } from "../services/authService";

type AuthBody = {
  email?: unknown;
  password?: unknown;
};

const getAuthBody = (request: Request): { email: string; password: string } => {
  const body = request.body as AuthBody;

  return {
    email: typeof body.email === "string" ? body.email : "",
    password: typeof body.password === "string" ? body.password : ""
  };
};

export const register = async (request: Request, response: Response): Promise<void> => {
  const { email, password } = getAuthBody(request);
  response.status(201).json(await registerUser(email, password));
};

export const login = async (request: Request, response: Response): Promise<void> => {
  const { email, password } = getAuthBody(request);
  response.status(200).json(await loginUser(email, password));
};

export const me = async (request: JwtAuthenticatedRequest, response: Response): Promise<void> => {
  if (!request.user) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  response.status(200).json({
    user: await getCurrentUser(request.user.userId)
  });
};
