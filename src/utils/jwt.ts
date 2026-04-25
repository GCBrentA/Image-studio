import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../../config/env";
import { HttpError } from "./httpError";

type JwtPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

const tokenTtlSeconds = 60 * 60 * 24 * 7;

const base64UrlEncode = (value: object): string =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const base64UrlDecode = <T>(value: string): T =>
  JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;

const getJwtSecret = (): string => {
  if (!env.jwtSecret) {
    throw new HttpError(503, "JWT is not configured");
  }

  return env.jwtSecret;
};

const sign = (value: string): string =>
  createHmac("sha256", getJwtSecret()).update(value).digest("base64url");

export const createJwt = (user: { id: string; email: string }): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode({
    alg: "HS256",
    typ: "JWT"
  });
  const payload = base64UrlEncode({
    sub: user.id,
    email: user.email,
    iat: now,
    exp: now + tokenTtlSeconds
  });
  const unsigned = `${header}.${payload}`;

  return `${unsigned}.${sign(unsigned)}`;
};

export const verifyJwt = (token: string): JwtPayload => {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    throw new HttpError(401, "Invalid auth token");
  }

  let decodedHeader: { alg?: string; typ?: string };

  try {
    decodedHeader = base64UrlDecode<{ alg?: string; typ?: string }>(header);
  } catch {
    throw new HttpError(401, "Invalid auth token");
  }

  if (decodedHeader.alg !== "HS256" || decodedHeader.typ !== "JWT") {
    throw new HttpError(401, "Invalid auth token");
  }

  const expectedSignature = sign(`${header}.${payload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new HttpError(401, "Invalid auth token");
  }

  let decoded: JwtPayload;

  try {
    decoded = base64UrlDecode<JwtPayload>(payload);
  } catch {
    throw new HttpError(401, "Invalid auth token");
  }

  if (!decoded.sub || !decoded.email || decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "Invalid auth token");
  }

  return decoded;
};
