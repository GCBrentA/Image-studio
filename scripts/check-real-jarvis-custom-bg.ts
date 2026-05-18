import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
const artifactBaseDir = path.resolve("scripts", "tmp", "real-jarvis-custom-bg");
const customBackgroundName = "Light-azraels-default-background.png";

const products = [
  "aztech-magazine-terminal-block-for-scythe-box-spare-parts-gearbox-parts-aztech-374087.jpg",
  "aps-gbb-nozzle-spring-for-co2-pistol-spare-parts-aps-271842.jpg",
  "aztech-innovations-patch-accessories-aztech-167158.jpg"
] as const;

const contentTypeFor = (file: string): string =>
  file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg";

const getStoredObject = (bucket: string, objectPath: string | null): Buffer => {
  assert.ok(objectPath, "Expected a storage object path");
  const object = storageObjects.get(`${bucket}/${objectPath}`);
  assert.ok(object, `Missing stored object: ${bucket}/${objectPath}`);
  return object;
};

const extensionForStorageKey = (key: string): string =>
  key.endsWith(".json") ? ".json" : key.endsWith(".webp") ? ".webp" : ".png";

const safeName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const writeStoredObjectsForJob = async (jobId: string, jobDir: string): Promise<void> => {
  const prefix = `/${jobId.toLowerCase()}/`;

  for (const [key, value] of storageObjects.entries()) {
    if (!key.toLowerCase().includes(prefix)) {
      continue;
    }

    const target = path.join(jobDir, `${safeName(key).slice(-180)}${extensionForStorageKey(key)}`);
    await writeFile(target, value);
  }
};

const run = async (): Promise<void> => {
  const { processImageForProduct } = await import("../src/services/imageProcessingService");
  const customBackgroundPath = path.join(uploadDir, customBackgroundName);
  const backgroundBuffer = await readFile(customBackgroundPath);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactDir = path.join(artifactBaseDir, runId);
  await mkdir(artifactBaseDir, { recursive: true });
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });
  const summary: Array<Record<string, unknown>> = [];

  for (const file of products) {
    const sourcePath = path.join(uploadDir, file);
    const source = await readFile(sourcePath);
    const jobId = `real-custom-bg-${file.replace(/[^a-z0-9]+/gi, "-").slice(0, 70)}`;
    const jobDir = path.join(artifactDir, safeName(jobId));
    await mkdir(jobDir, { recursive: true });
    const result = await processImageForProduct({
      imageJobId: jobId,
      userId: "real-jarvis",
      imageUrl: `https://jarvis-test.local/wp-content/uploads/2026/04/${file}`,
      imageBuffer: source,
      imageContentType: contentTypeFor(file),
      background: "custom",
      backgroundImageUrl: `https://jarvis-test.local/wp-content/uploads/2026/04/${customBackgroundName}`,
      backgroundImageBuffer: backgroundBuffer,
      backgroundImageContentType: "image/png",
      settings: {
        preserveProductExactly: false,
        processingMode: "standard_background_replacement",
        promptVersion: "ecommerce_preserve_v2",
        output: {
          size: 1024,
          aspectRatio: "1:1"
        },
        background: {
          source: "custom",
          preset: "custom",
          customBackgroundUrl: `https://jarvis-test.local/wp-content/uploads/2026/04/${customBackgroundName}`
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
          mode: "behind",
          strength: "medium",
          opacity: 18,
          blur: 26,
          offsetX: 0,
          offsetY: 0,
          spread: 96,
          softness: 72,
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
        productId: file,
        imageId: `${file}-custom-bg`,
        edgeToEdge: { enabled: false, left: false, right: false, top: false, bottom: false }
      }
    });

    const processed = getStoredObject("processed-images", result.processedStoragePath);
    const artifactPath = path.join(artifactDir, `${file.replace(/\.[a-z0-9]+$/i, "")}--processed.webp`);
    await writeFile(artifactPath, processed);
    await writeFile(path.join(jobDir, "final-output.webp"), processed);
    await writeStoredObjectsForJob(jobId, jobDir);
    summary.push({
      file,
      provider: result.outputValidation?.cutoutProvider,
      status: result.outputValidation?.status,
      warnings: result.outputValidation?.warnings ?? [],
      failureReasons: result.outputValidation?.failureReasons ?? [],
      artifact: artifactPath
    });
  }

  await writeFile(path.join(artifactDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ artifactDir, summary }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
