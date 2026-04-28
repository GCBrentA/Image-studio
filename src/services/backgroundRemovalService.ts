import { env } from "../config/env";

export const removeImageBackground = async (imageBuffer: Buffer): Promise<Buffer> => {
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
  formData.append(
    "prompt",
    "Create a precise ecommerce product alpha mask/cutout from this image. Preserve the product exactly as shown. Do not change the product shape, packaging, label, logo, text, colours, markings, icons, dimensions, proportions, material, texture, ingredients, annotations, or visible product details. Only remove the background outside the product area. Return a clean transparent-background PNG with the product foreground isolated, no shadows, reflections, floor, text overlays, borders, or added objects."
  );
  formData.append("background", "transparent");
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
