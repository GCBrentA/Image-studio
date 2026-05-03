const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const backgroundRemoval = read("src/services/backgroundRemovalService.ts");
const apiToken = read("src/utils/apiToken.ts");
const apiTokenAuth = read("src/middleware/apiTokenAuth.ts");
const imageStudioAuth = read("src/middleware/imageStudioAuth.ts");
const siteService = read("src/services/siteService.ts");
const imageProcessing = read("src/services/imageProcessingService.ts");
const productProtection = read("src/services/productProtectionValidationService.ts");
const imageController = read("src/controllers/imageController.ts");
const pluginAdmin = read("wordpress-plugin/optivra-image-studio-for-woocommerce/admin/class-catalogue-image-studio-admin.php");
const pluginProcessor = read("wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-image-processor.php");
const approvalManager = read("wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-approval-manager.php");
const pluginSaasClient = read("wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-saas-client.php");

assert.match(backgroundRemoval, /ecommerce_preserve_v2/, "prompt version is stored");
assert.match(apiToken, /normalizeApiTokenInput/, "site token auth normalizes pasted token blocks");
assert.match(apiToken, /cis_\[A-Za-z0-9_-\]\{20,\}/, "site token auth extracts embedded cis_ tokens");
assert.match(apiToken, /getApiTokenFingerprint/, "invalid token diagnostics use safe fingerprints");
assert.match(apiToken, /hashApiTokenCandidates/, "site token auth supports hash candidates");
assert.match(apiToken, /legacyUnsaltedHash/, "site token auth can verify legacy unsalted token hashes");
assert.match(apiTokenAuth, /api_token_hash:[\s\S]*in: tokenHashes/, "usage/image routes check all site token hash candidates");
assert.match(imageStudioAuth, /api_token_hash:[\s\S]*in: tokenHashes/, "audit routes check all site token hash candidates");
assert.match(apiTokenAuth, /previous_api_token_hash:[\s\S]*in: tokenHashes/, "usage/image routes accept previous site token during rotation grace");
assert.match(imageStudioAuth, /previous_api_token_hash:[\s\S]*in: tokenHashes/, "audit routes accept previous site token during rotation grace");
assert.match(apiTokenAuth, /embeddedTokenExtracted/, "usage/image auth logs safe embedded-token diagnostics");
assert.match(imageStudioAuth, /embeddedTokenExtracted/, "audit auth logs safe embedded-token diagnostics");
assert.match(siteService, /previous_api_token_hash: existingSite\.api_token_hash/, "site token rotation stores the previous token hash");
assert.match(backgroundRemoval, /Preserve the product exactly as it appears/, "prompt includes strict preservation wording");
assert.match(backgroundRemoval, /Do not change the product\. Do not modify the object\. Do not alter the silhouette/, "prompt includes no alteration rules");
assert.match(backgroundRemoval, /Do not redraw, redesign, simplify, enhance, repaint, retouch, smooth, sharpen, stylise, modify, or reinterpret/, "prompt blocks product modification");

