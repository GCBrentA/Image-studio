import { readFileSync } from "node:fs";

const admin = readFileSync("wordpress-plugin/optivra-image-studio-for-woocommerce/admin/class-catalogue-image-studio-admin.php", "utf8");
const css = readFileSync("wordpress-plugin/optivra-image-studio-for-woocommerce/assets/admin.css", "utf8");
const service = readFileSync("src/services/imageAuditService.ts", "utf8");
const portalApp = readFileSync("public/site/assets/app.js", "utf8");
const portalStyles = readFileSync("public/site/assets/styles.css", "utf8");

const requireIncludes = (label: string, haystack: string, needles: string[]): void => {
  const missing = needles.filter((needle) => !haystack.includes(needle));
  if (missing.length) {
    throw new Error(`${label} is missing expected scan-results regression markers: ${missing.join(", ")}`);
  }
};

requireIncludes("WordPress scan UI", admin, [
  "Run Full Health Scan",
  "Advanced scan options",
  "normalize_scan_result",
  "Health Report summary",
  "Scanned Products",
  "data-optivra-scan-results",
  "data-optivra-scan-item",
  "Select all recommended",
  "Add Selected to Queue",
  "Optimise Recommended Images",
  "queue_selected_scan_results",
  "queue_from_audit_payload",
  "optivra_latest_audit_items",
  "Scan complete. No major issues found.",
  "No products found for this scan scope."
]);

requireIncludes("WordPress scan results JavaScript", admin, [
  "initScanResults",
  "data-optivra-selected-count",
  "data-optivra-result-filter",
  "data-optivra-row-add",
  "data-optivra-row-ignore"
]);

requireIncludes("Scan results styling", css, [
  ".optivra-admin-app .optivra-scan-results",
  ".optivra-admin-app .optivra-scan-results-summary",
  ".optivra-admin-app .optivra-scanned-products-table-wrap",
  ".optivra-admin-app .optivra-row-actions"
]);

requireIncludes("Backend report response", service, [
  "scanProductsFromItems",
  "products,",
  "images: products",
  "queuePayload",
  "statusFromIssues",
  "affectedProducts: affectedProducts.length ? affectedProducts : products"
]);

requireIncludes("Portal health report images", portalApp, [
  "normalizeReportTopImages",
  "report.products",
  "report.images",
  "thumbnailUrl",
  "thumbnail_url",
  "renderAttentionImage",
  "attention-image-fallback"
]);

requireIncludes("Portal before and after navigation", portalApp, [
  "[\"before_after\", \"Before & After\", \"/before-after\"]",
  "loadBeforeAfterPage",
  "before-after-root",
  "data-before-after-reload"
]);

requireIncludes("Portal account dropdown", portalApp, [
  "positionHeaderAccountMenu",
  "data-auth-account-trigger",
  "header-account-menu",
  "data-auth-logout",
  "role=\"menu\""
]);

requireIncludes("Portal thumbnail styling", portalStyles, [
  ".attention-image-frame",
  ".attention-image-fallback",
  ".account-dropdown.is-open",
  "z-index: 10000"
]);

console.log("Image Studio scan results regression guard passed.");
