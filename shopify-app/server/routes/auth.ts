import crypto from "node:crypto";
import { Router } from "express";
import { config } from "../config";
import { exchangeCodeForToken, normalizeShop, registerMandatoryWebhooks, verifyShopifyHmac } from "../services/shopify";
import { setSessionCookie } from "../services/session";
import { upsertShop } from "../services/repositories";

export const authRouter = Router();
const stateStore = new Map<string, string>();

authRouter.get("/auth", (req, res, next) => {
  try {
    const shop = normalizeShop(String(req.query.shop || ""));
    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(state, shop);
    const redirectUri = `${config.appUrl}/auth/callback`;
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set("client_id", config.shopifyApiKey);
    url.searchParams.set("scope", config.scopes);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  } catch (error) {
    next(error);
  }
});

authRouter.get("/auth/callback", async (req, res, next) => {
  try {
    const params = new URLSearchParams(req.query as Record<string, string>);
    if (!verifyShopifyHmac(params)) return res.status(400).send("Invalid Shopify HMAC");
    const shop = normalizeShop(String(req.query.shop || ""));
    const state = String(req.query.state || "");
    if (stateStore.get(state) !== shop) return res.status(400).send("Invalid OAuth state");
    stateStore.delete(state);
    const code = String(req.query.code || "");
    const token = await exchangeCodeForToken(shop, code);
    const record = await upsertShop({ shopDomain: shop, accessToken: token.access_token, scopes: token.scope });
    await registerMandatoryWebhooks(shop, record.access_token_encrypted, config.appUrl);
    setSessionCookie(res, shop);
    res.redirect("/?shop=" + encodeURIComponent(shop));
  } catch (error) {
    next(error);
  }
});
