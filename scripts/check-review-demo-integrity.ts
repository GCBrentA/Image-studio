import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const html = readFileSync("public/site/index.html", "utf8");
const app = readFileSync("public/site/assets/app.js", "utf8");

const reviewBlocks = [...html.matchAll(/<article class="review-workflow-mock"[\s\S]*?<\/article>/g)].map((match) => match[0]);

assert(reviewBlocks.length >= 2, "Expected at least two review workflow showcase blocks.");
assert(app.includes("const reviewWorkflowDemoRecords"), "Curated review workflow demo records are missing.");
assert(app.includes("function validateReviewWorkflowDemoRecord"), "Review workflow validation guard is missing.");
assert(app.includes("processed_reuses_original"), "Duplicate processed/original guard is missing.");
assert(app.includes("Processed preview not available yet"), "Missing processed preview fallback is missing.");

for (const [index, block] of reviewBlocks.entries()) {
  assert(block.includes('data-review-workflow-demo="gel-blaster-rifle"'), `Review block ${index + 1} is not bound to the curated demo record.`);
  assert(!/hi-capa|holster/i.test(block), `Review block ${index + 1} still contains stale Hi Capa/holster metadata.`);
  assert(block.includes("Example gel blaster rifle"), `Review block ${index + 1} is missing the curated product title.`);
  assert(block.includes("black-gel-blaster-rifle-studio-cleanup.webp"), `Review block ${index + 1} is missing the matching curated filename.`);
  assert(block.includes("Black gel blaster rifle on a clean light catalogue background."), `Review block ${index + 1} is missing the matching curated alt text.`);
  assert(block.includes("review-thumb--gel-blaster-original"), `Review block ${index + 1} is missing the original visual class.`);
  assert(block.includes("review-thumb--gel-blaster-processed"), `Review block ${index + 1} is missing the processed visual class.`);
}

assert(
  app.includes('originalAssetId: "gel-blaster-rifle-original"') &&
    app.includes('processedAssetId: "gel-blaster-rifle-processed-clean-background"'),
  "Curated demo record does not define distinct original and processed assets."
);
assert(
  app.includes('id: "pending-preview-safe-state"') &&
    app.includes('processedAssetId: ""') &&
    app.includes("renderReviewWorkflowPendingThumb"),
  "Missing processed-image scenario is not represented by a safe pending state."
);

console.log("Review workflow demo integrity checks passed.");
