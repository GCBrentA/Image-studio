import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

process.env.SUPABASE_PROJECT_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.VISION_QA_MODEL = "test-vision-model";

type ProductFixture = {
  id: string;
  label: string;
  svg: string;
};

type MatrixMode = {
  id: string;
  preserveProductExactly: boolean;
  processingMode: "seo_product_feed_preserve" | "standard_ecommerce_cleanup" | "premium_studio_background";
  background: string;
  backgroundImageBuffer?: Buffer;
  shadowMode: "off" | "under" | "behind";
  lightingStrength: "light" | "medium";
};

const fixtureDir = path.resolve("tmp", "image-processing-matrix-fixtures");
const artifactDir = path.resolve("tmp", "image-processing-matrix-artifacts");
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};

console.info = () => undefined;
console.warn = () => undefined;

const storageObjects = new Map<string, Buffer>();
const storageContentTypes = new Map<string, string>();

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });

const bufferFromBody = async (body: BodyInit | null | undefined): Promise<Buffer> => {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  return Buffer.from(String(body));
};

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? "GET").toUpperCase();

  if (url.includes("api.openai.com/v1/responses")) {
    return jsonResponse({
      output_text: JSON.stringify({
        passed: true,
        commerciallyUsable: true,
        failReasons: [],
        scores: {
          edgeCleanliness: 96,
          productPreservation: 100,
          textBrandingConsistency: 100,
          backgroundRemoval: 96,
          lightingNaturalness: 94,
          ecommerceQuality: 96
        },
        ocrComparison: {
          originalText: ["OPTIVRA"],
          finalText: ["OPTIVRA"],
          missingImportantText: [],
          alteredBranding: []
        },
        visibleProblems: [],
        summary: "Deterministic test QA pass."
      })
    });
  }

  if (url.includes("api.openai.com/v1/images/edits")) {
    const transparentCutout = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    }).png().toBuffer();

    return jsonResponse({
      data: [
        {
          b64_json: transparentCutout.toString("base64")
        }
      ]
    });
  }

  if (url.includes(".supabase.co/storage/v1/bucket/")) {
    return jsonResponse({ id: "test-bucket" });
  }

  if (url.includes(".supabase.co/storage/v1/object/sign/") && method === "POST") {
    const objectKey = decodeURIComponent(new URL(url).pathname.replace(/^\/storage\/v1\/object\/sign\//, ""));
    return jsonResponse({ signedURL: `/storage/v1/object/sign/${objectKey}?token=test` });
  }

  if (url.includes(".supabase.co/storage/v1/object/") && method === "POST") {
    const objectKey = decodeURIComponent(new URL(url).pathname.replace(/^\/storage\/v1\/object\//, ""));
    storageObjects.set(objectKey, await bufferFromBody(init?.body));
    storageContentTypes.set(objectKey, String((init?.headers as Record<string, string> | undefined)?.["content-type"] ?? ""));
    return jsonResponse({ Key: objectKey });
  }

  return jsonResponse({ error: `Unexpected fetch in image processing matrix: ${url}` }, 500);
}) as typeof fetch;

const productSvg = (body: string): string => `
  <svg width="720" height="720" viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
    <rect width="720" height="720" fill="none"/>
    <g font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${body}</g>
  </svg>
`;

const products: ProductFixture[] = [
  {
    id: "plain-bottle",
    label: "Plain bottle",
    svg: productSvg(`
      <rect x="305" y="110" width="110" height="75" rx="18" fill="#2f6fed"/>
      <rect x="250" y="178" width="220" height="385" rx="52" fill="#3f8cff"/>
      <rect x="287" y="285" width="146" height="102" rx="18" fill="#f7fbff"/>
      <text x="360" y="348" font-size="34" font-weight="700" fill="#1d3766">AQUA</text>`)
  },
  {
    id: "glossy-bottle",
    label: "Glossy bottle",
    svg: productSvg(`
      <rect x="296" y="98" width="128" height="88" rx="26" fill="#101820"/>
      <rect x="248" y="172" width="224" height="410" rx="62" fill="#131923"/>
      <path d="M305 190 C265 260 276 480 322 556" fill="none" stroke="#f4f8ff" stroke-width="26" opacity="0.28"/>
      <rect x="286" y="318" width="148" height="82" rx="16" fill="#d9b26f"/>
      <text x="360" y="370" font-size="28" font-weight="700" fill="#131923">LUX</text>`)
  },
  {
    id: "box-package",
    label: "Box/package",
    svg: productSvg(`
      <path d="M180 220 L384 130 L548 240 L342 350 Z" fill="#f0b43d"/>
      <path d="M180 220 L342 350 L342 585 L180 455 Z" fill="#d89022"/>
      <path d="M342 350 L548 240 L548 470 L342 585 Z" fill="#bf741c"/>
      <text x="360" y="430" font-size="42" font-weight="700" fill="#fff7de">BOX</text>`)
  },
  {
    id: "shoe",
    label: "Shoe",
    svg: productSvg(`
      <path d="M145 430 C230 430 268 318 373 348 C462 373 483 430 586 432 C618 433 632 462 610 490 C575 535 219 534 154 505 C120 490 116 448 145 430 Z" fill="#202735"/>
      <path d="M235 425 C272 365 323 330 388 354" fill="none" stroke="#6fd2ff" stroke-width="22"/>
      <rect x="180" y="490" width="410" height="38" rx="19" fill="#ffffff"/>
      <text x="390" y="455" font-size="30" font-weight="700" fill="#ffffff">RUN</text>`)
  },
  {
    id: "watch-jewellery",
    label: "Watch/jewellery",
    svg: productSvg(`
      <rect x="323" y="80" width="74" height="195" rx="24" fill="#7b6859"/>
      <circle cx="360" cy="360" r="125" fill="#d7d7d7"/>
      <circle cx="360" cy="360" r="92" fill="#111827"/>
      <line x1="360" y1="360" x2="360" y2="302" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
      <line x1="360" y1="360" x2="414" y2="386" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>
      <rect x="323" y="445" width="74" height="195" rx="24" fill="#7b6859"/>
      <text x="360" y="414" font-size="20" font-weight="700" fill="#ffffff">OPTI</text>`)
  },
  {
    id: "clothing-item",
    label: "Clothing item",
    svg: productSvg(`
      <path d="M250 170 L470 170 L570 270 L508 350 L470 318 L470 590 L250 590 L250 318 L212 350 L150 270 Z" fill="#5b7cfa"/>
      <rect x="302" y="198" width="116" height="64" rx="24" fill="#dbe6ff"/>
      <text x="360" y="405" font-size="42" font-weight="700" fill="#ffffff">TEE</text>`)
  },
  {
    id: "bag",
    label: "Bag",
    svg: productSvg(`
      <path d="M235 250 C238 145 482 145 485 250 L438 250 C430 196 290 196 282 250 Z" fill="#5f3f2d"/>
      <rect x="170" y="225" width="380" height="335" rx="46" fill="#9b6a48"/>
      <rect x="205" y="270" width="310" height="92" rx="24" fill="#bd8b63"/>
      <text x="360" y="430" font-size="38" font-weight="700" fill="#fff2e5">BAG</text>`)
  },
  {
    id: "electronics-item",
    label: "Electronics item",
    svg: productSvg(`
      <rect x="170" y="190" width="380" height="280" rx="34" fill="#1f2937"/>
      <rect x="205" y="225" width="310" height="200" rx="18" fill="#3be0d0"/>
      <rect x="210" y="470" width="300" height="68" rx="24" fill="#111827"/>
      <text x="360" y="342" font-size="38" font-weight="700" fill="#0f172a">TAB</text>`)
  },
  {
    id: "furniture-home-object",
    label: "Furniture/home object",
    svg: productSvg(`
      <rect x="185" y="230" width="350" height="190" rx="48" fill="#d8a15d"/>
      <rect x="220" y="405" width="280" height="118" rx="24" fill="#8c5934"/>
      <rect x="205" y="512" width="310" height="58" rx="20" fill="#8c5934"/>
      <path d="M226 280 C300 240 420 240 494 280" fill="none" stroke="#fff3df" stroke-width="22" opacity="0.45"/>
      <text x="360" y="350" font-size="34" font-weight="700" fill="#6d4328">HOME</text>`)
  },
  {
    id: "transparent-reflective",
    label: "Transparent/reflective product",
    svg: productSvg(`
      <path d="M275 140 L445 140 L512 570 L208 570 Z" fill="#9ee7ff" opacity="0.58" stroke="#63b7dc" stroke-width="18"/>
      <path d="M300 190 L345 530" stroke="#ffffff" stroke-width="22" opacity="0.5"/>
      <ellipse cx="360" cy="570" rx="152" ry="36" fill="#87cde7" opacity="0.68"/>
      <text x="360" y="388" font-size="36" font-weight="700" fill="#12607a">GLASS</text>`)
  }
];

const customBackgroundSvg = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#eef5f7"/>
    <rect y="720" width="1024" height="304" fill="#dce7ea"/>
  </svg>
`;

const matrixModes: MatrixMode[] = [
  { id: "pixel-perfect-seo-preset", preserveProductExactly: true, processingMode: "seo_product_feed_preserve", background: "optivra-default", shadowMode: "under", lightingStrength: "medium" },
  { id: "pixel-perfect-standard-white", preserveProductExactly: true, processingMode: "standard_ecommerce_cleanup", background: "white", shadowMode: "off", lightingStrength: "light" },
  { id: "pixel-perfect-premium-custom", preserveProductExactly: true, processingMode: "premium_studio_background", background: "optivra-default", backgroundImageBuffer: Buffer.from(customBackgroundSvg), shadowMode: "behind", lightingStrength: "medium" },
  { id: "pixel-perfect-transparent", preserveProductExactly: true, processingMode: "seo_product_feed_preserve", background: "transparent", shadowMode: "off", lightingStrength: "light" },
  { id: "flexible-seo-preset", preserveProductExactly: false, processingMode: "seo_product_feed_preserve", background: "optivra-default", shadowMode: "under", lightingStrength: "medium" },
  { id: "flexible-standard-grey", preserveProductExactly: false, processingMode: "standard_ecommerce_cleanup", background: "light-grey", shadowMode: "off", lightingStrength: "light" },
  { id: "flexible-premium-custom", preserveProductExactly: false, processingMode: "premium_studio_background", background: "optivra-default", backgroundImageBuffer: Buffer.from(customBackgroundSvg), shadowMode: "behind", lightingStrength: "medium" },
  { id: "flexible-transparent", preserveProductExactly: false, processingMode: "standard_ecommerce_cleanup", background: "transparent", shadowMode: "off", lightingStrength: "light" }
];

const toPng = async (svg: string): Promise<Buffer> =>
  sharp(Buffer.from(svg)).png().toBuffer();

const getUploadedObject = (bucket: string, objectPath: string | null): Buffer => {
  assert.ok(objectPath, `Expected ${bucket} storage path`);
  const key = `${bucket}/${objectPath}`;
  const buffer = storageObjects.get(key);
  assert.ok(buffer && buffer.byteLength > 0, `Expected uploaded object ${key}`);
  return buffer;
};

const assertValidProcessedImage = async (buffer: Buffer, label: string): Promise<void> => {
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.width, 1024, `${label}: output width should be 1024`);
  assert.equal(metadata.height, 1024, `${label}: output height should be 1024`);
  assert.ok(buffer.byteLength > 5_000, `${label}: processed image should not be empty`);
};

const assertValidCutoutImage = async (buffer: Buffer, label: string): Promise<void> => {
  const metadata = await sharp(buffer).metadata();
  assert.ok((metadata.width ?? 0) > 100, `${label}: cutout width should be valid`);
  assert.ok((metadata.height ?? 0) > 100, `${label}: cutout height should be valid`);
  assert.ok(buffer.byteLength > 3_000, `${label}: cutout should not be empty`);

  const alpha = await sharp(buffer).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  const visiblePixels = alpha.reduce((count, value) => count + (value >= 24 ? 1 : 0), 0);
  const coverage = visiblePixels / Math.max(1, alpha.length);
  assert.ok(coverage > 0.01, `${label}: cutout should contain visible product pixels`);
  assert.ok(coverage < 0.55, `${label}: cutout should not include the full source background`);
};

const assertPromptPolicy = (): void => {
  const backgroundRemoval = readFileSync("src/services/backgroundRemovalService.ts", "utf8");
  const imageProcessing = readFileSync("src/services/imageProcessingService.ts", "utf8");
  const admin = readFileSync("wordpress-plugin/optivra-image-studio-for-woocommerce/admin/class-catalogue-image-studio-admin.php", "utf8");

  for (const mode of ["seo_product_feed_preserve", "standard_ecommerce_cleanup", "premium_studio_background"]) {
    assert.ok(admin.includes(`'${mode}'`), `WordPress admin should expose processing mode ${mode}`);
  }

  assert.match(backgroundRemoval, /Do not alter the product\. Preserve the exact product pixels, shape, silhouette, design, logos, visible text, labels, colours, proportions/i);
  assert.match(backgroundRemoval, /Only the background\/environment may change according to the selected background settings/i);
  assert.match(backgroundRemoval, /Preserve the product identity and design/i);
  assert.match(backgroundRemoval, /Only minor adjustments needed for realistic background integration are allowed: subtle lighting harmonisation, soft shadow generation, slight edge blending, minor reflection adaptation/i);
  assert.match(backgroundRemoval, /User background settings:/);
  assert.doesNotMatch(backgroundRemoval, /freely redesign|make it look better however/i);

  assert.match(imageProcessing, /preserveProductExactly\s+\?\s+await processImagePreserveMode/);
  assert.match(imageProcessing, /:\s+await processImageFlexibleMode/);
  assert.match(imageProcessing, /const webpOptions = preserveProductExactly/);
  assert.match(imageProcessing, /quality: 100,\s+lossless: true/s);
  assert.match(imageProcessing, /if \(!preserveProductExactly\) {\s+const litProductBuffer = await applyProductLighting/s);
};

const resetDirectory = async (directory: string): Promise<void> => {
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(entries.map((entry) =>
    rm(path.join(directory, entry.name), {
      recursive: true,
      force: true
    })
  ));
};

const run = async (): Promise<void> => {
  const {
    buildOpenAiImagePrompt,
    buildProductImageProcessingPrompt
  } = await import("../src/services/backgroundRemovalService");
  const {
    __optiimstImageProcessingTestHooks,
    getExtremeFineDetailFailureMessage,
    processImageForProduct
  } = await import("../src/services/imageProcessingService");

  assertPromptPolicy();

  const strictPrompt = buildProductImageProcessingPrompt({
    preserveProductExactly: true,
    processingMode: "seo_product_feed_preserve",
    backgroundDescription: "custom brushed light-grey studio background with a soft floor plane"
  });
  assert.match(strictPrompt, /Do not alter the product/i);
  assert.match(strictPrompt, /exact product pixels/i);
  assert.match(strictPrompt, /logos, visible text, labels, colours, proportions/i);
  assert.match(strictPrompt, /Only the background\/environment may change/i);
  assert.match(strictPrompt, /custom brushed light-grey studio background/i);

  const flexiblePrompt = buildProductImageProcessingPrompt({
    preserveProductExactly: false,
    processingMode: "premium_studio_background",
    backgroundDescription: "warm premium studio background"
  });
  assert.match(flexiblePrompt, /Preserve the product identity and design/i);
  assert.match(flexiblePrompt, /Only minor adjustments/i);
  assert.match(flexiblePrompt, /edge blending/i);
  assert.match(flexiblePrompt, /Do not redesign, redraw, recolour/i);
  assert.match(flexiblePrompt, /warm premium studio background/i);

  for (const variant of [
    "seo_product_feed_preserve",
    "preserve_background_replacement",
    "standard_background_replacement",
    "premium_studio_background"
  ] as const) {
    const prompt = buildOpenAiImagePrompt(variant);
    assert.doesNotMatch(prompt, /freely redesign|invent new product/i, `${variant}: prompt should not permit product redesign`);
    assert.match(prompt, /Do not change the product|Preserve the product/i, `${variant}: prompt should preserve product`);
  }

  await resetDirectory(fixtureDir);
  await resetDirectory(artifactDir);

  const fixtureBuffers = new Map<string, Buffer>();
  for (const fixture of products) {
    const buffer = await toPng(fixture.svg);
    fixtureBuffers.set(fixture.id, buffer);
    await writeFile(path.join(fixtureDir, `${fixture.id}.png`), buffer);
  }

  assert.ok(products.length >= 10, "At least 10 normal product fixtures are required");
  assert.equal(matrixModes.length, 8, "The matrix should cover 3 processing modes, pixel-perfect on/off, preset/custom, and transparent backgrounds");

  const failures: string[] = [];
  const outputs: Array<{ fixtureId: string; modeId: string; status: string; artifact: string }> = [];

  for (const fixture of products) {
    const inputBuffer = fixtureBuffers.get(fixture.id);
    assert.ok(inputBuffer, `Missing generated fixture ${fixture.id}`);

    for (const mode of matrixModes) {
      const label = `${fixture.id}/${mode.id}`;
      try {
        const result = await processImageForProduct({
          imageJobId: `matrix-${fixture.id}-${mode.id}`,
          userId: "matrix-user",
          imageUrl: `uploaded://${fixture.id}.png`,
          imageBuffer: inputBuffer,
          imageContentType: "image/png",
          background: mode.background,
          backgroundImageBuffer: mode.backgroundImageBuffer,
          backgroundImageContentType: mode.backgroundImageBuffer ? "image/svg+xml" : undefined,
          settings: {
            preserveProductExactly: mode.preserveProductExactly,
            processingMode: mode.processingMode,
            promptVersion: "ecommerce_preserve_v2",
            autoFailIfProductAltered: mode.preserveProductExactly,
            preserveFallbackFromStrictMode: false,
            output: {
              size: 1024,
              aspectRatio: "1:1"
            },
            background: {
              source: mode.backgroundImageBuffer ? "custom" : mode.background === "transparent" ? "transparent" : "preset",
              preset: mode.background,
              customBackgroundUrl: null,
              customBackgroundId: mode.backgroundImageBuffer ? 9001 : null
            },
            framing: {
              mode: "auto",
              smartScaling: true,
              padding: 3,
              targetCoverage: 86,
              useTargetCoverage: false,
              preserveTransparentEdges: true
            },
            shadow: {
              mode: mode.shadowMode,
              strength: "medium",
              opacity: 24,
              blur: 24,
              offsetX: 0,
              offsetY: 0,
              spread: 100,
              softness: 60,
              color: "#000000"
            },
            lighting: {
              enabled: !mode.preserveProductExactly,
              mode: "auto",
              brightness: 0,
              contrast: 0,
              highlightRecovery: true,
              shadowLift: true,
              neutralizeTint: true,
              strength: mode.lightingStrength
            },
            debugArtifacts: true
          },
          jobOverrides: {
            productId: fixture.id,
            imageId: `${fixture.id}-main`,
            edgeToEdge: {
              enabled: false,
              left: false,
              right: false,
              top: false,
              bottom: false
            }
          }
        });

        assert.ok(result.processedStoragePath, `${label}: processed storage path is required`);
        assert.ok(result.outputValidation, `${label}: output validation is required`);
        assert.notEqual(result.outputValidation.status, "Failed", `${label}: normal product must not fail`);
        assert.equal(result.outputValidation.failureReasons.length, 0, `${label}: normal product should not return generic failure reasons`);
        assert.notEqual(result.processedUrl, "", `${label}: processed URL should be present`);

        if (mode.preserveProductExactly) {
          assert.ok(result.preserveDebug, `${label}: strict mode should include preserve debug data`);
          assert.equal(result.preserveDebug.rgbIntegrity.passed, true, `${label}: strict mode should preserve source pixels`);
          assert.equal(result.outputValidation.processingMode, "seo_product_feed_safe_preserve_background_replacement", `${label}: strict validation mode mismatch`);
          assert.equal(result.outputValidation.checks.protectedProduct, "Passed", `${label}: strict protected product check should pass`);
        } else {
          assert.equal(result.outputValidation.processingMode, "standard_background_replacement", `${label}: flexible validation mode mismatch`);
          assert.equal(result.outputValidation.checks.protectedProduct, "Passed", `${label}: flexible protected product check should pass`);
          assert.doesNotMatch(result.outputValidation.failureReasons.join(" "), /failed|could not generate|processing error/i, `${label}: flexible mode should not return generic give-up errors`);
        }

        const processed = getUploadedObject("processed-images", result.processedStoragePath);
        await assertValidProcessedImage(processed, label);
        const artifactPath = path.join(artifactDir, `${fixture.id}--${mode.id}.webp`);
        await writeFile(artifactPath, processed);
        outputs.push({
          fixtureId: fixture.id,
          modeId: mode.id,
          status: result.outputValidation.status,
          artifact: artifactPath
        });
      } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  assert.deepEqual(failures, [], `Normal product matrix failures:\n${failures.join("\n")}`);
  assert.equal(outputs.length, products.length * matrixModes.length, "Every normal product/mode combination should produce output");

  const fallbackCutout = await __optiimstImageProcessingTestHooks.buildFlexibleFullSourceReviewCutout(
    fixtureBuffers.get("plain-bottle") ?? Buffer.alloc(0),
    ["AI mask reason: forced matrix fallback.", "Local fallback reason: forced matrix fallback."]
  );
  assert.match(fallbackCutout.provider, /flexible-full-source-review-fallback/);
  await assertValidProcessedImage(
    await sharp(fallbackCutout.cutout).webp({ quality: 92 }).toBuffer(),
    "forced full-source fallback"
  );

  const greyRetainerSource = await toPng(`
    <svg width="720" height="720" viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="metal" cx="38%" cy="30%" r="72%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="42%" stop-color="#d9dde0"/>
          <stop offset="100%" stop-color="#787d82"/>
        </radialGradient>
      </defs>
      <rect width="720" height="720" fill="#8d8f8f"/>
      <circle cx="360" cy="360" r="244" fill="none" stroke="#6f7272" stroke-width="34" opacity="0.32"/>
      <circle cx="360" cy="360" r="164" fill="none" stroke="#737676" stroke-width="22" opacity="0.24"/>
      <text x="360" y="318" font-family="Arial, Helvetica, sans-serif" text-anchor="middle" font-size="42" font-weight="700" fill="#6f7272" opacity="0.34">AZTECH</text>
      <text x="360" y="378" font-family="Arial, Helvetica, sans-serif" text-anchor="middle" font-size="36" font-weight="700" fill="#6f7272" opacity="0.28">ARMOURY</text>
      <g transform="translate(210 295) rotate(-5)">
        <ellipse cx="0" cy="0" rx="79" ry="63" fill="url(#metal)" stroke="#f7f7f7" stroke-width="12"/>
        <ellipse cx="0" cy="0" rx="35" ry="29" fill="#0e1114"/>
        <ellipse cx="-18" cy="-14" rx="21" ry="13" fill="#ffffff" opacity="0.82"/>
        <ellipse cx="-4" cy="-3" rx="10" ry="8" fill="#161b22" opacity="0.85"/>
      </g>
      <g transform="translate(485 296) rotate(8)">
        <ellipse cx="0" cy="0" rx="76" ry="61" fill="url(#metal)" stroke="#f9f9f9" stroke-width="12"/>
        <ellipse cx="0" cy="0" rx="33" ry="28" fill="#0d1014"/>
        <ellipse cx="-16" cy="-13" rx="20" ry="13" fill="#ffffff" opacity="0.82"/>
        <ellipse cx="-3" cy="-2" rx="10" ry="8" fill="#161b22" opacity="0.85"/>
      </g>
    </svg>
  `);
  const greyRetainerCutout = await __optiimstImageProcessingTestHooks.buildFlexibleLocalForegroundCutout(
    greyRetainerSource,
    "matrix-local-grey-retainer-regression",
    1
  );
  assert.equal(greyRetainerCutout.provider, "matrix-local-grey-retainer-regression");
  await assertValidCutoutImage(greyRetainerCutout.cutout, "grey branded retainer local fallback");
  await writeFile(path.join(fixtureDir, "grey-branded-retainer-source.png"), greyRetainerSource);
  await writeFile(path.join(artifactDir, "grey-branded-retainer-local-cutout.png"), greyRetainerCutout.cutout);

  const extremeMessage = getExtremeFineDetailFailureMessage([
    "Preserve mode rejected the mask because grass and hair-like fibers are entangled with a visually similar background.",
    "too many connected components around mesh fringe"
  ]);
  assert.ok(extremeMessage, "Extreme fine-detail failures should receive a controlled message");
  assert.match(extremeMessage, /very fine product\/background detail interaction/i);
  assert.match(extremeMessage, /cleaner source photo/i);
  assert.doesNotMatch(extremeMessage, /failed|processing error|could not generate/i);

  await writeFile(
    path.join(artifactDir, "matrix-summary.json"),
    JSON.stringify({
      products: products.map(({ id, label }) => ({ id, label })),
      modes: matrixModes.map(({ id, preserveProductExactly, processingMode, background, shadowMode }) => ({
        id,
        preserveProductExactly,
        processingMode,
        background,
        shadowMode
      })),
      combinations: outputs.length,
      outputs
    }, null, 2)
  );

  originalConsole.log(`Image processing matrix passed: ${products.length} products x ${matrixModes.length} modes = ${outputs.length} outputs.`);
  originalConsole.log(`Artifacts: ${artifactDir}`);
};

run().catch((error) => {
  originalConsole.error(error);
  process.exit(1);
});
