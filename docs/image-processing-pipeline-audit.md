# Image Processing Pipeline Audit

## Current Flow

Plugin jobs are created from the WooCommerce admin UI in `class-catalogue-image-studio-admin.php` and processed through `class-catalogue-image-studio-image-processor.php`. The plugin sends settings, source image data, and job overrides to the backend image route. Backend orchestration enters `processImageForProduct()` in `src/services/imageProcessingService.ts`.

The backend downloads or accepts the original image, stores the source artifact, normalizes it for OpenAI/preserve processing, creates a cutout through either preserve mode or flexible mode, reframes the product, builds a background and shadow, composites the final image, validates the result, stores debug cutouts/final output, and returns signed storage URLs and `outputValidation` to the plugin. Prompt and model calls live in `src/services/backgroundRemovalService.ts`. Preserve-mode programmatic validation lives in `src/services/preserveModeValidationService.ts`, with additional model-based QA in `src/services/preserveVisionQaService.ts`.

## Corruption Entry Points

The main corruption risk was the flexible cutout path. A failed AI alpha-cleanup path previously had room to return AI-rendered product pixels or an overly permissive local fallback, which could alter labels, materials, shape, or product identity. Preserve mode was better because it cut original pixels with an approved alpha mask, but final acceptance still relied on separate heuristics rather than a unified protected-product outcome.

Artifact risks were concentrated around AI-generated alpha masks, alpha refinement, local segmentation fallback, post-cutout product lighting, and final framing/compositing. Horizontal scanlines, faint product layers, missing interior sections, background remnants, and dirty edge components could pass if they did not trigger the older coverage/framing checks.

## Weak Validation Areas

Validation existed, but it was split by mode. Preserve mode had mask diagnostics, RGB-integrity checks, interior-dropout repair, programmatic overlays, and vision QA. Flexible mode mostly relied on alpha cleanup, visibility checks, and output framing. There was no common product-protection contract that classified every result as `PASS`, `SOFT_FAIL_RETRYABLE`, or `HARD_FAIL`.

Label/text protection was also under-specified in vision QA. It compared commercial quality but did not explicitly require OCR-style text/branding consistency. Debug artifacts were strongest in preserve mode and weaker for flexible validation decisions.

## Structural Fix Direction

The pipeline is now being split around a protected product region:

- source image ingestion and normalization
- mask/cutout creation
- original-pixel product extraction
- deterministic product-region validation
- flexible lighting attempt with validation
- source-locked fallback when flexible changes exceed tolerance
- background/shadow generation
- final composite
- post-composite and vision QA validation
- artifact/report storage

Preserve mode remains product-locked: final product pixels come from the original source product layer, with only alpha/edge blending and final compositing allowed. Flexible mode may still improve presentation, but product identity changes are detected and converted into fallback/review/failure instead of being silently accepted.
