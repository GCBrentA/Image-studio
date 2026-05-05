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
const artifactBaseDir = path.resolve("tmp", "real-jarvis-modes");

const products = [
  "aztech-adjustable-spring-retainer-aztech-innovations-aeg-upgrade-collection-4-lu-6.webp",
  "aztech-adjustable-spring-retainer-aztech-innovations-aeg-upgrade-collection-4-lu-7.webp",
  "aztech-innovations-patch-accessories-aztech-167158.jpg",
  "aztech-magazine-terminal-block-for-scythe-box-spare-parts-gearbox-parts-aztech-374087.jpg",
  "aztech-hardened-hybrid-anti-reverse-latch-aztech-innovations-aeg-upgrade-collect.webp",
  "aztech-air-pressure-activated-cylinder-head-engine-apache-spare-parts-gearbox-parts-aztech-115711.jpg",
  "aztech-air-pressure-activated-cylinder-head-engine-apache-spare-parts-gearbox-parts-aztech-275060.jpg",
  "aztech-cnc-range-warrior-barrel-fit-hop-up-spare-parts-aztech-231777.jpg",
  "aztech-accu-port-cnc-piston-head-spare-parts-gearbox-parts-aztech-418168.jpg",
  "dsg-dual-sector-gear-spare-parts-chainsaw-products-868470.jpg",
  "aps-gbb-nozzle-spring-for-co2-pistol-spare-parts-aps-271842.jpg",
  "cnc-aluminum-double-o-ring-cylinder-head-spare-parts-chainsaw-products-202300.jpg"
] as const;

type ModeCase = {
  name: string;
  preserveProductExactly: boolean;
  background: string;
  lighting: boolean;
};

const allModes: ModeCase[] = [
  { name: "exact-white", preserveProductExactly: true, background: "white", lighting: false },
  { name: "exact-light-grey", preserveProductExactly: true, background: "light-grey", lighting: false },
  { name: "exact-transparent", preserveProductExactly: true, background: "transparent", lighting: false },
  { name: "flex-white", preserveProductExactly: false, background: "white", lighting: true },
  { name: "flex-light-grey", preserveProductExactly: false, background: "light-grey", lighting: true },
  { name: "flex-premium-studio", preserveProductExactly: false, background: "soft-white", lighting: true }
];

const quickModes: ModeCase[] = [
  { name: "exact-white", preserveProductExactly: true, background: "white", lighting: false },
  { name: "flex-white", preserveProductExactly: false, background: "white", lighting: true }
];

const contentTypeFor = (file: string): string =>
  file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg";

const extensionForContentType = (contentType: string): string =>
  contentType.includes("json") ? ".json" : contentType.includes("webp") ? ".webp" : contentType.includes("jpeg") ? ".jpg" : ".png";

const safeName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const getStoredObject = (bucket: string, objectPath: string | null): Buffer | null => {
  if (!objectPath) return null;
  return storageObjects.get(`${bucket}/${objectPath}`) ?? null;
};

const writeStoredObjectsForJob = async (jobId: string, jobDir: string): Promise<Array<{ key: string; path: string }>> => {
  const written: Array<{ key: string; path: string }> = [];
  const prefix = `/${jobId.toLowerCase()}/`;

  for (const [key, value] of storageObjects.entries()) {
    if (!key.toLowerCase().includes(prefix)) {
      continue;
    }

    const fileName = safeName(key).slice(-180);
    const contentType = key.endsWith(".json") ? "application/json" : key.endsWith(".webp") ? "image/webp" : "image/png";
    const target = path.join(jobDir, `${fileName}${extensionForContentType(contentType)}`);
    await writeFile(target, value);
    written.push({ key, path: target });
  }

  return written;
};

