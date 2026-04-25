import { createHmac, createHash, randomBytes } from "crypto";
import { env } from "../config/env";

export const hashApiToken = (token: string): string =>
  env.apiTokenSalt
    ? createHmac("sha256", env.apiTokenSalt).update(token, "utf8").digest("hex")
    : createHash("sha256").update(token, "utf8").digest("hex");

export const generateApiToken = (): string => `cis_${randomBytes(32).toString("base64url")}`;
