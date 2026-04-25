import { Router } from "express";
import { login, register } from "../controllers/authController";
import { requireDatabase } from "../middleware/requireDatabase";

export const authRoutes = Router();

authRoutes.post("/register", requireDatabase, (request, response, next) => {
  register(request, response).catch(next);
});

authRoutes.post("/login", requireDatabase, (request, response, next) => {
  login(request, response).catch(next);
});