assert.match(imageProcessing, /horizontal:[\s\S]*target: 0\.86,[\s\S]*min: 0\.82,[\s\S]*max: 0\.9,[\s\S]*autoFixBelow: 0\.75/, "horizontal product target coverage is 82-90%");
assert.match(imageProcessing, /autoFixedFraming: initialCoverage < target\.autoFixBelow/, "too-small output triggers deterministic framing fix");
assert.match(imageProcessing, /Product foreground touches the canvas safe boundary and may be cropped/, "product touching edge fails validation");
assert.match(imageProcessing, /outputValidation\.status === "Failed"/, "failed validation stops processing");
assert.match(imageProcessing, /throw new PreserveModeProcessingError\(failureReason/, "preserve failed validation is not uploaded as success");
assert.match(imageProcessing, /repairInteriorProductDropouts/, "preserve mode has an interior dropout repair stage");
assert.match(imageProcessing, /validatePreserveModeProgrammatic/, "preserve mode has strict programmatic validation");
assert.match(imageProcessing, /runPreserveVisionQa/, "preserve mode has strict vision QA");
assert.match(imageProcessing, /buildCutoutFromExistingSourceAlpha/, "standard/fallback mode uses existing transparent PNG alpha before AI cutout");
assert.match(imageProcessing, /source-alpha:transparent-product-png/, "source alpha cutouts are tracked as a distinct provider");
assert.match(imageProcessing, /secondOpinionForegroundPercent[\s\S]*productLikePercent[\s\S]*backgroundLikePercent[\s\S]*bridgesForeground/, "interior dropout repair uses structural and second-opinion evidence");
assert.match(imageProcessing, /originalRgb[\s\S]*repairedAlpha\[pixel\] = 255/, "interior restoration restores original source pixels through the preserve alpha mask");
assert.match(imageProcessing, /applyApprovedAlphaToOriginalPixels/, "final preserve product layer is original pixels cut by an approved alpha mask");
assert.match(imageProcessing, /Interior product dropout remains after repair/, "unresolved interior product dropout fails validation");
assert.match(imageProcessing, /interior_dropout_overlay[\s\S]*restored_region_overlay[\s\S]*final_repaired_cutout/, "preserve debug saves interior dropout repair artifacts");
assert.match(imageProcessing, /edge_halo_overlay[\s\S]*connected_components_overlay[\s\S]*product_cutout_checkerboard/, "preserve debug saves edge and checkerboard artifacts");
assert.match(imageProcessing, /getBackgroundMarkSuspicion[\s\S]*background logo or watermark/, "preserve masks with internal background logos are rejected before completion");
assert.match(imageProcessing, /openAiImageEditModel[\s\S]*openAiImageEditQuality[\s\S]*openAiImageEditSize/, "model, quality and size are tracked in safe logging");
assert.doesNotMatch(imageProcessing, /console\.(info|warn|error)\([\s\S]{0,400}openAiApiKey/, "safe logging does not include API key");

assert.match(backgroundRemoval, /openAiImageEditEndpoint = "https:\/\/api\.openai\.com\/v1\/images\/edits"/, "OpenAI image edit endpoint is explicit");
assert.match(backgroundRemoval, /openAiImageEditModel = env\.imageEditModel/, "OpenAI image edit model is environment driven");
assert.match(backgroundRemoval, /buildOpenAiBackgroundOnlyPrompt/, "background-only prompt is separated from product cutout logic");
assert.match(backgroundRemoval, /openAiImageEditQuality = "high"/, "OpenAI quality is high");
assert.match(backgroundRemoval, /openAiImageEditSize = "1024x1024"/, "OpenAI size is 1024x1024");

assert.match(imageProcessing, /const attempts = \[[\s\S]*attempt: 1[\s\S]*attempt: 2[\s\S]*\];/, "preserve mode retry is capped at two attempts");
assert.match(backgroundRemoval, /processImageFlexibleMode|flexible-cutout|BackgroundRemovalMode/, "standard mode uses the same image model path with one attempt");
assert.match(imageProcessing, /raw AI product pixels rejected/, "standard mode rejects unsafe raw AI product pixels");
assert.doesNotMatch(imageProcessing, /provider:\s*`openai:\$\{openAiImageEditModel\}:flexible-cutout`/, "standard mode must not return raw AI product RGB as the final cutout");
assert.match(imageProcessing, /Product cutout is too faint after background removal/, "product visibility validation rejects faint striped cutouts");
assert.match(imageProcessing, /horizontal scanline artifacts after background removal/, "product visibility validation rejects striped scanline cutouts");
assert.match(imageProcessing, /validateProtectedProductRegion/, "backend validates a protected product region before accepting output");
assert.match(imageProcessing, /protectedProductValidation/, "output validation stores protected product metrics");
assert.match(imageProcessing, /Flexible mode fell back to source-locked product pixels/, "flexible mode falls back when product fidelity drifts");
assert.match(imageProcessing, /product_diff_heatmap/, "debug artifacts include product diff heatmaps");
assert.match(imageProcessing, /uploadPipelineDebugAsset[\s\S]*generated_background/, "flexible dev/test debug artifacts include generated backgrounds");

assert.match(productProtection, /ValidationOutcome = "PASS" \| "SOFT_FAIL_RETRYABLE" \| "HARD_FAIL"/, "product protection has explicit validation outcomes");
assert.match(productProtection, /silhouetteIoU/, "product protection checks silhouette overlap");
assert.match(productProtection, /sourcePixelChangedPercent/, "product protection checks product pixel drift");
assert.match(productProtection, /labelStrokeRetentionPercent/, "product protection checks label/detail retention");
assert.match(productProtection, /horizontalStripeScore/, "product protection checks scanline artifacts");
assert.match(productProtection, /bandingScore/, "product protection checks posterization/banding risk");

assert.match(imageController, /deductCredit[\s\S]*if \(!result\.creditDeductionRequired\)[\s\S]*const deduction = await deductCredit/s, "credits are deducted only after processing success");
assert.match(imageController, /catch \(error\)[\s\S]*response\.status\(422\)/s, "failed processing returns without deducting credit");
assert.match(imageController, /Strict preserve mode failed; retrying with review-required standard output/, "strict preserve failures fall back to a review-required output");
assert.match(imageController, /preserveFallbackFromStrictMode: true/, "preserve fallback is marked in processing settings");
assert.match(imageController, /preserve_fallback: true/, "preserve fallback responses are explicit");
assert.doesNotMatch(approvalManager, /process\(/, "approval manager does not auto-process or auto-apply failed outputs");

assert.match(pluginAdmin, /Product Preservation:/, "review UI shows product preservation status");
assert.match(pluginAdmin, /Framing:/, "review UI shows framing status");
assert.match(pluginAdmin, /Interior Product Dropout:/, "review UI shows interior dropout status");
assert.match(pluginAdmin, /Protected Product Region:/, "review UI shows protected product-region status");
assert.match(pluginAdmin, /Coverage:/, "review UI shows product coverage percentage");
assert.match(pluginAdmin, /Prompt:/, "review UI shows prompt version");
assert.match(pluginAdmin, /Retry count:/, "review UI shows retry count");
assert.match(pluginAdmin, /Vision QA text\/branding score:/, "review UI shows vision QA text/branding score");
assert.match(pluginAdmin, /normalize_api_token/, "plugin settings extract a pasted cis_ token before saving");
assert.match(pluginSaasClient, /normalize_api_token[\s\S]*cis_\[A-Za-z0-9_-\]\{20,\}/, "plugin requests normalize embedded pasted cis_ tokens");
assert.match(pluginProcessor, /output_validation/, "plugin stores output validation diagnostics");

console.log("Image pipeline rule checks passed.");
