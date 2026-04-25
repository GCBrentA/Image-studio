import type { Request, Response } from "express";
import { loginUser, registerUser } from "../services/authService";

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
