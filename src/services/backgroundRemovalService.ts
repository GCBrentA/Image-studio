import { spawn } from "child_process";
import { env } from "../config/env";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

export type BackgroundRemovalMode = "preserve-mask" | "preserve-mask-refined" | "preserve-mask-hard-contamination" | "flexible-cutout";
export type ImagePromptVariant =
  | "seo_product_feed_preserve"
  | "preserve_background_replacement"
  | "standard_background_replacement"
  | "premium_studio_background";

export type FlexibleStudioRenderInput = {
  imageBuffer: Buffer;
  preserveProductExactly: false;
  processingMode: ImagePromptVariant | string;
  backgroundDescription: string;
  recoveryInstruction?: string;
};

export const ecommercePreservePromptVersion = "ecommerce_preserve_v2";
export const openAiImageEditModel = env.imageEditModel;
export const openAiImageEditEndpoint = "https://api.openai.com/v1/images/edits";
export const openAiImageEditQuality = "high";
export const openAiImageEditSize = "1024x1024";

const negativeProductInstructionBlock =
  "Do not change the product. Do not modify the object. Do not alter the silhouette. Do not redraw the item. Do not invent details. Do not remove details. Do not crop the product. Do not change, rewrite, blur, distort, remove, add, or reinterpret any product logos, labels, visible text, markings, branding, graphics, packaging design, texture, reflections, materials, proportions, or sellable features that are physically printed on or attached to the product. Remove all source background text, background logos, background watermarks, background graphics, floor/wall marks, and detached brand marks that are behind, around, under, or separate from the actual product. Do not preserve large background brand graphics as part of the product. Do not leave excessive whitespace. Do not make the background dark, textured, wooden, lifestyle, dramatic, cluttered, or busy. Do not add logos, text, labels, watermarks, reflections, props, hands, people, packaging, smoke, glow, or extra objects.";

const strictProductPreservationBlock =
  "Do not alter the product. Preserve the exact product pixels, shape, silhouette, design, logos, visible text, labels, colours, proportions, geometry, branding, packaging, texture, reflections, materials, markings, surface details, holes, screws, seams, highlights, and all visible sellable details that are physically part of the product. Only the background/environment may change according to the selected background settings. Remove background-only watermarks, text, logos, graphics, floor/wall marks, and detached brand marks even if they resemble product branding. Do not redraw, redesign, simplify, enhance, repaint, retouch, smooth, sharpen, stylise, modify, or reinterpret the product. Do not add or remove any product parts. Do not change the product geometry. Do not change the product colour. Do not make the product look like a different item.";

const flexibleProductPreservationBlock =
  "Create a professional ecommerce studio background and lighting treatment. The product itself is the source of truth. Preserve the product identity and design. Keep the same product shape, silhouette, proportions, branding, logos, visible text, labels, packaging design, colours, texture, materials, markings, holes, cutouts, screws, edges, fine details, and sellable appearance that are physically part of the product. Remove all background-only text, background logos, background watermarks, background graphics, floor/wall marks, and detached brand marks. Only minor adjustments needed for realistic background integration are allowed: subtle lighting harmonisation, soft shadow generation, slight edge blending, minor reflection adaptation, and small colour-temperature balancing. Do not redraw, reshape, simplify, blur, replace, recolour, invent features, remove details, change text or logos that are physically on the product, alter geometry, or make the product look like a different item. The final result must look like the same photographed product placed into a cleaner studio scene.";

const preserveBackgroundReplacementPrompt =
  `Edit this image as a professional ecommerce product photo. ${strictProductPreservationBlock} Only remove the original background and replace it with a clean premium studio background. Create a clean light ecommerce background suitable for WooCommerce product pages and shopping feeds. Use an off-white or very light neutral grey background, not pure harsh white. Add a subtle realistic soft contact shadow beneath the product so it feels grounded, but do not obscure or alter the product. Keep the product horizontally aligned and centred. Crop and scale the final image so the product fills approximately 82-90% of the image width while maintaining comfortable margins. Do not crop any part of the product. Keep the entire product visible. Maintain natural contrast and detail, especially in black/dark parts. Do not crush shadows. Do not over-brighten. Do not over-sharpen. Do not blur edges. Preserve fine details around thin parts. Final output should look like a premium catalogue product image: clean, sharp, realistic, accurately preserved, well centred, correctly scaled, and ready for ecommerce use. ${negativeProductInstructionBlock}`;

