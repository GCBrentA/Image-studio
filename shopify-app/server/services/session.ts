import crypto from "node:crypto";
import { parse, serialize } from "cookie";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { query } from "../db/pool";

export type ShopRecord = {
  id: string;
  shop_domain: string;
  access_token_encrypted: string;
  scopes: string | null;
  plan: string;
  credits_remaining: number;
  uninstalled_at: Date | null;
};

export type AuthedRequest = Request & { shopRecord?: ShopRecord };

const cookieName = "optivra_shopify_session";

function sign(value: string) {
  return crypto.createHmac("sha256", config.shopifyApiSecret).update(value).digest("base64url");
}

export function setSessionCookie(res: Response, shop: string) {
  const value = `${shop}.${sign(shop)}`;
  res.setHeader("Set-Cookie", serialize(cookieName, value, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  }));
}

export async function requireShopSession(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const cookies = parse(req.headers.cookie || "");
    const raw = cookies[cookieName];
    if (!raw) return res.status(401).json({ error: "Not installed or session expired" });
    const [shop, signature] = raw.split(".");
    if (!shop || signature !== sign(shop)) return res.status(401).json({ error: "Invalid session" });

    const result = await query<ShopRecord>("select * from shops where shop_domain = $1 limit 1", [shop]);
    const record = result.rows[0];
    if (!record || record.uninstalled_at) return res.status(401).json({ error: "Shop is not installed" });

    req.shopRecord = record;
    next();
  } catch (error) {
    next(error);
  }
}
