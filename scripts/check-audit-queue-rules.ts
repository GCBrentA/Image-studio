import assert from "node:assert/strict";
import { classifyAuditQueueAction, mapAuditActionToQueueAction } from "../src/services/imageAuditQueueRules";

const seoAction = mapAuditActionToQueueAction("fix_alt_text", "missing_alt_text");
assert.equal(seoAction, "generate_alt_text");
const seoPolicy = classifyAuditQueueAction(seoAction);
assert.equal(seoPolicy.jobKind, "seo_only");
assert.equal(seoPolicy.consumesCreditWhenProcessed, false);
assert.equal(seoPolicy.requiresReview, true);

const filenameAction = mapAuditActionToQueueAction("seo_update", "generic_filename");
assert.equal(filenameAction, "generate_alt_text");
assert.equal(classifyAuditQueueAction(filenameAction).jobKind, "seo_only");

const optimiseAction = mapAuditActionToQueueAction("compress_image", "oversized_file");
assert.equal(optimiseAction, "optimise_image");
const optimisePolicy = classifyAuditQueueAction(optimiseAction);
assert.equal(optimisePolicy.jobKind, "image_processing");
assert.equal(optimisePolicy.consumesCreditWhenProcessed, true);
assert.equal(optimisePolicy.processingMode, "preserve");

const webpAction = mapAuditActionToQueueAction(undefined, "missing_webp");
assert.equal(webpAction, "convert_webp");
assert.equal(classifyAuditQueueAction(webpAction).jobKind, "image_processing");

const backgroundAction = mapAuditActionToQueueAction("preserve_background_replace", "cluttered_background");
assert.equal(backgroundAction, "replace_background");
const backgroundPolicy = classifyAuditQueueAction(backgroundAction);
assert.equal(backgroundPolicy.jobKind, "image_processing");
assert.equal(backgroundPolicy.processingMode, "preserve");
assert.equal(backgroundPolicy.requiresReview, true);
assert.equal(backgroundPolicy.consumesCreditWhenProcessed, true);

const cropAction = mapAuditActionToQueueAction("regenerate_thumbnail", "inconsistent_aspect_ratio");
assert.equal(cropAction, "resize_crop");
assert.equal(classifyAuditQueueAction(cropAction).processingMode, "preserve");

const manualAction = mapAuditActionToQueueAction("replace_main_image", "missing_main_image");
assert.equal(manualAction, "add_main_image");
assert.equal(classifyAuditQueueAction(manualAction).jobKind, "review");

console.log("Audit queue rules passed.");
