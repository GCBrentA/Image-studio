const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const backgroundRemoval = read("src/services/backgroundRemovalService.ts");
const imageProcessing = read("src/services/imageProcessingService.ts");
const imageController = read("src/controllers/imageController.ts");
const pluginAdmin = read("wordpress-plugin/optivra-image-studio-for-woocommerce/admin/class-catalogue-image-studio-admin.php");
const pluginProcessor = read("wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-image-processor.php");
const approvalManager = read("wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-approval-manager.php");

assert.match(backgroundRemoval, /ecommerce_preserve_v2/, "prompt version is stored");
assert.match(backgroundRemoval, /Preserve the product exactly as it appears/, "prompt includes strict preservation wording");
assert.match(backgroundRemoval, /Do not change the product\. Do not modify the object\. Do not alter the silhouette/, "prompt includes no alteration rules");
assert.match(backgroundRemoval, /Do not redraw, redesign, simplify, enhance, repaint, retouch, smooth, sharpen, stylise, modify, or reinterpret/, "prompt blocks product modification");

assert.match(imageProcessing, /horizontal:[\s\S]*target: 0\.86,[\s\S]*min: 0\.82,[\s\S]*max: 0\.9,[\s\S]*autoFixBelow: 0\.75/, "horizontal product target coverage is 82-90%");
assert.match(imageProcessing, /autoFixedFraming: initialCoverage < target\.autoFixBelow/, "too-small output triggers deterministic framing fix");
assert.match(imageProcessing, /Product foreground touches the canvas safe boundary and may be cropped/, "product touching edge fails validation");
assert.match(imageProcessing, /outputValidation\.status === "Failed"/, "failed validation stops processing");
assert.match(imageProcessing, /throw new PreserveModeProcessingError\(failureReason/, "preserve failed validation is not uploaded as success");
assert.match(imageProcessing, /repairInteriorProductDropouts/, "preserve mode has an interior dropout repair stage");
assert.match(imageProcessing, /secondOpinionForegroundPercent[\s\S]*productLikePercent[\s\S]*backgroundLikePercent[\s\S]*bridgesForeground/, "interior dropout repair uses structural and second-opinion evidence");
assert.match(imageProcessing, /originalRgb[\s\S]*repairedAlpha\[pixel\] = 255/, "interior restoration restores original source pixels through the preserve alpha mask");
assert.match(imageProcessing, /Interior product dropout remains after repair/, "unresolved interior product dropout fails validation");
assert.match(imageProcessing, /interior_dropout_overlay[\s\S]*restored_region_overlay[\s\S]*final_repaired_cutout/, "preserve debug saves interior dropout repair artifacts");
assert.match(imageProcessing, /getBackgroundMarkSuspicion[\s\S]*background logo or watermark/, "preserve masks with internal background logos are rejected before completion");
assert.match(imageProcessing, /openAiImageEditModel[\s\S]*openAiImageEditQuality[\s\S]*openAiImageEditSize/, "model, quality and size are tracked in safe logging");
assert.doesNotMatch(imageProcessing, /console\.(info|warn|error)\([\s\S]{0,400}openAiApiKey/, "safe logging does not include API key");

assert.match(backgroundRemoval, /openAiImageEditEndpoint = "https:\/\/api\.openai\.com\/v1\/images\/edits"/, "OpenAI image edit endpoint is explicit");
assert.match(backgroundRemoval, /openAiImageEditQuality = "high"/, "OpenAI quality is high");
assert.match(backgroundRemoval, /openAiImageEditSize = "1024x1024"/, "OpenAI size is 1024x1024");

assert.match(imageProcessing, /const attempts = \[[\s\S]*attempt: 1[\s\S]*attempt: 2[\s\S]*\];/, "preserve mode retry is capped at two attempts");
assert.match(backgroundRemoval, /processImageFlexibleMode|flexible-cutout|BackgroundRemovalMode/, "standard mode uses the same image model path with one attempt");

assert.match(imageController, /deductCredit[\s\S]*if \(!result\.creditDeductionRequired\)[\s\S]*const deduction = await deductCredit/s, "credits are deducted only after processing success");
assert.match(imageController, /catch \(error\)[\s\S]*response\.status\(422\)/s, "failed processing returns without deducting credit");
assert.doesNotMatch(approvalManager, /process\(/, "approval manager does not auto-process or auto-apply failed outputs");

assert.match(pluginAdmin, /Product Preservation:/, "review UI shows product preservation status");
assert.match(pluginAdmin, /Framing:/, "review UI shows framing status");
assert.match(pluginAdmin, /Interior Product Dropout:/, "review UI shows interior dropout status");
assert.match(pluginAdmin, /Coverage:/, "review UI shows product coverage percentage");
assert.match(pluginAdmin, /Prompt:/, "review UI shows prompt version");
assert.match(pluginAdmin, /Retry count:/, "review UI shows retry count");
assert.match(pluginProcessor, /output_validation/, "plugin stores output validation diagnostics");

console.log("Image pipeline rule checks passed.");
