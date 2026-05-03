import { createHmac, createHash, randomBytes } from "crypto";
import { env } from "../config/env";

export const normalizeApiTokenInput = (token: string): string => {
  const trimmed = token.trim();
  const embeddedToken = trimmed.match(/cis_[A-Za-z0-9_-]{20,}/)?.[0];

  return embeddedToken ?? trimmed;
};

export const hasEmbeddedApiToken = (token: string): boolean =>
  normalizeApiTokenInput(token) !== token.trim();

export const getApiTokenFingerprint = (token: string): string =>
  createHash("sha256").update(normalizeApiTokenInput(token), "utf8").digest("hex").slice(0, 12);

export const hashApiToken = (token: string): string =>
  env.apiTokenSalt
    ? createHmac("sha256", env.apiTokenSalt).update(normalizeApiTokenInput(token), "utf8").digest("hex")
    : createHash("sha256").update(normalizeApiTokenInput(token), "utf8").digest("hex");

export const hashApiTokenCandidates = (token: string): string[] => {
  const normalizedToken = normalizeApiTokenInput(token);
  const currentHash = hashApiToken(normalizedToken);
  const legacyUnsaltedHash = createHash("sha256").update(normalizedToken, "utf8").digest("hex");

  return Array.from(new Set([currentHash, legacyUnsaltedHash]));
};

export const generateApiToken = (): string => `cis_${randomBytes(32).toString("base64url")}`;
