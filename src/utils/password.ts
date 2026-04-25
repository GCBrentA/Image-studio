import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const keyLength = 64;

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("base64url");
  const key = scryptSync(password, salt, keyLength).toString("base64url");

  return `scrypt$${salt}$${key}`;
};

export const verifyPassword = (password: string, passwordHash: string): boolean => {
  const [algorithm, salt, storedKey] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const stored = Buffer.from(storedKey, "base64url");
  const derived = scryptSync(password, salt, stored.length);

  return stored.length === derived.length && timingSafeEqual(stored, derived);
};
