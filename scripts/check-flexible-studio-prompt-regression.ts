import assert from "node:assert/strict";

process.env.SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL || "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai-key";
process.env.IMAGE_EDIT_MODEL = process.env.IMAGE_EDIT_MODEL || "gpt-image-1";

let capturedPrompt = "";

globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const body = init?.body;
  assert.ok(body instanceof FormData, "Expected OpenAI image edit request to use FormData");
  const prompt = body.get("prompt");
  assert.equal(typeof prompt, "string", "Expected prompt form field to be a string");
  capturedPrompt = prompt;

  return new Response(JSON.stringify({
    data: [
      {
        b64_json: Buffer.from("not-a-real-image").toString("base64")
      }
    ]
  }), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}) as typeof fetch;

const run = async (): Promise<void> => {
  const { renderFlexibleStudioProductImage } = await import("../src/services/backgroundRemovalService");

  await renderFlexibleStudioProductImage({
    imageBuffer: Buffer.from("fake-image"),
    preserveProductExactly: false,
    processingMode: "standard_background_replacement",
    backgroundDescription: "Use a clean off-white studio background."
  });

  assert.match(
    capturedPrompt,
    /Never omit, clip, truncate, melt away, smooth away, or simplify any real visible product part/i,
    "Flexible studio prompt must explicitly forbid missing product parts."
  );
  assert.match(
    capturedPrompt,
    /If a visible part exists in the source, it must still exist in the final image with the same approximate shape, thickness, and attachment point\./i,
    "Flexible studio prompt must require preserving visible source parts."
  );
  assert.match(
    capturedPrompt,
    /Thin black or dark mechanical features must remain fully present and attached, not partially erased or blended into the background\./i,
    "Flexible recovery instruction must protect thin dark features from being erased."
  );

  console.log("Flexible studio prompt regression passed.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
