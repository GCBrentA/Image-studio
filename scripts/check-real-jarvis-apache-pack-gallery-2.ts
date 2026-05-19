import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const envDefaults: Record<string, string> = {
  SUPABASE_PROJECT_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
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

const nativeFetch = globalThis.fetch.bind(globalThis);
const storageObjects = new Map<string, Buffer>();

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

  if (url.includes("example.supabase.co/storage/v1/bucket/")) {
    return jsonResponse({ id: "test-bucket" });
  }

  if (url.includes("example.supabase.co/storage/v1/object/sign/")) {
    const storagePath = decodeURIComponent(url.split("/storage/v1/object/sign/")[1] ?? "");
    return jsonResponse({ signedURL: `/storage/v1/object/sign/${storagePath}?token=test` });
  }

  if (url.includes("example.supabase.co/storage/v1/object/") && method === "POST") {
    const storagePath = decodeURIComponent(url.split("/storage/v1/object/")[1] ?? "");
    storageObjects.set(storagePath, await bufferFromBody(init?.body));
    return jsonResponse({ Key: storagePath });
  }

  return nativeFetch(input, init);
}) as typeof fetch;

const uploadDir = "C:/Users/brent/Local Sites/jarvis-test/app/public/wp-content/uploads/2026/04";
const artifactRootDir = path.resolve("tmp", "real-jarvis-apache-pack-gallery-2");
const sourceFile = "apache-pack-upgrades-aztech-innovations-5185702.jpg";

const countDarkPixelsInRegion = async (
  imageBuffer: Buffer,
  region: { minX: number; minY: number; maxX: number; maxY: number }
): Promise<number> => {
  const { data, info } = await sharp(imageBuffer)
    .resize(1024, 1024, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let darkPixels = 0;

  for (let y = region.minY; y <= Math.min(region.maxY, info.height - 1); y += 1) {
    for (let x = region.minX; x <= Math.min(region.maxX, info.width - 1); x += 1) {
      const index = (y * info.width + x) * info.channels;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luminance < 115) {
        darkPixels += 1;
      }
    }
  }

  return darkPixels;
};

async function main() {
  const imageProcessingModule = await import("../src/services/imageProcessingService");
  const imageProcessingExports =
    (imageProcessingModule as { default?: Record<string, unknown> }).default && typeof imageProcessingModule.default === "object"
      ? imageProcessingModule.default
      : imageProcessingModule;
  const processImageForProduct = (imageProcessingExports as { processImageForProduct?: Function }).processImageForProduct;
  assert.ok(processImageForProduct, "processImageForProduct export should be available");

  const source = await readFile(path.join(uploadDir, sourceFile));
  const artifactDir = path.join(artifactRootDir, new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(artifactDir, { recursive: true });

  const startedAt = Date.now();
  const result = await processImageForProduct({
    imageJobId: "real-apache-pack-gallery-2",
    userId: "real-jarvis",
    imageUrl: `https://jarvis-test.local/wp-content/uploads/2026/04/${sourceFile}`,
    imageBuffer: source,
    imageContentType: "image/jpeg",
    background: "soft-white",
    settings: {
      preserveProductExactly: false,
      processingMode: "standard_background_replacement",
      promptVersion: "ecommerce_preserve_v2",
      output: {
        size: 1024,
        aspectRatio: "1:1"
      },
      background: {
        source: "preset",
        preset: "soft-white"
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
        mode: "under",
        strength: "medium",
        opacity: 20,
        blur: 26,
        offsetX: 0,
        offsetY: 0,
        spread: 96,
        softness: 70,
        color: "#000000"
      },
      lighting: {
        enabled: true,
        mode: "auto",
        brightness: 0,
        contrast: 0,
        highlightRecovery: true,
        shadowLift: true,
        neutralizeTint: true,
        strength: "light"
      },
      debugArtifacts: true
    },
    jobOverrides: {
      productId: "178",
      imageId: "254-gallery-2",
      edgeToEdge: { enabled: false, left: false, right: false, top: false, bottom: false }
    }
  });
  const elapsedMs = Date.now() - startedAt;

  const processedPath = result.processedStoragePath;
  assert.ok(processedPath, "processed storage path should be returned");
  const processed = storageObjects.get(`processed-images/${processedPath}`);
  assert.ok(processed, "processed image should be uploaded to storage");
  await writeFile(path.join(artifactDir, "final-output.webp"), processed);

  for (const [key, value] of storageObjects.entries()) {
    if (!key.toLowerCase().includes("/real-apache-pack-gallery-2/")) {
      continue;
    }
    await writeFile(path.join(artifactDir, key.replace(/[\\/:*?\"<>|]/g, "-")), value);
  }

  assert.equal(result.outputValidation?.status, "Passed", `APACHE Pack gallery #2 should pass: ${(result.outputValidation?.failureReasons ?? []).join("; ")}`);
  assert.ok(
    result.outputValidation?.cutoutProvider === "local-source-analysis-consensus:flexible-source-pixel-first" ||
    result.outputValidation?.cutoutProvider === "local-color-segmentation:flexible-source-pixel-first" ||
    result.outputValidation?.cutoutProvider === "specialist-source-pixel-segmentation:flexible-cutout" ||
    result.outputValidation?.cutoutProvider === "ai-alpha-guided-source-pixel:flexible-cutout",
    `APACHE Pack gallery #2 should stay on a source-locked matte path, got ${result.outputValidation?.cutoutProvider}`
  );
  assert.ok(elapsedMs < 180000, `APACHE Pack gallery #2 should finish well under the WordPress 240s timeout (${elapsedMs} ms)`);

  const topLeftBrandingDarkPixels = await countDarkPixelsInRegion(processed, { minX: 20, minY: 20, maxX: 430, maxY: 360 });
  assert.ok(topLeftBrandingDarkPixels < 24000, `Top-left branded backdrop should be removed from final image (${topLeftBrandingDarkPixels} dark pixels)`);

  console.log(`APACHE Pack gallery #2 regression passed in ${elapsedMs} ms. Artifacts: ${artifactDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
