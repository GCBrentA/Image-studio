import { readFileSync } from "node:fs";

const admin = readFileSync("wordpress-plugin/optivra-image-studio-for-woocommerce/admin/class-catalogue-image-studio-admin.php", "utf8");
const css = readFileSync("wordpress-plugin/optivra-image-studio-for-woocommerce/assets/admin.css", "utf8");
const service = readFileSync("src/services/imageAuditService.ts", "utf8");
const app = readFileSync("src/app.ts", "utf8");
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
  "Run Selected Category Scan",
  "data-optivra-scan-results",
  "data-optivra-scan-item",
  "Select all recommended",
  "Add Selected to Queue",
  "Optimise Recommended Images",
  "queue_selected_scan_results",
  "queue_from_audit_payload",
  "optivra_latest_audit_items",
  "optivra_latest_audit_remote_enabled",
  "optivra-audit-category-start",
  "Remote health report unavailable",
  "Catalogue scan completed locally",
  "No queueable image metadata was found",
  "_audit_item",
  "_queueable_image",
  "Scan complete. No major issues found.",
  "No products found for this scan scope."
]);

requireIncludes("Product scanner fallback rows", readFileSync("wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-product-scanner.php", "utf8"), [
  "build_audit_product_fallback_item",
  "Product has no queueable product image.",
  "Image could not be prepared for the health audit.",
  "_audit_item",
  "_queueable_image"
]);

requireIncludes("WordPress scan results JavaScript", admin, [
  "initScanResults",
  "data-optivra-selected-count",
  "data-optivra-result-filter",
  "data-optivra-row-add",
  "data-optivra-row-ignore",
  "scan_scope: \"categories\"",
  "scan_scope: \"all\", category_ids: []"
]);

requireIncludes("Scan results styling", css, [
  ".optivra-admin-app .optivra-scan-results",
  ".optivra-admin-app .optivra-scan-results-summary",
  ".optivra-admin-app .optivra-scanned-products-table-wrap",
  ".optivra-admin-app .optivra-row-actions",
  "repeat(auto-fit, minmax(320px, 1fr))",
  ".optivra-background-preset-muted"
]);

requireIncludes("Preserve settings respected", admin, [
  "$preserve_product_exactly = ! empty($settings['preserve_product_exactly'])",
  "'preserveProductExactly' => $preserve_product_exactly",
  "'autoFailIfProductAltered' => $preserve_product_exactly && ! empty($settings['auto_fail_product_altered'])",
  "standard_ecommerce_cleanup"
]);

requireIncludes("Custom background respected for audit queue jobs", admin, [
  "$custom_background_attachment_id = absint($settings['custom_background_attachment_id'] ?? 0)",
  "$uses_custom_background = 'custom' === $background_source",
  "$is_audit_job && ! $uses_custom_background",
  "! $uses_custom_background && empty($options['background_image_url'])",
  "'customBackgroundUrl' => $custom_background_url ?: null",
  "backgroundSource.value = 'custom'",
  "syncBackgroundMode"
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
  "normalizeImageSourceUrl",
  "proxiedImageSourceUrl",
  "hydrateAttentionImages",
  "const primaryUrl = proxyUrl || imageUrl",
  "data-direct-src",
  "<img data-attention-image hidden",
  "img.hidden = false",
  "report.products",
  "report.images",
  "thumbnailUrl",
  "thumbnail_url",
  "data-attention-image",
  "/api/image-proxy?url=",
  "renderAttentionImage",
  "attention-image-fallback"
]);

requireIncludes("Portal before and after navigation", portalApp, [
  "[\"before_after\", \"Before & After\", \"/before-after\"]",
  "[\"scan\", \"Product Scan\", \"/product-scan\"]",
  "loadProductScanPage",
  "loadBeforeAfterPage",
  "before-after-root",
  "data-before-after-reload"
]);

requireIncludes("Portal account dropdown", portalApp, [
  "ensureHeaderAccountMenuPortal",
  "positionHeaderAccountMenu",
  "authActionsRoot.querySelector(\"#header-account-trigger\")",
  "data-auth-account-trigger",
  "header-account-menu",
  "data-auth-logout",
  "setAttribute(\"role\", \"menu\")"
]);

requireIncludes("Portal thumbnail styling", portalStyles, [
  ".attention-image-frame",
  ".attention-image-fallback",
  ".attention-image-frame.has-image",
  ".attention-card img[hidden]",
  ".attention-image-frame.is-missing img",
  ".attention-image-fallback[hidden]",
  ".account-dropdown.is-open",
  "z-index: 10000"
]);

requireIncludes("Portal image proxy", app, [
  "/api/image-proxy",
  "isBlockedProxyImageHost",
  "content-type",
  "Image could not be loaded"
]);

console.log("Image Studio scan results regression guard passed.");
