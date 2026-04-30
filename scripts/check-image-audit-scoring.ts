import assert from "node:assert/strict";
import {
  calculateAuditMetrics,
  calculateRoiEstimate,
  generateCategoryScores,
  generateInsights,
  generateIssues,
  generateRecommendations,
  scoreCompleteness,
  scoreConsistency,
  scoreGoogleShoppingReadiness,
  scoreImageQuality,
  scorePerformance,
  scoreSeo,
  type AuditScoringItem
} from "../src/services/imageAuditScoringEngine";

const assertScore = (score: number) => {
  assert.ok(score >= 0, `score ${score} should be >= 0`);
  assert.ok(score <= 100, `score ${score} should be <= 100`);
};

const baseItem = (overrides: Partial<AuditScoringItem> = {}): AuditScoringItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  product_id: "p1",
  product_name: "Premium Leather Belt",
  product_sku: "BELT-1",
  image_id: "img1",
  image_url: "https://example.test/premium-leather-belt.jpg",
  image_role: "main",
  category_names: ["Belts"],
  filename: "premium-leather-belt.jpg",
  file_extension: "jpg",
  width: 1200,
  height: 1200,
  file_size_bytes: 420_000,
  alt_text: "Premium leather belt front view",
  image_title: "Premium leather belt",
  ...overrides
});

const emptyMetrics = calculateAuditMetrics([]);
assert.equal(emptyMetrics.product_image_health_score, 0);
assert.equal(scoreSeo([]).score, 100);
assert.equal(scoreCompleteness([]).score, 0);
assertScore(emptyMetrics.google_shopping_readiness_score);

const healthy = [baseItem()];
const healthyMetrics = calculateAuditMetrics(healthy);
assertScore(healthyMetrics.product_image_health_score);
assert.ok(healthyMetrics.product_image_health_score > 70);
assert.equal(generateIssues(healthy, healthyMetrics).some((issue) => issue.issue_type === "likely_blurry"), false);
assert.equal(healthyMetrics.assessed_visual_metrics.sharpness, false);

const weakSeoItems: AuditScoringItem[] = [
  baseItem({
    id: "21111111-1111-4111-8111-111111111111",
    product_id: "p2",
    product_name: "Carbon Widget",
    image_id: "img2",
    filename: "IMG_1234.jpg",
    alt_text: "",
    file_size_bytes: 2_400_000
  }),
  baseItem({
    id: "31111111-1111-4111-8111-111111111111",
    product_id: "p2",
    image_id: "img3",
    image_role: "gallery",
    filename: "IMG_1234.jpg",
    alt_text: "image",
    width: 600,
    height: 600,
    file_size_bytes: 1_600_000
  })
];
const seo = scoreSeo(weakSeoItems);
assert.ok(seo.score < 80, "missing/weak alt text and generic filenames should reduce SEO score");
const weakIssues = generateIssues(weakSeoItems, calculateAuditMetrics(weakSeoItems));
assert.ok(weakIssues.some((issue) => issue.issue_type === "missing_alt_text" && issue.severity === "high"));
assert.ok(weakIssues.some((issue) => issue.issue_type === "weak_alt_text"));
assert.ok(weakIssues.some((issue) => issue.issue_type === "generic_filename"));
assert.ok(weakIssues.some((issue) => issue.issue_type === "duplicate_filename"));

const performance = scorePerformance(weakSeoItems);
assert.ok(performance.score < 90, "oversized files, huge dimensions, and non-modern formats should reduce performance");
assertScore(performance.score);

const incomplete = scoreCompleteness([baseItem({ product_id: "p3", image_role: "gallery" })]);
assert.ok(incomplete.score < 60, "product without a main image should be heavily penalised");
assert.ok(generateIssues([baseItem({ product_id: "p3", image_role: "gallery" })]).some((issue) => issue.issue_type === "missing_main_image" && issue.severity === "critical"));

const inconsistent: AuditScoringItem[] = [
  baseItem({ id: "41111111-1111-4111-8111-111111111111", product_id: "p4", width: 1200, height: 1200 }),
  baseItem({ id: "51111111-1111-4111-8111-111111111111", product_id: "p5", image_id: "img5", width: 1200, height: 1200 }),
  baseItem({ id: "61111111-1111-4111-8111-111111111111", product_id: "p6", image_id: "img6", width: 1600, height: 900 })
];
assert.equal(scoreConsistency(inconsistent).details.dominant_aspect_ratio, "square");
assert.ok(generateIssues(inconsistent).some((issue) => issue.issue_type === "inconsistent_aspect_ratio"));

