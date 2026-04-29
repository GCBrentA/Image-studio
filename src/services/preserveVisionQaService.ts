import { env } from "../config/env";

export type PreserveVisionQaResult = {
  passed: boolean;
  commerciallyUsable: boolean;
  failReasons: string[];
  scores: {
    edgeCleanliness: number;
    productPreservation: number;
    backgroundRemoval: number;
    lightingNaturalness: number;
    ecommerceQuality: number;
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
    backgroundRemoval: 0,
    lightingNaturalness: 0,
    ecommerceQuality: 0
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
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
};

const parseVisionQaJson = (text: string): PreserveVisionQaResult => {
  const parsed = JSON.parse(text) as Partial<PreserveVisionQaResult>;
  const scores = (parsed.scores ?? {}) as Partial<PreserveVisionQaResult["scores"]>;

  return {
    passed: parsed.passed === true,
    commerciallyUsable: parsed.commerciallyUsable === true,
    failReasons: Array.isArray(parsed.failReasons) ? parsed.failReasons.map(String) : [],
    scores: {
      edgeCleanliness: coerceScore(scores.edgeCleanliness),
      productPreservation: coerceScore(scores.productPreservation),
      backgroundRemoval: coerceScore(scores.backgroundRemoval),
      lightingNaturalness: coerceScore(scores.lightingNaturalness),
      ecommerceQuality: coerceScore(scores.ecommerceQuality)
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
        "Return strict JSON only. This is for WooCommerce product imagery. Be strict. It is better to fail than approve a visibly imperfect ecommerce product image. Compare the original product to the final composite and cutout/debug images. Any visible grey halo fails. Any leftover floor/background texture attached to the product fails. Any missing product part fails. Any AI-redrawn product shape fails. Any rough/jagged dirty mask fails. A result must not pass unless commercially usable. Do not mention or infer private data."
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
            required: ["passed", "commerciallyUsable", "failReasons", "scores", "visibleProblems", "summary"],
            properties: {
              passed: { type: "boolean" },
              commerciallyUsable: { type: "boolean" },
              failReasons: { type: "array", items: { type: "string" } },
              scores: {
                type: "object",
                additionalProperties: false,
                required: ["edgeCleanliness", "productPreservation", "backgroundRemoval", "lightingNaturalness", "ecommerceQuality"],
                properties: {
                  edgeCleanliness: { type: "number" },
                  productPreservation: { type: "number" },
                  backgroundRemoval: { type: "number" },
                  lightingNaturalness: { type: "number" },
                  ecommerceQuality: { type: "number" }
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
  const ecommercePass = result.commerciallyUsable && result.scores.ecommerceQuality >= 82 && result.scores.edgeCleanliness >= 85;

  return {
    ...result,
    passed: result.passed && ecommercePass
  };
};