const buildContactSheet = async (rows: Array<{ original: Buffer; processed?: Buffer; label: string; status: string }>): Promise<Buffer> => {
  const cellWidth = 360;
  const cellHeight = 330;
  const labelHeight = 58;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const original = await sharp(row.original)
      .rotate()
      .resize(150, cellHeight - labelHeight, { fit: "inside", background: "#f7f7f4" })
      .png()
      .toBuffer();
    const processed = row.processed
      ? await sharp(row.processed)
        .resize(170, cellHeight - labelHeight, { fit: "inside", background: "#f7f7f4" })
        .png()
        .toBuffer()
      : Buffer.from(`
        <svg width="170" height="${cellHeight - labelHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#fff4f4"/>
          <text x="12" y="120" font-size="14" fill="#b91c1c">FAILED</text>
        </svg>
      `);
    const label = Buffer.from(`
      <svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="8" y="17" font-size="12" fill="#111">${index + 1}. ${row.label.slice(0, 47)}</text>
        <text x="8" y="36" font-size="12" fill="${row.status === "Passed" ? "#15803d" : "#b91c1c"}">${row.status}</text>
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
        { input: processed, left: 178, top: 0 },
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
  const quick = process.argv.includes("--quick");
  const exactOnly = process.argv.includes("--exact-only");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1])) : undefined;
  const selectedProducts = (quick ? products.slice(0, 5) : products).slice(0, limit);
  const selectedModes = exactOnly
    ? allModes.filter((mode) => mode.preserveProductExactly)
    : quick
      ? quickModes
      : allModes;

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactDir = path.join(artifactBaseDir, runId);
  await mkdir(artifactBaseDir, { recursive: true });
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });

  const summary: Array<Record<string, unknown>> = [];
  const rows: Array<{ original: Buffer; processed?: Buffer; label: string; status: string }> = [];

  for (const file of selectedProducts) {
    const sourcePath = path.join(uploadDir, file);
    const source = await readFile(sourcePath);
    const originalOut = path.join(artifactDir, `${safeName(file)}--original${path.extname(file)}`);
    await writeFile(originalOut, source);

    for (const mode of selectedModes) {
      const jobId = `real-${mode.name}-${safeName(file).slice(0, 72)}`;
      const jobDir = path.join(artifactDir, safeName(jobId));
      await mkdir(jobDir, { recursive: true });
      let processed: Buffer | undefined;
      let status = "Failed";
      let provider = "";
      let warnings: string[] = [];
      let failureReasons: string[] = [];
      let debugAssets: unknown[] = [];
      let errorMessage = "";

      try {
        const result = await processImageForProduct({
          imageJobId: jobId,
          userId: "real-jarvis",
          imageUrl: `https://jarvis-test.local/wp-content/uploads/2026/04/${file}`,
          imageBuffer: source,
          imageContentType: contentTypeFor(file),
          background: mode.background,
          settings: {
            preserveProductExactly: mode.preserveProductExactly,
            processingMode: mode.name === "flex-premium-studio" ? "premium_studio_background" : "standard_background_replacement",
            promptVersion: "ecommerce_preserve_v2",
            output: {
              size: 1024,
              aspectRatio: "1:1"
            },
            background: {
              source: "preset",
              preset: mode.background
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
              mode: mode.background === "transparent" ? "off" : "under",
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
              enabled: mode.lighting,
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
            imageId: `${file}-${mode.name}`,
            edgeToEdge: { enabled: false, left: false, right: false, top: false, bottom: false }
          }
        });

        status = result.outputValidation?.status ?? "Missing validation";
        provider = result.outputValidation?.cutoutProvider ?? "";
        warnings = result.outputValidation?.warnings ?? [];
        failureReasons = result.outputValidation?.failureReasons ?? [];
        debugAssets = result.outputValidation?.debugAssets ?? [];
        processed = getStoredObject("processed-images", result.processedStoragePath) ?? undefined;
        assert.ok(processed, `${file} ${mode.name}: processed object was not written`);
        await writeFile(path.join(jobDir, "final-output.webp"), processed);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        failureReasons = [errorMessage];
      }

      const writtenAssets = await writeStoredObjectsForJob(jobId, jobDir);
      const caseSummary = {
        file,
        mode: mode.name,
        preserveProductExactly: mode.preserveProductExactly,
        background: mode.background,
        status,
        provider,
        warnings,
        failureReasons,
        errorMessage,
        jobDir,
        debugAssetCount: debugAssets.length,
        localAssetCount: writtenAssets.length
      };
      summary.push(caseSummary);
      await writeFile(path.join(jobDir, "case-summary.json"), JSON.stringify(caseSummary, null, 2));
      rows.push({
        original: source,
        processed,
        label: `${mode.name} ${file}`,
        status
      });
      console.log(`${status}: ${mode.name} ${file}${failureReasons.length ? ` - ${failureReasons.join("; ")}` : ""}`);
    }
  }

  await writeFile(path.join(artifactDir, "summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(path.join(artifactDir, "contact-sheet.png"), await buildContactSheet(rows));

  const failed = summary.filter((item) => item.status !== "Passed");
  console.log(`Real Jarvis mode suite complete: ${summary.length - failed.length}/${summary.length} passed.`);
  console.log(`Artifacts: ${artifactDir}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
