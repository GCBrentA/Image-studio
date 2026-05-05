# AGENTS.md

## Optivra Product Image Quality Mandate

This project processes WooCommerce product images. Product image quality is the primary acceptance criterion. A change is not complete unless it has been tested against multiple real product images from the test site and the final returned images are clean, professional, artifact-free, and consistent with the user's selected settings.

Do not treat this as a generic image-generation task. Optivra must behave like a professional product retoucher: preserve the product, replace or clean the background, refine edges, add appropriate shadow/lighting, and reject unsafe results instead of publishing damaged images.

---

## Non-Negotiable Rule

Before returning any implementation as complete, the agent must run multiple end-to-end product image tests using real product image files from the configured test site.

Synthetic images, placeholder images, internet samples, or single-image checks are not enough.

If any output contains visible artifacts, the agent must continue changing the method, code, prompts, masks, compositing logic, or settings until multiple real image tests pass across all relevant modes.

A result is not acceptable when it merely looks "better than before." It must look like a high-quality professional product image with no visible artifacts.

---

## Product Preservation Semantics

### Exact Product Preservation ON

This mode is strict and source-locked.

Requirements:

- The product must not be redrawn, regenerated, reshaped, retextured, recoloured, simplified, smoothed, warped, or cosmetically changed.
- The final product pixels must come from the original image, except for alpha-edge handling required for clean compositing.
- Background replacement must not alter product geometry, logos, text, holes, cutouts, ridges, screws, transparent areas, or fine detail.
- Lighting changes must not modify the product body unless a separate explicitly safe setting allows it.
- If clean preservation is not possible, the image must fail safely and require review.

### Product Preservation OFF / Flexible Studio Enhancement

This mode is more flexible, but it is still not a license to regenerate the product.

Allowed:

- Conservative edge cleanup.
- Background colour spill removal in a narrow edge band.
- Subtle product-only lighting correction.
- Shadow lift for dark product detail.
- Highlight recovery.
- Minor colour neutralisation.

Not allowed:

- Changing product identity.
- Changing shape or silhouette.
- Changing product-mounted logos, labels, text, ridges, screws, holes, handles, straps, transparent parts, or fine geometry.
- Smoothing away real detail.
- Creating fake texture, fake highlights, or AI-looking surfaces.
- Publishing hallucinated or damaged product images.

---

## Required Testing Workflow

Every image-processing change must follow this loop:

1. Locate real product images from the test site.
2. Run the image processor end-to-end using the same code path used by WooCommerce jobs.
3. Test all relevant processing modes and settings combinations.
4. Review output images visually at normal size, 100% zoom, and 200% zoom.
5. Inspect matte/alpha/debug artifacts when available.
6. Compare source and output for product preservation.
7. Fix any artifacts by changing the actual method, not merely hiding the issue with a setting.
8. Repeat until multiple real product images pass.
9. Only then report the change as complete.

The agent must not stop after the first good image. A method that works for one product and fails on another is not accepted.

---

## Test Image Source Requirements

Use product image files from the project test site only.

Acceptable sources include:

- WooCommerce product featured images from the test site.
- WooCommerce product gallery images from the test site.
- WordPress Media Library product images from the test site.
- Local test-site uploads mirrored from the WordPress uploads directory.
- Test fixtures that are exact copies of real test-site product images.

Not acceptable:

- Random internet images.
- AI-generated product images.
- Blank synthetic shapes.
- Single-image tests.
- Cropped debug-only images that bypass the real WooCommerce processing path.

When possible, record the product ID, attachment ID, filename, and original image path/URL used for every test.

---

## Minimum Real Image Test Set

For any change to background removal, masking, matting, compositing, lighting, shadow, framing, preservation checks, or OpenAI prompt handling, test at least 8 real product images from the test site.

The set must include as many of these product types as are available:

1. Dark or black product on a light background.
2. Light or white product on a light background.
3. Product with thin parts, handles, straps, tubes, or long narrow geometry.
4. Product with holes, cutouts, slots, or internal negative space.
5. Product with printed text, labels, branding, or logos that are physically on the product.
6. Product with detached background text, watermark, admin logo, or background branding that should be removed.
7. Reflective, glossy, metallic, or transparent/semi-transparent product.
8. Product with fine surface detail, ridges, screws, grooves, fibres, or texture.
9. Horizontal product.
10. Tall product.
11. Square or compact product.
12. Product with shadow or background contamination near the edges.

If fewer than 8 suitable real images exist on the test site, use every available real product image and clearly report the shortage. Do not invent substitute synthetic tests.

---

## Required Mode Matrix

For image-processing changes, test all modes affected by the change.

At minimum, test:

- Exact Product Preservation ON.
- Exact Product Preservation OFF / Flexible Studio Enhancement.
- Clean background mode.
- Custom uploaded background mode, when configured.
- Shadow disabled, if shadow code changed.
- Shadow behind product, if shadow code changed.
- Shadow under product/contact shadow, if available and shadow code changed.
- Lighting enhancement ON, if lighting code changed.
- Lighting enhancement OFF, if lighting code changed.
- Smart framing ON, if framing/crop code changed.
- Smart framing OFF, if framing/crop code changed.
- Featured/product image handling, if scan/queue code changed.
- Gallery image handling, if scan/queue code changed.