const visualUnknown = [baseItem({ sharpness_score: null, brightness_score: null, contrast_score: null, clutter_score: null, product_area_ratio: null })];
const visualUnknownIssues = generateIssues(visualUnknown);
assert.equal(visualUnknownIssues.some((issue) => ["likely_blurry", "over_dark", "over_bright", "low_contrast", "cluttered_background", "too_small_in_frame"].includes(issue.issue_type)), false);
assert.equal(scoreImageQuality(visualUnknown).details.visual_scores_not_assessed_count, 1);

const visualKnown = [
  baseItem({
    id: "71111111-1111-4111-8111-111111111111",
    product_area_ratio: 0.2,
    sharpness_score: 10,
    brightness_score: 94,
    contrast_score: 12,
    clutter_score: 88,
    background_style: "cluttered lifestyle"
  })
];
const visualKnownIssues = generateIssues(visualKnown);
assert.ok(visualKnownIssues.some((issue) => issue.issue_type === "too_small_in_frame"));
assert.ok(visualKnownIssues.some((issue) => issue.issue_type === "likely_blurry"));
assert.ok(visualKnownIssues.some((issue) => issue.issue_type === "over_bright"));
assert.ok(visualKnownIssues.some((issue) => issue.issue_type === "low_contrast"));
assert.ok(visualKnownIssues.some((issue) => issue.issue_type === "cluttered_background"));

const google = scoreGoogleShoppingReadiness([
  baseItem({ product_id: "p8", width: 600, height: 600, background_style: "dark textured", promotional_overlay: true })
]);
assert.ok(google.score < 100);
assertScore(google.score);

const manyIssues = [
  { item_id: "same-image", product_id: "p9", issue_type: "missing_alt_text" as const, severity: "high" as const, title: "", description: "", recommended_action: "" },
  { item_id: "same-image", product_id: "p9", issue_type: "weak_alt_text" as const, severity: "medium" as const, title: "", description: "", recommended_action: "" },
  { item_id: "same-image", product_id: "p9", issue_type: "generic_filename" as const, severity: "medium" as const, title: "", description: "", recommended_action: "" },
  { item_id: "same-image", product_id: "p9", issue_type: "cluttered_background" as const, severity: "high" as const, title: "", description: "", recommended_action: "" },
  { item_id: "same-image", product_id: "p9", issue_type: "too_small_in_frame" as const, severity: "high" as const, title: "", description: "", recommended_action: "" },
  { item_id: "same-image", product_id: "p9", issue_type: "oversized_file" as const, severity: "medium" as const, title: "", description: "", recommended_action: "" }
];
const roi = calculateRoiEstimate(manyIssues, [baseItem({ id: "same-image", product_id: "p9" })]);
assert.ok(roi.estimated_manual_minutes_low <= 8);
assert.ok(roi.estimated_manual_minutes_high <= 15);
assert.equal(roi.hourly_rate_used, 40);

const metrics = calculateAuditMetrics([...weakSeoItems, ...visualKnown, ...inconsistent]);
for (const key of [
  "product_image_health_score",
  "seo_score",
  "image_quality_score",
  "catalogue_consistency_score",
  "performance_score",
  "completeness_score",
  "google_shopping_readiness_score"
] as const) {
  assertScore(metrics[key]);
}
const issues = generateIssues([...weakSeoItems, ...visualKnown, ...inconsistent], metrics);
const categoryScores = generateCategoryScores([...weakSeoItems, ...visualKnown, ...inconsistent], issues);
const insights = generateInsights(metrics, issues, categoryScores);
const recommendations = generateRecommendations(metrics, issues, categoryScores);

assert.ok(insights.some((insight) => insight.insight_type === "seo"));
assert.ok(insights.some((insight) => insight.insight_type === "quality"));
assert.ok(insights.some((insight) => insight.insight_type === "performance"));
assert.ok(insights.some((insight) => insight.insight_type === "roi"));
assert.ok(recommendations.some((recommendation) => recommendation.title === "Fix missing alt text"));
assert.ok(recommendations.some((recommendation) => recommendation.title === "Optimise oversized images"));
assert.ok(recommendations.some((recommendation) => recommendation.title === "Standardise main image aspect ratios"));
assert.ok(recommendations.some((recommendation) => recommendation.title === "Improve product feed readiness"));
assert.equal(
  recommendations.find((recommendation) => recommendation.title === "Fix missing alt text")?.action_type,
  "fix_alt_text"
);
assert.equal(
  recommendations.find((recommendation) => recommendation.title === "Optimise oversized images")?.action_type,
  "compress_image"
);
assert.equal(
  recommendations.find((recommendation) => recommendation.title === "Standardise main image aspect ratios")?.action_type,
  "regenerate_thumbnail"
);

console.log("Image audit scoring checks passed.");
