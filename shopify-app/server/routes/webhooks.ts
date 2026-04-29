import { Router } from "express";
import { query } from "../db/pool";
import { markShopUninstalled } from "../services/repositories";
import { verifyWebhook } from "../services/shopify";
import { trackShopifyServerEvent } from "../services/tracking";

export const webhookRouter = Router();

webhookRouter.post("/webhooks/app/uninstalled", expressRawJson, async (req, res, next) => {
  try {
    if (!verifyWebhook(req.body, req.header("X-Shopify-Hmac-Sha256"))) return res.sendStatus(401);
    trackShopifyServerEvent("server_webhook_received", { webhook_provider: "shopify", webhook_type: "app_uninstalled" });
    const payload = JSON.parse(req.body.toString("utf8"));
    await markShopUninstalled(payload.myshopify_domain || payload.domain);
    res.sendStatus(200);
  } catch (error) {
    trackShopifyServerEvent("server_webhook_error", { webhook_provider: "shopify", webhook_type: "app_uninstalled", error_category: "processing" });
    next(error);
  }
});

webhookRouter.post("/webhooks/customers/data_request", expressRawJson, complianceAck);
webhookRouter.post("/webhooks/customers/redact", expressRawJson, complianceAck);
webhookRouter.post("/webhooks/shop/redact", expressRawJson, async (req, res, next) => {
  try {
    if (!verifyWebhook(req.body, req.header("X-Shopify-Hmac-Sha256"))) return res.sendStatus(401);
    trackShopifyServerEvent("server_webhook_received", { webhook_provider: "shopify", webhook_type: "shop_redact" });
    const payload = JSON.parse(req.body.toString("utf8"));
    const shopDomain = payload.shop_domain || payload.myshopify_domain;
    const shop = await query("select id from shops where shop_domain=$1", [shopDomain]);
    if (shop.rows[0]) {
      const settings = await query("select delete_data_on_uninstall from app_settings where shop_id=$1", [shop.rows[0].id]);
      if (settings.rows[0]?.delete_data_on_uninstall) {
        await query("delete from shops where id=$1", [shop.rows[0].id]);
      } else {
        await query("update shops set uninstalled_at=now(), updated_at=now() where id=$1", [shop.rows[0].id]);
      }
    }
    res.sendStatus(200);
  } catch (error) {
    trackShopifyServerEvent("server_webhook_error", { webhook_provider: "shopify", webhook_type: "shop_redact", error_category: "processing" });
    next(error);
  }
});

function expressRawJson(req: any, res: any, next: any) {
  let data = Buffer.alloc(0);
  req.on("data", (chunk: Buffer) => {
    data = Buffer.concat([data, chunk]);
  });
  req.on("end", () => {
    req.body = data;
    next();
  });
}

async function complianceAck(req: any, res: any) {
  if (!verifyWebhook(req.body, req.header("X-Shopify-Hmac-Sha256"))) return res.sendStatus(401);
  return res.sendStatus(200);
}