const standardBackgroundReplacementPrompt =
  `Create a clean ecommerce product image from the supplied photo. ${flexibleProductPreservationBlock} Remove the source background and use a clean light studio background with natural product contrast and a subtle grounding shadow. Minor presentation improvements are allowed only for background, framing, lighting balance, edge blending, shadow realism, and background integration. ${negativeProductInstructionBlock}`;

const premiumStudioBackgroundPrompt =
  `Create a premium studio ecommerce product presentation from the supplied photo. ${flexibleProductPreservationBlock} Improve only the background presentation, framing, subtle lighting integration, edge blending, and studio grounding shadow. The product must remain the same item and must not be redesigned, redrawn, simplified, or stylised. ${negativeProductInstructionBlock}`;

const seoProductFeedSafePrompt =
  `Create an SEO and product-feed-safe ecommerce product image. ${preserveBackgroundReplacementPrompt} The background must be clean, light, low-clutter, shopping-feed friendly, and free of props, text, logos, people, hands, packaging, and lifestyle context.`;

export const buildOpenAiImagePrompt = (variant: ImagePromptVariant): string => {
  switch (variant) {
    case "preserve_background_replacement":
      return preserveBackgroundReplacementPrompt;
    case "standard_background_replacement":
      return standardBackgroundReplacementPrompt;
    case "premium_studio_background":
      return premiumStudioBackgroundPrompt;
    case "seo_product_feed_preserve":
    default:
      return seoProductFeedSafePrompt;
  }
};

export const buildProductImageProcessingPrompt = ({
  preserveProductExactly,
  processingMode,
  backgroundDescription
}: {
  preserveProductExactly: boolean;
  processingMode: ImagePromptVariant | string;
  backgroundDescription: string;
}): string => {
  const basePrompt = buildOpenAiImagePrompt(
    processingMode === "premium_studio_background"
      ? "premium_studio_background"
      : processingMode === "standard_background_replacement" || processingMode === "standard_ecommerce_cleanup"
        ? "standard_background_replacement"
        : "seo_product_feed_preserve"
  );
  const preservation = preserveProductExactly ? strictProductPreservationBlock : flexibleProductPreservationBlock;
  const background = backgroundDescription.trim() || "Use the selected clean ecommerce background settings.";

  return `${preservation} User background settings: ${background}. ${basePrompt}`;
};

const preserveMaskPrompt =
  `${buildOpenAiImagePrompt("seo_product_feed_preserve")} Use this request only for foreground segmentation and background removal. Return a transparent-background PNG whose alpha channel isolates only the real product. Keep true internal openings transparent. The RGB product pixels are not the final product pixels, so do not invent or repair product detail in the cutout.`;

const preserveMaskRefinedPrompt =
  `${strictProductPreservationBlock} Return a clean product-only mask. Exclude all background, watermark, logo, floor, shadows, halos, grey smears, pale residue, and semi-transparent edge contamination. Preserve all dark product details, thin structures, interior openings, and exact silhouette. Perform only professional product foreground segmentation. Return a transparent PNG alpha cutout that isolates the real product from the supplied image. Do not generate, redraw, repair, stylize, relight, recolour, or reinterpret the product. Keep thin rails, trigger guards, holes, vents, sights, nozzles, logos, markings, translucent sections, small accessories, screws, seams, and internal openings exactly as segmentation requires. If uncertain, prefer a conservative transparent cutout over inventing product pixels. ${negativeProductInstructionBlock}`;

const preserveMaskHardContaminationPrompt =
  `${strictProductPreservationBlock} This request is only for exact product segmentation on a source photo that may already contain a bad previous cutout, watermark, grey photo card, old shadow, jagged alpha outline, black contour scar, white ghost edge, or pale halo baked into the background. Return only a transparent PNG alpha cutout/mask for the real physical product. Exclude every detached background logo, background watermark, old mask outline, old cutout shell, halo, grey/white fringe, black edge scar, floor shadow, reflection, and background residue, even if it touches the product edge. Preserve the real product silhouette, holes, dark openings, threads, screws, ridges, tabs, fine geometry, transparent parts, and product-mounted text/logos. For white/silver/metal parts on light backgrounds, keep actual metal pixels but remove pale ghost shells and dark jagged contours that are not physical product edges. For black products on light backgrounds, keep dark product detail and holes but remove detached black background graphics. Do not fill holes. Do not shrink real tabs or protrusions. Do not generate, redraw, repair, relight, recolour, smooth, sharpen, or reinterpret the product. Return alpha only through a transparent product PNG; RGB content is diagnostic and will not be used as final product pixels.`;

