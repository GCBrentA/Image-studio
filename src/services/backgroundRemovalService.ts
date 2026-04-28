import { env } from "../config/env";

export type BackgroundRemovalMode = "preserve-mask" | "flexible-cutout";

const preserveMaskPrompt =
  "Create an exact ecommerce product cutout from this image. Use the image only for foreground segmentation and background removal. Preserve the visible product exactly: shape, proportions, colours, logos, markings, rails, triggers, holes, vents, sights, nozzles, transparent or translucent parts, textures, materials, and all fine contours. Do not redraw, beautify, smooth, enhance, relight, recolour, invent, remove, or alter any part of the product. Remove only background, floor, wall, table, and non-product clutter. Keep true internal openings transparent. Return a transparent-background PNG whose alpha channel isolates only the product.";

const flexibleCutoutPrompt =
  "Create a precise ecommerce product alpha mask/cutout from this image. Isolate only the actual product object. Preserve the product as much as possible. Remove all background, floor, wall, table, shadows, reflections, glare patches, gaps, holes, empty spaces between parts, and background visible through openings in the product. Return a clean transparent-background PNG with only the product foreground isolated, no added objects and no background remnants.";

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
  formData.append("prompt", mode === "preserve-mask" ? preserveMaskPrompt : flexibleCutoutPrompt);
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
