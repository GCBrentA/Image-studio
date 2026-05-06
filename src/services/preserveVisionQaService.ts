import { env } from "../config/env";

export type PreserveVisionQaResult = {
  passed: boolean;
  commerciallyUsable: boolean;
  failReasons: string[];
  scores: {
    edgeCleanliness: number;
    productPreservation: number;
    textBrandingConsistency: number;
    backgroundRemoval: number;
    lightingNaturalness: number;
    ecommerceQuality: number;
  };
  ocrComparison: {
    originalText: string[];
    finalText: string[];
    missingImportantText: string[];
    alteredBranding: string[];
  };
  visibleProblems: string[];
  summary: string;
  skipped?: boolean;
};

type VisionQaInput = {
  originalSource: Buffer;
  finalComposite: Buffer;
  checkerboardPreview?: Buffer;
  alphaMaskPreview?: Buffer;
  edgeHaloOverlay?: Buffer;
  dropoutOverlay?: Buffer;
};

const defaultVisionQa: PreserveVisionQaResult = {
  passed: false,
  commerciallyUsable: false,
  failReasons: ["Low Confidence Preserve Result"],
  scores: {
    edgeCleanliness: 0,
    productPreservation: 0,
    textBrandingConsistency: 0,
    backgroundRemoval: 0,
    lightingNaturalness: 0,
    ecommerceQuality: 0
  },
  ocrComparison: {
    originalText: [],
    finalText: [],
    missingImportantText: [],
    alteredBranding: []
  },
  visibleProblems: ["Vision QA was not completed."],
  summary: "Preserve mode requires strict vision QA before a result can be marked Passed.",
  skipped: true
};

const imagePart = (_label: string, buffer: Buffer) => ({
  type: "input_image",
  image_url: `data:image/png;base64,${buffer.toString("base64")}`,
  detail: "high"
});

const coerceScore = (value: unknown): number => {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 0;
  }

  const normalizedScore = score > 0 && score <= 10 ? score * 10 : score;
  return Math.max(0, Math.min(100, Math.round(normalizedScore)));
};

const parseVisionQaJson = (text: string): PreserveVisionQaResult => {
  const parsed = JSON.parse(text) as Partial<PreserveVisionQaResult>;
  const scores = (parsed.scores ?? {}) as Partial<PreserveVisionQaResult["scores"]>;
  const ocrComparison = (parsed.ocrComparison ?? {}) as Partial<PreserveVisionQaResult["ocrComparison"]>;

  return {
    passed: parsed.passed === true,
    commerciallyUsable: parsed.commerciallyUsable === true,
    failReasons: Array.isArray(parsed.failReasons) ? parsed.failReasons.map(String) : [],
    scores: {
      edgeCleanliness: coerceScore(scores.edgeCleanliness),
      productPreservation: coerceScore(scores.productPreservation),
      textBrandingConsistency: coerceScore(scores.textBrandingConsistency),
      backgroundRemoval: coerceScore(scores.backgroundRemoval),
      lightingNaturalness: coerceScore(scores.lightingNaturalness),
      ecommerceQuality: coerceScore(scores.ecommerceQuality)
    },
    ocrComparison: {
      originalText: Array.isArray(ocrComparison.originalText) ? ocrComparison.originalText.map(String).slice(0, 20) : [],
      finalText: Array.isArray(ocrComparison.finalText) ? ocrComparison.finalText.map(String).slice(0, 20) : [],
      missingImportantText: Array.isArray(ocrComparison.missingImportantText) ? ocrComparison.missingImportantText.map(String).slice(0, 20) : [],
      alteredBranding: Array.isArray(ocrComparison.alteredBranding) ? ocrComparison.alteredBranding.map(String).slice(0, 20) : []
    },
    visibleProblems: Array.isArray(parsed.visibleProblems) ? parsed.visibleProblems.map(String).slice(0, 12) : [],
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 800) : ""
  };
};

