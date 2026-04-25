import { env } from "../../config/env";

export const removeImageBackground = async (imageBuffer: Buffer): Promise<Buffer> => {
  if (!env.backgroundRemovalApiUrl) {
    if (env.nodeEnv !== "test") {
      console.warn("BACKGROUND_REMOVAL_API_URL is not configured; using local image passthrough.");
    }

    return imageBuffer;
  }

  const response = await fetch(env.backgroundRemovalApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      ...(env.backgroundRemovalApiKey ? { authorization: `Bearer ${env.backgroundRemovalApiKey}` } : {})
    },
    body: new Blob([new Uint8Array(imageBuffer)], {
      type: "application/octet-stream"
    })
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(`Background removal failed with ${response.status}: ${responseBody}`);
  }

  return Buffer.from(await response.arrayBuffer());
};
