import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const envDefaults: Record<string, string> = {
  SUPABASE_PROJECT_URL: "https://example.supabase.co",
  JWT_SECRET: "test-jwt-secret-1234567890",
  API_TOKEN_SALT: "test-api-token-salt-1234567890",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_PUBLISHABLE_KEY: "pk_test_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_dummy",
  STRIPE_PRICE_STARTER: "price_dummy_starter",
  STRIPE_PRICE_GROWTH: "price_dummy_growth",
  STRIPE_PRICE_PRO: "price_dummy_pro",
  STRIPE_PRICE_AGENCY: "price_dummy_agency",
  STRIPE_CREDIT_PRICE_SMALL: "price_dummy_small",
  STRIPE_CREDIT_PRICE_MEDIUM: "price_dummy_medium",
  STRIPE_CREDIT_PRICE_LARGE: "price_dummy_large",
  STRIPE_CREDIT_PRICE_AGENCY: "price_dummy_credit_agency",
  STRIPE_SUCCESS_URL: "https://example.com/success",
  STRIPE_CANCEL_URL: "https://example.com/cancel",
  APP_BASE_URL: "https://example.com"
};

for (const [key, value] of Object.entries(envDefaults)) {
  process.env[key] = process.env[key] || value;
}

const width = 420;
const height = 420;
const root = path.resolve(__dirname, "..");
const artifactDir = path.join(root, "tmp", "product-protection-regression");

const makeProduct = async (mutate?: (rgba: Buffer, alpha: Buffer) => void) => {
  const rgba = Buffer.alloc(width * height * 4);
  const alpha = Buffer.alloc(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const index = pixel * 4;
      const inBottle = x >= 130 && x <= 290 && y >= 70 && y <= 355;
      const inNeck = x >= 170 && x <= 250 && y >= 32 && y < 88;
      const inCap = x >= 158 && x <= 262 && y >= 16 && y < 38;
      const inLabel = x >= 148 && x <= 272 && y >= 158 && y <= 248;
      const inText =
        (x >= 164 && x <= 256 && y >= 176 && y <= 188) ||
        (x >= 176 && x <= 244 && y >= 204 && y <= 214) ||
        (x >= 186 && x <= 234 && y >= 226 && y <= 234);

      if (inBottle || inNeck || inCap) {
        alpha[pixel] = 255;
        rgba[index] = inCap ? 34 : 228;
        rgba[index + 1] = inCap ? 39 : 232;
        rgba[index + 2] = inCap ? 44 : 220;
        rgba[index + 3] = 255;

        if (inLabel) {
          rgba[index] = 243;
          rgba[index + 1] = 238;
          rgba[index + 2] = 214;
        }

        if (inText || (x % 31 === 0 && y >= 164 && y <= 240)) {
          rgba[index] = 18;
          rgba[index + 1] = 34;
          rgba[index + 2] = 52;
        }

        if (x === 138 || x === 282) {
          rgba[index] = 180;
          rgba[index + 1] = 190;
          rgba[index + 2] = 190;
        }
      }
    }
  }

  mutate?.(rgba, alpha);

  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
};

const saveFixture = async (name: string, buffer: Buffer) => {
  await fs.promises.mkdir(artifactDir, { recursive: true });
  await fs.promises.writeFile(path.join(artifactDir, name), buffer);
};