export const runPreserveVisionQa = async ({
  originalSource,
  finalComposite,
  checkerboardPreview,
  alphaMaskPreview,
  edgeHaloOverlay,
  dropoutOverlay
}: VisionQaInput): Promise<PreserveVisionQaResult> => {
  if (!env.openAiApiKey || !env.visionQaModel) {
    return defaultVisionQa;
  }

  const content = [
    {
      type: "input_text",
      text:
        "Return strict JSON only. This is for WooCommerce product imagery. Be strict. It is better to fail than approve a visibly imperfect ecommerce product image. Compare the original product to the final composite and cutout/debug images. Any visible grey halo fails. Any leftover floor/background texture attached to the product fails. Any missing product part fails. Any AI-redrawn product shape fails. Any rough/jagged dirty mask fails. Read visible label/brand text in the original and final product; missing, rewritten, garbled, or altered important text fails. A result must not pass unless commercially usable. Do not mention or infer private data."
    },
    imagePart("original_source", originalSource),
    imagePart("final_composite", finalComposite),
    ...(checkerboardPreview ? [imagePart("cutout_on_checkerboard", checkerboardPreview)] : []),
    ...(alphaMaskPreview ? [imagePart("cleaned_alpha_mask_preview", alphaMaskPreview)] : []),
    ...(edgeHaloOverlay ? [imagePart("edge_halo_overlay", edgeHaloOverlay)] : []),
    ...(dropoutOverlay ? [imagePart("dropout_overlay", dropoutOverlay)] : [])
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openAiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.visionQaModel,
      input: [
        {
          role: "user",
          content
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "preserve_mode_qa",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["passed", "commerciallyUsable", "failReasons", "scores", "ocrComparison", "visibleProblems", "summary"],
            properties: {
              passed: { type: "boolean" },
              commerciallyUsable: { type: "boolean" },
              failReasons: { type: "array", items: { type: "string" } },
              scores: {
                type: "object",
                additionalProperties: false,
                required: ["edgeCleanliness", "productPreservation", "textBrandingConsistency", "backgroundRemoval", "lightingNaturalness", "ecommerceQuality"],
                properties: {
                  edgeCleanliness: { type: "number" },
                  productPreservation: { type: "number" },
                  textBrandingConsistency: { type: "number" },
                  backgroundRemoval: { type: "number" },
                  lightingNaturalness: { type: "number" },
                  ecommerceQuality: { type: "number" }
                }
              },
              ocrComparison: {
                type: "object",
                additionalProperties: false,
                required: ["originalText", "finalText", "missingImportantText", "alteredBranding"],
                properties: {
                  originalText: { type: "array", items: { type: "string" } },
                  finalText: { type: "array", items: { type: "string" } },
                  missingImportantText: { type: "array", items: { type: "string" } },
                  alteredBranding: { type: "array", items: { type: "string" } }
                }
              },
              visibleProblems: { type: "array", items: { type: "string" } },
              summary: { type: "string" }
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    return {
      ...defaultVisionQa,
      visibleProblems: [`Vision QA request failed with ${response.status}.`],
      summary: "Vision QA could not complete, so preserve mode cannot pass automatically."
    };
  }

  const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
  const result = parseVisionQaJson(text);
  const textPass =
    result.scores.textBrandingConsistency >= 84 &&
    result.ocrComparison.missingImportantText.length === 0 &&
    result.ocrComparison.alteredBranding.length === 0;
  const ecommercePass =
    result.commerciallyUsable &&
    result.scores.ecommerceQuality >= 82 &&
    result.scores.edgeCleanliness >= 85 &&
    textPass;

  return {
    ...result,
    passed: result.passed && ecommercePass,
    failReasons: Array.from(new Set([
      ...result.failReasons,
      ...(!textPass ? ["Label/text/branding consistency failed vision QA."] : [])
    ]))
  };
};

export const runFlexibleStudioVisionQa = async ({
  originalSource,
  finalComposite,
  checkerboardPreview,
  alphaMaskPreview,
  edgeHaloOverlay,
  dropoutOverlay
}: VisionQaInput): Promise<PreserveVisionQaResult> => {
  if (!env.openAiApiKey || !env.visionQaModel) {
    return defaultVisionQa;
  }

  const content = [
    {
      type: "input_text",
      text:
        "Return strict JSON only. This is Product Preservation OFF / Flexible OpenAI Studio Mode QA for WooCommerce product imagery. The final image may be an OpenAI-rendered professional studio recovery, so do not require pixel-identical product RGB and do not fail merely because old background watermark, baked-in mask scars, halo, jagged cutout outline, source shadow bleed, or dirty edges were removed. Be visually strict about ecommerce quality and product identity. Pass only if the final looks like a clean professional product photo with no visible alpha mask, no jagged edge, no grey/black/white halo, no background fragments, no blocky edge artifacts, no mask scar, no dirty residue, no shadow bleed attached to the product, and no clutter. The product must remain the same sellable SKU as closely as possible: same product identity, main shape, proportions, orientation, holes/openings, tabs, screws, ridges, printed product text/logos when physically on the item, material family, colour family, part count, attachment points, and mechanical details. Fail if the final changes product identity, redesigns the item, removes important product detail, changes product-mounted text/logos, adds extra parts, fills real holes, removes tabs/holes, invents openings, changes proportions, makes surfaces melted/plastic/fake, or leaves any visible artifact. Ignore detached background logos, watermarks, and source-background branding if they are removed in the final. If the original has no important product-mounted text, do not invent a text/branding failure. Do not mention or infer private data."
    },
    imagePart("original_source", originalSource),
    imagePart("final_composite", finalComposite),
    ...(checkerboardPreview ? [imagePart("cutout_on_checkerboard", checkerboardPreview)] : []),
    ...(alphaMaskPreview ? [imagePart("cleaned_alpha_mask_preview", alphaMaskPreview)] : []),
    ...(edgeHaloOverlay ? [imagePart("edge_halo_overlay", edgeHaloOverlay)] : []),
    ...(dropoutOverlay ? [imagePart("dropout_overlay", dropoutOverlay)] : [])
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openAiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.visionQaModel,
      input: [
        {
          role: "user",
          content
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "flexible_studio_qa",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["passed", "commerciallyUsable", "failReasons", "scores", "ocrComparison", "visibleProblems", "summary"],
            properties: {
              passed: { type: "boolean" },
              commerciallyUsable: { type: "boolean" },
              failReasons: { type: "array", items: { type: "string" } },
              scores: {
                type: "object",
                additionalProperties: false,
                required: ["edgeCleanliness", "productPreservation", "textBrandingConsistency", "backgroundRemoval", "lightingNaturalness", "ecommerceQuality"],
                properties: {
                  edgeCleanliness: { type: "number" },
                  productPreservation: { type: "number" },
                  textBrandingConsistency: { type: "number" },
                  backgroundRemoval: { type: "number" },
                  lightingNaturalness: { type: "number" },
                  ecommerceQuality: { type: "number" }
                }
              },
              ocrComparison: {
                type: "object",
                additionalProperties: false,
                required: ["originalText", "finalText", "missingImportantText", "alteredBranding"],
                properties: {
                  originalText: { type: "array", items: { type: "string" } },
                  finalText: { type: "array", items: { type: "string" } },
                  missingImportantText: { type: "array", items: { type: "string" } },
                  alteredBranding: { type: "array", items: { type: "string" } }
                }
              },
              visibleProblems: { type: "array", items: { type: "string" } },
              summary: { type: "string" }
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    return {
      ...defaultVisionQa,
      visibleProblems: [`Flexible studio vision QA request failed with ${response.status}.`],
      summary: "Flexible studio QA could not complete, so the result cannot pass automatically."
    };
  }

  const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
  const result = parseVisionQaJson(text);
  const importantTextFailed =
    result.ocrComparison.missingImportantText.length > 0 ||
    result.ocrComparison.alteredBranding.length > 0;
  const visibleArtifactFailed = result.visibleProblems.some((problem) =>
    /halo|jagged|mask|artifact|artefact|background fragment|bleed|blocky|pixelat|melt|plastic|warped|changed identity|redesign|invent|extra part|missing|filled|removed|residue|scar|outline|dirty|smeared|blur/i.test(problem)
  );
  const ecommercePass =
    result.commerciallyUsable &&
    result.scores.ecommerceQuality >= 88 &&
    result.scores.edgeCleanliness >= 88 &&
    result.scores.backgroundRemoval >= 88 &&
    result.scores.productPreservation >= 80 &&
    !importantTextFailed &&
    !visibleArtifactFailed;

  return {
    ...result,
    passed: result.passed && ecommercePass,
    failReasons: Array.from(new Set([
      ...result.failReasons,
      ...(importantTextFailed ? ["Product-mounted text/branding consistency failed flexible studio QA."] : []),
      ...(visibleArtifactFailed ? ["Visible artifact failed flexible studio QA."] : [])
    ]))
  };
};
