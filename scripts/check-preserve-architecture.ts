import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { combinePreserveQaResults, validatePreserveModeProgrammatic } from "../src/services/preserveModeValidationService";

const width = 512;
const height = 512;
const root = path.resolve(__dirname, "..");
const fixtureDir = path.join(root, "tmp", "preserve-regression-fixtures");

const productPixels = new Set<number>();

const addRect = (x1: number, y1: number, x2: number, y2: number) => {
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      productPixels.add(y * width + x);
    }
  }
};

addRect(74, 226, 430, 257); // receiver/body
addRect(28, 236, 96, 248); // barrel
addRect(418, 221, 490, 268); // stock
addRect(214, 258, 254, 348); // magazine
addRect(292, 258, 326, 319); // grip
addRect(144, 210, 322, 222); // rail
addRect(326, 206, 348, 226); // sight

const sourceRgba = Buffer.alloc(width * height * 4);
const referenceAlpha = Buffer.alloc(width * height);

for (let pixel = 0; pixel < width * height; pixel += 1) {
  const index = pixel * 4;
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  const plank = Math.floor(y / 26) % 2 === 0 ? 186 : 201;
  sourceRgba[index] = plank;
  sourceRgba[index + 1] = plank;
  sourceRgba[index + 2] = plank - 4;
  sourceRgba[index + 3] = 255;

  if (productPixels.has(pixel)) {
    const highlight = (x + y) % 19 === 0 ? 28 : 12;
    sourceRgba[index] = highlight;
    sourceRgba[index + 1] = highlight + 2;
    sourceRgba[index + 2] = highlight + 4;
    referenceAlpha[pixel] = 255;
  }
}

const makeCutout = async (alpha: Buffer, mutateProduct = false) => {
  const rgba = Buffer.from(sourceRgba);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const index = pixel * 4;
    rgba[index + 3] = alpha[pixel] ?? 0;
    if (mutateProduct && (alpha[pixel] ?? 0) >= 24 && productPixels.has(pixel)) {
      rgba[index] = 90;
      rgba[index + 1] = 40;
      rgba[index + 2] = 40;
    }
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
};

async function main() {
  const sourceBuffer = await sharp(sourceRgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  await fs.promises.mkdir(fixtureDir, { recursive: true });
  await fs.promises.writeFile(path.join(fixtureDir, "ak-style-before.png"), sourceBuffer);

  const cleanCutout = await makeCutout(referenceAlpha);
  const cleanResult = await validatePreserveModeProgrammatic({
    sourceBuffer,
    productCutoutBuffer: cleanCutout,
    sourceReferenceAlpha: referenceAlpha,
    referenceWidth: width,
    referenceHeight: height
  });
  assert.equal(cleanResult.passed, true, "a clean original-pixel cutout with no halo should pass programmatic validation");

  const badHaloAlpha = Buffer.from(referenceAlpha);
  for (let y = 198; y <= 224; y += 1) {
    for (let x = 70; x <= 380; x += 1) {
      badHaloAlpha[y * width + x] = 255;
    }
  }
  const badHaloCutout = await makeCutout(badHaloAlpha);
  await fs.promises.writeFile(path.join(fixtureDir, "ak-style-current-bad-after.png"), badHaloCutout);

  const badHaloResult = await validatePreserveModeProgrammatic({
    sourceBuffer,
    productCutoutBuffer: badHaloCutout,
    sourceReferenceAlpha: referenceAlpha,
    referenceWidth: width,
    referenceHeight: height
  });
  assert.equal(badHaloResult.passed, false, "current bad AK-style after image must fail");
  assert.ok(badHaloResult.failReasons.includes("Edge Halo / Background Residue"), "bad AK-style result must fail edge halo/background residue");

  const aiPixels = await makeCutout(referenceAlpha, true);
  const aiPixelResult = await validatePreserveModeProgrammatic({
    sourceBuffer,
    productCutoutBuffer: aiPixels,
    sourceReferenceAlpha: referenceAlpha,
    referenceWidth: width,
    referenceHeight: height
  });
  assert.equal(aiPixelResult.passed, false, "AI product RGB must not pass preserve mode");
  assert.ok(aiPixelResult.failReasons.includes("AI Product Pixel Contamination"), "AI RGB contamination must be explicit");

  const missingAlpha = Buffer.from(referenceAlpha);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < 132; x += 1) {
      missingAlpha[y * width + x] = 0;
    }
  }
  for (let y = 250; y < height; y += 1) {
    for (let x = 190; x < 270; x += 1) {
      missingAlpha[y * width + x] = 0;
    }
  }
  const missingResult = await validatePreserveModeProgrammatic({
    sourceBuffer,
    productCutoutBuffer: await makeCutout(missingAlpha),
    sourceReferenceAlpha: referenceAlpha,
    referenceWidth: width,
    referenceHeight: height
  });
  assert.equal(missingResult.passed, false, "missing barrel/magazine product material must fail");
  assert.ok(missingResult.failReasons.includes("Product Pixel Loss"), "missing product material must be reported");

  const artifactAlpha = Buffer.from(referenceAlpha);
  for (let y = 18; y <= 58; y += 1) {
    for (let x = 18; x <= 90; x += 1) {
      artifactAlpha[y * width + x] = 255;
    }
  }
  const artifactResult = await validatePreserveModeProgrammatic({
    sourceBuffer,
    productCutoutBuffer: await makeCutout(artifactAlpha),
    sourceReferenceAlpha: referenceAlpha,
    referenceWidth: width,
    referenceHeight: height
  });
  assert.equal(artifactResult.passed, false, "disconnected floor/background components must fail");
  assert.ok(
    artifactResult.failReasons.includes("Disconnected Background Artifact") ||
      artifactResult.failReasons.includes("Mask Includes Background"),
    "background artifacts must be explicit"
  );

  assert.equal(combinePreserveQaResults(true, true), "Passed");
  assert.equal(combinePreserveQaResults(true, false), "Failed");
  assert.equal(combinePreserveQaResults(false, true), "Failed");

  const imageProcessing = fs.readFileSync(path.join(root, "src/services/imageProcessingService.ts"), "utf8");
  assert.match(imageProcessing, /applyApprovedAlphaToOriginalPixels/, "preserve cutout must apply alpha to original source pixels");
  assert.doesNotMatch(imageProcessing, /rgba\[targetIndex\] = replacement\.r/, "preserve mode must not repaint product RGB at dirty edges");

  const imageController = fs.readFileSync(path.join(root, "src/controllers/imageController.ts"), "utf8");
  assert.match(imageController, /if \(!result\.creditDeductionRequired\)[\s\S]*const deduction = await deductCredit/, "credit deduction remains after successful processing only");
  assert.match(imageController, /catch \(error\)[\s\S]*response\.status\(422\)/, "failed validation returns without deducting credits");

  const pluginAdmin = fs.readFileSync(path.join(root, "wordpress-plugin/optivra-image-studio-for-woocommerce/admin/class-catalogue-image-studio-admin.php"), "utf8");
  assert.match(pluginAdmin, /Failed: Edge Halo \/ Background Residue/, "review UI displays edge halo failure label");
  assert.match(pluginAdmin, /Alpha mask confidence score/, "review UI displays alpha confidence score");
  assert.match(pluginAdmin, /Vision QA ecommerce score/, "review UI displays vision QA ecommerce score");

  console.log(`Preserve architecture checks passed. Fixtures: ${fixtureDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
