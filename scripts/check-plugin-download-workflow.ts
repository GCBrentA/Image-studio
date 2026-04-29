import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const migration = readFileSync("prisma/migrations/20260430120000_plugin_download_leads_feedback/migration.sql", "utf8");
const routes = readFileSync("src/routes/pluginDownloadRoutes.ts", "utf8");
const routeIndex = readFileSync("src/routes/index.ts", "utf8");
const appJs = readFileSync("public/site/assets/app.js", "utf8");
const html = readFileSync("public/site/index.html", "utf8");
const staticMiddleware = readFileSync("src/middleware/staticDownloadAnalytics.ts", "utf8");

[
  "plugin_releases",
  "plugin_download_leads",
  "plugin_download_events",
  "plugin_feedback",
  "plugin_email_events",
  "plugin_unsubscribes"
].forEach((table) => {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} migration exists`);
});

assert.match(routeIndex, /routes\.use\("\/plugins", pluginDownloadRoutes\)/, "plugin routes are mounted under /plugins for /api/plugins");
assert.match(routes, /\/download-request/, "download request route exists");
assert.match(routes, /\/download-complete/, "download complete route exists");
assert.match(routes, /\/feedback/, "feedback route exists");
assert.match(routes, /\/unsubscribe/, "unsubscribe route exists");
assert.match(staticMiddleware, /response\.redirect\(302, `\/downloads\?plugin=/, "direct zip requests redirect to gated downloads page");

assert.match(html, /id="plugin-download-modal"/, "download capture modal exists");
assert.match(html, /name="consent_marketing"/, "marketing consent is separate");
assert.match(html, /data-plugin-download="optivra-image-studio"/, "Image Studio gated download button exists");
assert.match(html, /data-plugin-download="optivra-gateway-rules"/, "Gateway Rules gated download button exists");
assert.doesNotMatch(html, /data-download-zip/, "normal page does not expose direct zip download attribute");

[
  "plugin_download_modal_open",
  "plugin_download_request_submit",
  "plugin_download_started",
  "plugin_download_completed",
  "plugin_feedback_submit"
].forEach((eventName) => {
  assert.match(appJs, new RegExp(eventName), `${eventName} tracking exists`);
});

console.log("Plugin download workflow checks passed.");
