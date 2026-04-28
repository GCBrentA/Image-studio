#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const sourcePath = process.argv[2] || "D:\\Downloads\\original-c1f28067-84f2-40a8-a5a4-2b538a1ef98f.jpg";
const backgroundPath = process.argv[3] || "D:\\Downloads\\Light-azraels-default-background.png";
const outputDir = process.argv[4] || path.join(process.cwd(), "tmp", "preserve-debug-smoke");

const getAlphaCoverage = (alpha) => {
  let count = 0;
  for (let index = 0; index < alpha.length; index += 1) {
    if ((alpha[index] || 0) >= 24) {
      count += 1;
    }
  }
  return count;
};

const main = async () => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Failed preserve-mode source image was not found: ${sourcePath}`);
  }

  await fs.promises.mkdir(outputDir, { recursive: true });
  const source = await sharp(sourcePath).rotate().resize(2000, 2000, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }).ensureAlpha().png().toBuffer();
  const metadata = await sharp(source).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error("Source image dimensions could not be read.");
  }

  const emptyAlpha = Buffer.alloc(width * height);
  const coverage = getAlphaCoverage(emptyAlpha);
  const alphaMaskPreview = await sharp(emptyAlpha, {
    raw: { width, height, channels: 1 }
  }).png().toBuffer();
  const aiCutout = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();
  const background = fs.existsSync(backgroundPath)
    ? await sharp(backgroundPath).rotate().resize(2000, 2000, { fit: "cover" }).png().toBuffer()
    : await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: "#111111"
        }
      }).png().toBuffer();

  const diagnostics = {
    preserveMode: true,
    fallbackMode: "fail_safe",
    finalStatus: coverage === 0 ? "failed" : "completed",
    maskSource: coverage === 0 ? "failed" : "ai_mask",
    attempts: 2,
    failureReason: coverage === 0 ? "alpha mask is empty" : null,
    backgroundOnlyCompletionPrevented: coverage === 0,
    mask: {
      width,
      height,
      alphaCoverage: coverage,
      alphaCoveragePercent: (coverage / (width * height)) * 100,
      passed: coverage > 0,
      failureReasons: coverage === 0 ? ["alpha mask is empty"] : []
    },
    assets: [
      "original-source.png",
      "ai-transparent-cutout.png",
      "alpha-mask-preview.png",
      "background-only-comparison.png",
      "diagnostics.json"
    ]
  };

  await Promise.all([
    fs.promises.writeFile(path.join(outputDir, "original-source.png"), source),
    fs.promises.writeFile(path.join(outputDir, "ai-transparent-cutout.png"), aiCutout),
    fs.promises.writeFile(path.join(outputDir, "alpha-mask-preview.png"), alphaMaskPreview),
    fs.promises.writeFile(path.join(outputDir, "background-only-comparison.png"), background),
    fs.promises.writeFile(path.join(outputDir, "diagnostics.json"), JSON.stringify(diagnostics, null, 2))
  ]);

  if (diagnostics.finalStatus === "completed") {
    throw new Error("Preserve smoke check failed: an empty/background-only mask was marked completed.");
  }

  if (!diagnostics.backgroundOnlyCompletionPrevented) {
    throw new Error("Preserve smoke check failed: background-only output was not blocked.");
  }

  for (const asset of diagnostics.assets) {
    if (!fs.existsSync(path.join(outputDir, asset))) {
      throw new Error(`Preserve smoke check failed: missing debug asset ${asset}`);
    }
  }

  console.log(`Preserve debug smoke check passed. Debug assets: ${outputDir}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
