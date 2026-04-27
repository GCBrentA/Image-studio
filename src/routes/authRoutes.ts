import { Router } from "express";
import { login, me, register } from "../controllers/authController";
import { jwtAuth } from "../middleware/jwtAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const authRoutes = Router();

authRoutes.post("/register", requireDatabase, (request, response, next) => {
  register(request, response).catch(next);
});

authRoutes.post("/login", requireDatabase, (request, response, next) => {
  login(request, response).catch(next);
});

authRoutes.get("/me", requireDatabase, jwtAuth, (request, response, next) => {
  me(request, response).catch(next);
});
