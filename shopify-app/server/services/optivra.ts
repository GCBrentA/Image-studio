import { config } from "../config";

export async function generateImage(input: {
  sourceImageUrl: string;
  prompt: string | null;
  mode: string | null;
  settings: Record<string, unknown>;
}) {
  if (!config.optivraApiUrl || !config.optivraApiKey) {
    return {
      generatedImageUrl: input.sourceImageUrl,
      stub: true
    };
  }

  const response = await fetch(`${config.optivraApiUrl}/images/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.optivraApiKey}`
    },
    body: JSON.stringify({
      sourceImageUrl: input.sourceImageUrl,
      prompt: input.prompt,
      mode: input.mode,
      settings: input.settings
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || body.message || "Optivra image generation failed");
  return { generatedImageUrl: body.processedImageUrl || body.generatedImageUrl };
}