export const buildOpenAiBackgroundOnlyPrompt = (): string =>
  "Create a clean premium ecommerce studio background suitable for this product. No text, no logos, no props, no watermark, no product changes. Background only.";

export const buildOpenAiRelightingShadowGuidancePrompt = (): string =>
  "Generate only a natural studio-style background, lighting context, and soft realistic shadow environment. Do not alter, redraw, reshape, simplify, blur, deform, repaint, replace, or add details to the product. Preserve all holes, cutouts, edges, markings, texture, material, proportions, and silhouette. The product layer will be composited separately from original source pixels.";

const flexibleCutoutPrompt =
  `${buildOpenAiImagePrompt("standard_background_replacement")} Create a precise ecommerce product alpha mask/cutout from this image. Isolate only the actual product object. Remove all background, floor, wall, table, shadows, reflections, glare patches, gaps, holes, empty spaces between parts, and background visible through openings in the product. Return a clean transparent-background PNG with only the product foreground isolated, no added objects and no background remnants.`;

const flexibleStudioRecoveryInstruction =
  "This is Product Preservation OFF / Flexible Studio Enhancement. Use the supplied image as the reference for the same sellable product, but recover the ecommerce presentation when the source matte contains baked-in background contamination. Remove the old background, detached watermarks, background logos, background text, grey card residue, cutout outlines, jagged alpha borders, staircase mask artifacts, edge halos, and shadow bleed. The final product edges must be clean, naturally anti-aliased, and free of visible mask scars. Preserve the product identity, proportions, orientation, material, colour family, openings, holes, transparent areas, screws, ridges, grooves, labels, printed text, branding physically on the product, and fine geometry. Do not add product parts, remove product parts, change product-mounted text/logos, draw outlines, stylise the item, melt/smooth detail, or make the product look AI-generated. Use only a clean light ecommerce studio background and subtle realistic shadow behind or beneath the product.";

const getPromptForMode = (mode: BackgroundRemovalMode): string => {
  switch (mode) {
    case "preserve-mask":
      return preserveMaskPrompt;
    case "preserve-mask-refined":
      return preserveMaskRefinedPrompt;
    case "preserve-mask-hard-contamination":
      return preserveMaskHardContaminationPrompt;
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
  formData.append("model", openAiImageEditModel);
  formData.append("prompt", getPromptForMode(mode));
  formData.append("background", "transparent");
  formData.append("input_fidelity", "high");
  formData.append("output_format", "png");
  formData.append("quality", openAiImageEditQuality);
  formData.append("size", openAiImageEditSize);

  const response = await fetch(openAiImageEditEndpoint, {
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

export const renderFlexibleStudioProductImage = async ({
  imageBuffer,
  preserveProductExactly,
  processingMode,
  backgroundDescription,
  recoveryInstruction
}: FlexibleStudioRenderInput): Promise<Buffer> => {
  if (preserveProductExactly !== false) {
    throw new Error("Flexible OpenAI studio rendering is only allowed when Product Preservation is OFF.");
  }

  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const prompt = `${buildProductImageProcessingPrompt({
    preserveProductExactly: false,
    processingMode,
    backgroundDescription
  })} ${recoveryInstruction ?? flexibleStudioRecoveryInstruction}`;

  const formData = new FormData();
  formData.append(
    "image",
    new Blob([new Uint8Array(imageBuffer)], {
      type: "image/png"
    }),
    "product.png"
  );
  formData.append("model", openAiImageEditModel);
  formData.append("prompt", prompt);
  formData.append("background", "opaque");
  formData.append("input_fidelity", "high");
  formData.append("output_format", "png");
  formData.append("quality", openAiImageEditQuality);
  formData.append("size", openAiImageEditSize);

  const response = await fetch(openAiImageEditEndpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openAiApiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(`OpenAI flexible studio render failed with ${response.status}: ${responseBody}`);
  }

  const body = await response.json() as {
    data?: Array<{
      b64_json?: string;
    }>;
  };
  const imageBase64 = body.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI flexible studio render did not return image data");
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
