import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

process.env.SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL || "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";

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
const artifactDir = path.resolve("tmp", "real-jarvis-flexible-openai");

const products = [
  "aztech-adjustable-spring-retainer-aztech-innovations-aeg-upgrade-collection-4-lu-6.webp",
  "aztech-adjustable-spring-retainer-aztech-innovations-aeg-upgrade-collection-4-lu-7.webp",
  "aztech-magazine-terminal-block-for-scythe-box-spare-parts-gearbox-parts-aztech-374087.jpg",
  "aztech-hardened-hybrid-anti-reverse-latch-aztech-innovations-aeg-upgrade-collect.webp",
  "aztech-air-pressure-activated-cylinder-head-engine-apache-spare-parts-gearbox-parts-aztech-115711.jpg",
  "aztech-air-pressure-activated-cylinder-head-engine-apache-spare-parts-gearbox-parts-aztech-275060.jpg",
  "aztech-cnc-range-warrior-barrel-fit-hop-up-spare-parts-aztech-231777.jpg",
  "aztech-accu-port-cnc-piston-head-spare-parts-gearbox-parts-aztech-418168.jpg"
] as const;

const storageKey = (bucket: string, objectPath: string | null): string => {
  assert.ok(objectPath, "Expected a storage object path");
  return `${bucket}/${objectPath}`;
};

const getStoredObject = (bucket: string, objectPath: string | null): Buffer => {
  const key = storageKey(bucket, objectPath);
  const object = storageObjects.get(key);
  assert.ok(object, `Missing stored object: ${key}`);
  return object;
};

const buildContactSheet = async (rows: Array<{ original: Buffer; processed: Buffer; label: string }>): Promise<Buffer> => {
  const cellWidth = 320;
  const cellHeight = 380;
  const labelHeight = 42;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const original = await sharp(row.original)
      .rotate()
      .resize(150, cellHeight - labelHeight, { fit: "inside", background: "#f7f7f4" })
      .png()
      .toBuffer();
    const processed = await sharp(row.processed)
      .resize(150, cellHeight - labelHeight, { fit: "inside", background: "#f7f7f4" })
      .png()
      .toBuffer();
    const label = Buffer.from(`
      <svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="8" y="17" font-size="12" fill="#111">${index + 1}. ${row.label.slice(0, 42)}</text>
        <text x="8" y="34" font-size="11" fill="#555">original -> processed flexible OpenAI</text>
      </svg>
    `);
    const tile = await sharp({
      create: {
        width: cellWidth,
        height: cellHeight,
        channels: 4,
        background: "#ffffff"
      }
    })
      .composite([
        { input: original, left: 8, top: 0 },
        { input: processed, left: 162, top: 0 },
        { input: label, left: 0, top: cellHeight - labelHeight }
      ])
      .png()
      .toBuffer();

    composites.push({
      input: tile,
      left: (index % 2) * cellWidth,
      top: Math.floor(index / 2) * cellHeight
    });
  }

  return sharp({
    create: {
      width: cellWidth * 2,
      height: Math.ceil(rows.length / 2) * cellHeight,
      channels: 4,
      background: "#ffffff"
    }
  })
    .composite(composites)
    .png()
    .toBuffer();
};

const run = async (): Promise<void> => {
  const { processImageForProduct } = await import("../src/services/imageProcessingService");
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });

  const rows: Array<{ original: Buffer; processed: Buffer; label: string }> = [];
  const summary: Array<{
    file: string;
    status: string;
    provider: string;
    processedPath: string;
    artifact: string;
    warnings: string[];
    failureReasons: string[];
  }> = [];

  for (const file of products) {
    const sourcePath = path.join(uploadDir, file);
    const source = await readFile(sourcePath);
    const result = await processImageForProduct({
      imageJobId: `real-flex-openai-${file.replace(/[^a-z0-9]+/gi, "-").slice(0, 70)}`,
      userId: "real-jarvis",
      imageUrl: `file://${sourcePath.replace(/\\/g, "/")}`,
      imageBuffer: source,
      imageContentType: file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg",
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
        productId: file,
        imageId: `${file}-main`,
        edgeToEdge: { enabled: false, left: false, right: false, top: false, bottom: false }
      }
    });

    assert.ok(result.outputValidation, `${file}: output validation missing`);
    assert.equal(result.outputValidation.status, "Passed", `${file}: expected Passed, got ${result.outputValidation.status}: ${result.outputValidation.failureReasons.join("; ")}`);
    assert.match(result.outputValidation.cutoutProvider, /flexible-studio-final|source-alpha|flexible-preserve-source-mask|imgly/, `${file}: unexpected provider`);
    const processed = getStoredObject("processed-images", result.processedStoragePath);
    await sharp(processed).metadata();
    const artifactPath = path.join(artifactDir, `${file.replace(/\.[a-z0-9]+$/i, "")}--processed.webp`);
    await writeFile(artifactPath, processed);
    await writeFile(path.join(artifactDir, `${file.replace(/\.[a-z0-9]+$/i, "")}--original${path.extname(file)}`), source);
    rows.push({ original: source, processed, label: file });
    summary.push({
      file,
      status: result.outputValidation.status,
      provider: result.outputValidation.cutoutProvider,
      processedPath: result.processedStoragePath ?? "",
      artifact: artifactPath,
      warnings: result.outputValidation.warnings,
      failureReasons: result.outputValidation.failureReasons
    });
  }

  const contactSheet = await buildContactSheet(rows);
  await writeFile(path.join(artifactDir, "contact-sheet.png"), contactSheet);
  await writeFile(path.join(artifactDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`Real Jarvis flexible OpenAI recovery passed for ${summary.length} images.`);
  console.log(`Artifacts: ${artifactDir}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
