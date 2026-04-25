import { createHash } from "crypto";

export const hashApiToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");
