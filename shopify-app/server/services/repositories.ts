import { query } from "../db/pool";
import { encrypt } from "./crypto";

export async function upsertShop(input: { shopDomain: string; accessToken: string; scopes: string }) {
  const result = await query(
    `insert into shops (shop_domain, access_token_encrypted, scopes, installed_at, uninstalled_at, updated_at)
     values ($1, $2, $3, now(), null, now())
     on conflict (shop_domain)
     do update set access_token_encrypted = excluded.access_token_encrypted, scopes = excluded.scopes, installed_at = now(), uninstalled_at = null, updated_at = now()
     returning *`,
    [input.shopDomain, encrypt(input.accessToken), input.scopes]
  );
  await query(
    `insert into app_settings (shop_id) values ($1)
     on conflict do nothing`,
    [result.rows[0].id]
  );
  return result.rows[0] as { id: string; access_token_encrypted: string };
}

export async function markShopUninstalled(shopDomain: string) {
  await query("update shops set uninstalled_at = now(), updated_at = now() where shop_domain = $1", [shopDomain]);
}

export async function addJobEvent(jobId: string, eventType: string, payload: unknown = {}) {
  await query("insert into image_job_events (image_job_id, event_type, event_payload) values ($1, $2, $3)", [
    jobId,
    eventType,
    JSON.stringify(payload)
  ]);
}
