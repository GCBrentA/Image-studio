import assert from "node:assert/strict";
import { detectRouteGroup, getUnfiredScrollDepthEvents, shouldTrackCheckoutSuccess, shouldTrackPageView, updateAttributionState } from "../src/lib/analytics/attribution";
import { conversionCandidateEvents, analyticsEventMap } from "../src/lib/analytics/eventMap";
import { sanitizeAnalyticsParams } from "../src/lib/analytics/privacy";
import { sendGa4ServerEvent } from "../src/lib/analytics/server";

async function main() {
  const sanitized = sanitizeAnalyticsParams({
    email: "buyer@example.com",
    phone: "+1 555 123 4567",
    api_key: "sk-test",
    checkout_session_id: "cs_test_123",
    raw_error_stack: "Error: boom\n at secret",
    page_path: "/pricing",
    plan_name: "growth",
    clean_url: "https://www.optivra.app/pricing?email=buyer@example.com"
  });

  assert.equal("email" in sanitized, false);
  assert.equal("phone" in sanitized, false);
  assert.equal("api_key" in sanitized, false);
  assert.equal("checkout_session_id" in sanitized, false);
  assert.equal("raw_error_stack" in sanitized, false);
  assert.equal(sanitized.page_path, "/pricing");
  assert.equal(sanitized.plan_name, "growth");
  assert.equal("clean_url" in sanitized, false);

  assert.equal(detectRouteGroup("/pricing"), "pricing");
  assert.equal(detectRouteGroup("/blog/how-to-write-alt-text-for-woocommerce-product-images"), "blog");
  assert.equal(detectRouteGroup("/docs/ai-image-studio"), "docs");
  assert.equal(detectRouteGroup("/billing/success"), "billing");

  const initialTouch = { source: "facebook", medium: "social", campaign: "image_studio_launch", content: "post", term: "" };
  const nextTouch = { source: "google", medium: "cpc", campaign: "retargeting_image_studio", content: "ad", term: "product images" };
  const state = updateAttributionState({}, initialTouch, "/optivra-image-studio");
  const updated = updateAttributionState(state, nextTouch, "/pricing");
  assert.equal(updated.firstTouch?.source, "facebook");
  assert.equal(updated.lastTouch?.source, "google");
  assert.equal(updated.landingPage, "/optivra-image-studio");

  const direct = updateAttributionState(updated, { source: "direct", medium: "none", campaign: "", content: "", term: "" }, "/downloads");
  assert.equal(direct.lastTouch?.source, "google");

  assert.equal(shouldTrackPageView("/pricing", "/pricing"), false);
  assert.equal(shouldTrackPageView("/pricing", "/downloads"), true);

  const fired = new Set<number>([25]);
  assert.deepEqual(getUnfiredScrollDepthEvents(76, fired), [50, 75]);

  const checkoutSeen = new Set<string>();
  assert.equal(shouldTrackCheckoutSuccess(checkoutSeen, "/billing/success:growth"), true);
  assert.equal(shouldTrackCheckoutSuccess(checkoutSeen, "/billing/success:growth"), false);

  assert.equal(conversionCandidateEvents.has("plugin_download_completed"), true);
  assert.equal(conversionCandidateEvents.has("checkout_success_landing"), true);
  assert.ok(analyticsEventMap.some((group) => group.events.some((event) => event.event_name === "server_api_error")));

  delete process.env.GA4_MEASUREMENT_PROTOCOL_SECRET;
  const serverResult = await sendGa4ServerEvent({ eventName: "server_checkout_success", params: { plan_name: "growth" } });
  assert.equal(serverResult.sent, false);
  assert.equal(serverResult.reason, "ga4_measurement_protocol_not_configured");

  console.log("Analytics rule checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
