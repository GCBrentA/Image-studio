import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pluginAdmin = readFileSync("wordpress-plugin/optivra-image-studio-for-woocommerce/admin/class-catalogue-image-studio-admin.php", "utf8");
const pluginCss = readFileSync("wordpress-plugin/optivra-image-studio-for-woocommerce/assets/admin.css", "utf8");
const appJs = readFileSync("public/site/assets/app.js", "utf8");
const siteCss = readFileSync("public/site/assets/styles.css", "utf8");
const auditService = readFileSync("src/services/imageAuditService.ts", "utf8");

const assertIncludes = (source: string, text: string, label: string): void => {
  assert.ok(source.includes(text), `${label} should include ${text}`);
};

assertIncludes(pluginAdmin, "Product Image Health Scan", "Plugin scan page");
assertIncludes(pluginAdmin, "Run Full Health Scan", "Plugin scan page");
assertIncludes(pluginAdmin, "Advanced scan options", "Plugin scan page");
assertIncludes(pluginAdmin, "Recommendation highlights", "Plugin health report");
assertIncludes(pluginAdmin, "Optimise Recommended Images", "Plugin health report");
assertIncludes(pluginAdmin, "Add All Recommended to Queue", "Plugin health report");
assertIncludes(pluginAdmin, "View technical details", "Plugin health report");
assertIncludes(pluginAdmin, "Account & Settings", "Plugin settings");
assertIncludes(pluginAdmin, "Credits & Billing", "Plugin settings");
assertIncludes(pluginAdmin, "Image Defaults", "Plugin settings");
assertIncludes(pluginAdmin, "Scan Preferences", "Plugin settings");
assertIncludes(pluginAdmin, "Advanced", "Plugin settings");

assertIncludes(appJs, "Product Image Health Report", "Portal report");
assertIncludes(appJs, "recommendation-pill", "Portal recommendation pills");
assertIncludes(appJs, "data-report-optimise-recommended", "Portal report actions");
assertIncludes(appJs, "data-report-add-all-recommended", "Portal report actions");
assertIncludes(appJs, "Account & Settings", "Portal settings");
assertIncludes(appJs, "safe_defaults", "Portal queue safe defaults");

assertIncludes(auditService, "overallScore", "Image audit API friendly fields");
assertIncludes(auditService, "categoryScores", "Image audit API friendly fields");
assertIncludes(auditService, "recommendationPills", "Image audit API friendly fields");
assertIncludes(auditService, "affectedProducts", "Image audit API friendly fields");
assertIncludes(auditService, "recommendedActions", "Image audit API friendly fields");

assertIncludes(pluginCss, "font-family: Inter, ui-sans-serif", "Plugin CSS");
assertIncludes(siteCss, "font-family: Inter, ui-sans-serif", "Site CSS");
assert.equal(/font-family:[^;]*Segoe UI/i.test(pluginCss), false, "Plugin CSS should not use Segoe UI-first font styling");
assert.equal(/font-family:[^;]*Segoe UI/i.test(siteCss), false, "Site CSS should not use Segoe UI-first font styling");

console.log(JSON.stringify({
  ok: true,
  one_click_scan: true,
  advanced_scan_options_collapsed: true,
  report_pills_and_actions: true,
  account_settings_unified: true,
  inter_first_typography: true,
  friendly_report_api_fields: true
}, null, 2));