async function main() {
  const { validateProtectedProductRegion } = await import("../src/services/productProtectionValidationService");
  const { __optiimstImageProcessingTestHooks } = await import("../src/services/imageProcessingService");
  const { assertVisibleProductImage } = __optiimstImageProcessingTestHooks;
  const source = await makeProduct();
  await saveFixture("source-product.png", source);

  const clean = await makeProduct();
  const cleanResult = await validateProtectedProductRegion({
    sourceProductBuffer: source,
    finalProductBuffer: clean,
    preserveMode: true
  });
  assert.equal(cleanResult.outcome, "PASS", "unchanged preserve product must pass");

  const labelChanged = await makeProduct((rgba, alpha) => {
    for (let y = 162; y <= 244; y += 1) {
      for (let x = 150; x <= 270; x += 1) {
        const pixel = y * width + x;
        if ((alpha[pixel] ?? 0) === 0) continue;
        const index = pixel * 4;
        rgba[index] = 245;
        rgba[index + 1] = 120;
        rgba[index + 2] = 108;
      }
    }
  });
  await saveFixture("label-changed.png", labelChanged);
  const labelResult = await validateProtectedProductRegion({
    sourceProductBuffer: source,
    finalProductBuffer: labelChanged,
    preserveMode: true
  });
  assert.equal(labelResult.outcome, "HARD_FAIL", "preserve mode must hard-fail label/product pixel changes");
  assert.ok(labelResult.failReasons.includes("Preserve mode product pixels changed"));

  const missingInterior = await makeProduct((rgba, alpha) => {
    for (let y = 178; y <= 250; y += 1) {
      for (let x = 180; x <= 238; x += 1) {
        const pixel = y * width + x;
        const index = pixel * 4;
        alpha[pixel] = 0;
        rgba[index + 3] = 0;
      }
    }
  });
  await saveFixture("missing-interior.png", missingInterior);
  const missingResult = await validateProtectedProductRegion({
    sourceProductBuffer: source,
    finalProductBuffer: missingInterior,
    preserveMode: true
  });
  assert.equal(missingResult.outcome, "HARD_FAIL", "missing interior product regions must fail");
  assert.ok(
    missingResult.failReasons.includes("Product silhouette changed beyond tolerance") ||
      missingResult.failReasons.includes("Label/text/branding detail was lost or degraded")
  );

  const striped = await makeProduct((rgba, alpha) => {
    for (let y = 82; y <= 340; y += 12) {
      for (let x = 130; x <= 290; x += 1) {
        const pixel = y * width + x;
        if ((alpha[pixel] ?? 0) === 0) continue;
        const index = pixel * 4;
        rgba[index] = 8;
        rgba[index + 1] = 8;
        rgba[index + 2] = 8;
      }
    }
  });
  await saveFixture("horizontal-stripes.png", striped);
  const stripeResult = await validateProtectedProductRegion({
    sourceProductBuffer: source,
    finalProductBuffer: striped,
    preserveMode: true
  });
  assert.equal(stripeResult.outcome, "HARD_FAIL", "horizontal stripe corruption must hard-fail");
  assert.ok(
    stripeResult.failReasons.includes("Horizontal stripe/scanline corruption detected") ||
      stripeResult.failReasons.includes("Preserve mode product pixels changed")
  );

  const sourceHasHorizontalProductLines = await validateProtectedProductRegion({
    sourceProductBuffer: striped,
    finalProductBuffer: striped,
    preserveMode: true
  });
  assert.equal(
    sourceHasHorizontalProductLines.outcome,
    "PASS",
    "source-locked product pixels with original horizontal detail must not be misclassified as new scanline corruption"
  );

  const flexibleChanged = await makeProduct((rgba, alpha) => {
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      if ((alpha[pixel] ?? 0) === 0) continue;
      const index = pixel * 4;
      rgba[index] = Math.min(255, Math.round((rgba[index] ?? 0) * 0.7 + 45));
      rgba[index + 1] = Math.min(255, Math.round((rgba[index + 1] ?? 0) * 0.55 + 20));
      rgba[index + 2] = Math.min(255, Math.round((rgba[index + 2] ?? 0) * 0.45 + 90));
    }
  });
  const flexibleResult = await validateProtectedProductRegion({
    sourceProductBuffer: source,
    finalProductBuffer: flexibleChanged,
    preserveMode: false
  });
  assert.notEqual(flexibleResult.outcome, "PASS", "flexible mode must flag major product identity drift");

  const neutralMultiPart = await makeProduct((rgba, alpha) => {
    for (let y = 118; y <= 150; y += 1) {
      for (let x = 54; x <= 112; x += 1) {
        const pixel = y * width + x;
        const index = pixel * 4;
        const cx = x - 83;
        const cy = y - 134;
        const ring = Math.abs(Math.hypot(cx, cy) - 20) <= 4;
        if (!ring) continue;
        alpha[pixel] = 255;
        rgba[index] = 48;
        rgba[index + 1] = 52;
        rgba[index + 2] = 58;
        rgba[index + 3] = 255;
      }
    }
  });
  await saveFixture("neutral-multi-part.png", neutralMultiPart);
  await assert.doesNotReject(
    () => assertVisibleProductImage(neutralMultiPart),
    "neutral detached spare-part components should remain acceptable"
  );

  const colouredDetachedArtifact = await makeProduct((rgba, alpha) => {
    for (let y = 258; y <= 338; y += 1) {
      for (let x = 304; x <= 408; x += 1) {
        const pixel = y * width + x;
        const index = pixel * 4;
        const localX = x - 352;
        const localY = y - 298;
        const wave = Math.sin(localX / 10) * 14;
        const inside =
          (localX * localX) / (52 * 52) + (localY * localY) / (24 * 24) <= 1.15 ||
          (localY > wave && localY < wave + 9 && localX > -6 && localX < 52);
        if (!inside) continue;
        alpha[pixel] = 255;
        rgba[index] = 214;
        rgba[index + 1] = 94;
        rgba[index + 2] = 12;
        rgba[index + 3] = 255;
      }
    }
  });
  await saveFixture("coloured-detached-artifact.png", colouredDetachedArtifact);
  await assert.rejects(
    () => assertVisibleProductImage(colouredDetachedArtifact),
    /detached coloured artifact/i,
    "a large saturated detached blob on a neutral product must be rejected"
  );

  const report = {
    artifactDir,
    clean: cleanResult.metrics,
    labelChanged: labelResult.metrics,
    missingInterior: missingResult.metrics,
    striped: stripeResult.metrics,
    sourceHasHorizontalProductLines: sourceHasHorizontalProductLines.metrics,
    flexibleChanged: flexibleResult.metrics
  };
  await fs.promises.writeFile(path.join(artifactDir, "validation-report.json"), JSON.stringify(report, null, 2));

  console.log(`Product protection validation checks passed. Artifacts: ${artifactDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
