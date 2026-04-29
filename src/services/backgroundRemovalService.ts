import { spawn } from "child_process";
import { env } from "../config/env";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

export type BackgroundRemovalMode = "preserve-mask" | "preserve-mask-refined" | "flexible-cutout";

const preserveMaskPrompt =
  "Create an exact ecommerce product cutout from this image. Use the image only for foreground segmentation and background removal. Preserve the visible product exactly: shape, proportions, colours, logos, markings, rails, triggers, holes, vents, sights, nozzles, transparent or translucent parts, textures, materials, and all fine contours. Do not redraw, beautify, smooth, enhance, relight, recolour, invent, remove, or alter any part of the product. Remove only background, floor, wall, table, and non-product clutter. Keep true internal openings transparent. Return a transparent-background PNG whose alpha channel isolates only the product.";

const preserveMaskRefinedPrompt =
  "Perform only professional product foreground segmentation. Return a transparent PNG alpha cutout that isolates the real product from the supplied image. Do not generate, redraw, repair, stylize, relight, recolour, or reinterpret the product. Keep thin rails, trigger guards, holes, vents, sights, nozzles, logos, markings, translucent sections, small accessories, and internal openings exactly as segmentation requires. If uncertain, prefer a conservative transparent cutout over inventing product pixels.";

const flexibleCutoutPrompt =
  "Create a precise ecommerce product alpha mask/cutout from this image. Isolate only the actual product object. Preserve the product as much as possible. Remove all background, floor, wall, table, shadows, reflections, glare patches, gaps, holes, empty spaces between parts, and background visible through openings in the product. Return a clean transparent-background PNG with only the product foreground isolated, no added objects and no background remnants.";

const getPromptForMode = (mode: BackgroundRemovalMode): string => {
  switch (mode) {
    case "preserve-mask":
      return preserveMaskPrompt;
    case "preserve-mask-refined":
      return preserveMaskRefinedPrompt;
    case "flexible-cutout":
    default:
      return flexibleCutoutPrompt;
  }
};

export const removeImageBackground = async (
  imageBuffer: Buffer,
  mode: BackgroundRemovalMode = "flexible-cutout"
): Promise<Buffer> => {
  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const formData = new FormData();
  formData.append(
    "image",
    new Blob([new Uint8Array(imageBuffer)], {
      type: "image/png"
    }),
    "product.png"
  );
  formData.append("model", "gpt-image-1");
  formData.append("prompt", getPromptForMode(mode));
  formData.append("background", "transparent");
  formData.append("input_fidelity", "high");
  formData.append("output_format", "png");
  formData.append("quality", "high");
  formData.append("size", "1024x1024");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openAiApiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(`OpenAI background removal failed with ${response.status}: ${responseBody}`);
  }

  const body = await response.json() as {
    data?: Array<{
      b64_json?: string;
    }>;
  };
  const imageBase64 = body.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI background removal did not return image data");
  }

  return Buffer.from(imageBase64, "base64");
};

export const removeImageBackgroundWithSpecialistModel = async (
  imageBuffer: Buffer,
  contentType = "image/jpeg"
): Promise<Buffer> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "optivra-imgly-"));
  const inputPath = path.join(tempDir, "source-image");
  const outputPath = path.join(tempDir, "foreground.png");
  const workerPath = path.resolve(process.cwd(), "scripts", "imgly-background-removal-worker.js");

  try {
    await writeFile(inputPath, imageBuffer);
    await runSpecialistWorker(workerPath, inputPath, outputPath, contentType);

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true
    }).catch(() => undefined);
  }
};

const runSpecialistWorker = (
  workerPath: string,
  inputPath: string,
  outputPath: string,
  contentType: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath, inputPath, outputPath, contentType], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Specialist background-removal worker timed out."));
    }, 180000);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve();
        return;
      }

      const message = Buffer.concat(stderr).toString("utf8").trim() ||
        Buffer.concat(stdout).toString("utf8").trim() ||
        `Specialist background-removal worker exited with code ${code ?? "unknown"}.`;
      reject(new Error(message));
    });
  });
