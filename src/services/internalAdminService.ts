import { env } from "../config/env";
import { prisma } from "../utils/prisma";

export const isInternalAdminEmail = (email: string): boolean =>
  env.internalAdminEmails.includes(email.trim().toLowerCase());

export const normalizeInternalRole = (role?: string | null): "user" | "admin" | "super_admin" => {
  if (role === "admin" || role === "super_admin") {
    return role;
  }

  return "user";
};

export const isInternalAdminRole = (role?: string | null): boolean => {
  const normalized = normalizeInternalRole(role);
  return normalized === "admin" || normalized === "super_admin";
};

export const getEffectiveInternalRole = (email: string, role?: string | null): "user" | "admin" | "super_admin" => {
  if (isInternalAdminEmail(email)) {
    return normalizeInternalRole(role) === "super_admin" ? "super_admin" : "admin";
  }

  return normalizeInternalRole(role);
};

export const ensureEnvAdminRolePersisted = async (
  user: { id: string; email: string; role?: string | null }
): Promise<"user" | "admin" | "super_admin"> => {
  const effectiveRole = getEffectiveInternalRole(user.email, user.role);

  if (effectiveRole !== "user" && normalizeInternalRole(user.role) === "user") {
    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        role: effectiveRole
      }
    });
  }

  return effectiveRole;
};