When a full Cartesian product would be excessive, select a representative matrix that still exercises every affected mode with multiple real images. Do not skip preservation ON/OFF testing.

---

## Visual Quality Acceptance Criteria

An output image passes only if all of the following are true:

- The product looks like the original product, not an AI recreation.
- Product shape, silhouette, scale, orientation, and geometry are preserved.
- Product-mounted logos, text, labels, markings, screws, ridges, holes, handles, transparent areas, and fine details remain intact.
- The product has clean professional edges with correct anti-aliasing.
- There are no jagged edges, stair-stepping, rough masks, cut-off corners, or clipped details.
- There are no white, grey, black, coloured, or semi-transparent halos around the product.
- There are no old background fragments attached to the product.
- There are no missing holes, filled cutouts, or damaged negative spaces.
- Dark products retain detail and are not crushed into black silhouettes.
- Light products retain edge separation and are not washed out.
- Reflective or transparent areas remain believable and are not flattened or made opaque.
- The new background looks clean and intentional.
- Shadows look natural and do not become part of the product.
- Framing matches the user's settings and does not crop, over-shrink, or awkwardly position the product.
- The final result is suitable for a live WooCommerce product page.

If any of these checks fail, the implementation is not complete.

---

## Artifact Failures That Require Iteration

Continue changing the method and retesting if any output shows:

- AI-redrawn product features.
- Melted, warped, softened, simplified, plastic-looking, or fake-looking product surfaces.
- Changed product colour or material identity.
- Altered or unreadable product text/logos.
- Missing ridges, screws, holes, straps, handles, or fine details.
- Background remnants around the product.
- Jagged, crunchy, noisy, or broken alpha edges.
- White/grey halo from poor matting.
- Black halo from poor premultiplication.
- Overly harsh or fake shadow.
- Product shadow incorrectly included in the product mask.
- Cropped product edges.
- Excessive whitespace inconsistent with framing settings.
- Crushed blacks or blown highlights.
- Unnatural contrast, colour cast, or lighting.
- Any visible artifact at 100% or 200% zoom.

Do not work around these failures by lowering review standards. Fix the pipeline.

---

## Method Expectations

Preferred world-class pipeline:

1. Preserve the original image.
2. Detect the product foreground.
3. Build a trimap with foreground, background, and uncertain edge regions.
4. Generate a high-quality alpha matte.
5. Refine the matte at high resolution.
6. Decontaminate old background colour only in the edge band.
7. Composite original product pixels over the selected background using correct alpha handling.
8. Generate shadow as a separate layer.
9. Apply lighting enhancement conservatively and mask-aware.
10. Apply framing/crop after compositing according to user settings.
11. Run preservation and quality checks before replacing WooCommerce images.

Avoid pipelines where a generative model renders the final product image. AI may assist with segmentation guidance, risk analysis, or metadata, but it must not redraw the product unless a future explicit feature is added for that purpose.

---

## Automated Checks

Use automated checks wherever possible, but never rely on them alone.

Recommended checks:

- Mask coverage and bounding-box sanity checks.
- Alpha edge continuity checks.
- Silhouette IoU between source-derived mask and final product alpha.
- Confident foreground RGB difference checks for Exact Product Preservation ON.
- Detection of unexpected transparent holes or filled holes.
- Edge halo detection on the final composite.
- Background remnant detection near the matte boundary.
- Dark-detail preservation checks.
- Overexposure/highlight clipping checks.
- Output dimensions, file type, and compression quality checks.

Visual inspection remains mandatory. If automated checks pass but the image visibly fails, the image fails.

---

## Debug Outputs Required During Development

When testing image-processing changes, save or expose the following debug artifacts for each tested image where practical:

- Original source image.
- Initial segmentation mask.
- Trimap.
- Refined alpha matte.
- Product cutout on checkerboard.
- Final composited image.
- Difference image or preservation comparison.
- Processing settings used.
- Preservation/quality report.

Debug files should make it easy to determine whether the failure is caused by detection, masking, matting, decontamination, compositing, lighting, shadow, or framing.

---

## Final Response Requirements For Agents

When reporting completion, include:

- The exact code changes made.
- The real test-site product images used, including filenames and product/attachment IDs where available.
- The modes/settings tested.
- The pass/fail result for each image and mode.
- Links or paths to final output images and debug artifacts.
- Any tests that could not be run and the reason.
- Confirmation that visual inspection was performed at 100% and 200% zoom.

Do not claim success if there are known artifacts. Do not say the change is complete if only automated tests were run. Do not omit failed test images from the report.

---

## Definition of Done

A change is done only when:

- Unit/integration tests relevant to the change pass.
- Multiple real product images from the test site have been processed end-to-end.
- Exact Product Preservation ON has passed real-image tests.
- Product Preservation OFF / Flexible Studio Enhancement has passed real-image tests.
- All affected background, shadow, lighting, and framing modes have been tested.
- Final returned images are high quality and artifact-free.
- Output images match the user's settings.
- No damaged image would be automatically published to WooCommerce.
- Debug evidence exists for the tested images.
- The agent's final report lists the images, modes, settings, and results.

If this standard is not met, continue iterating on the method and/or settings until it is met.
