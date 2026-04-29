import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SubscriptionPlan } from "@prisma/client";
import { creditPacks, subscriptionPlans } from "../src/services/billingCatalog";
import { FREE_TRIAL_CREDITS, PLAN_CREDIT_LIMITS } from "../src/services/creditService";

const read = (path: string): string => readFileSync(path, "utf8");

assert.equal(FREE_TRIAL_CREDITS, 10, "Free Image Audit should keep 10 starter credits");

assert.deepEqual(
  {
    starter: subscriptionPlans.starter.credits,
    growth: subscriptionPlans.growth.credits,
    pro: subscriptionPlans.pro.credits,
    agency: subscriptionPlans.agency.credits
  },
  {
    starter: 50,
    growth: 200,
    pro: 700,
    agency: 2000
  },
  "Subscription plan config should expose the new monthly credit allowances"
);

assert.deepEqual(
  {
    starter: PLAN_CREDIT_LIMITS[SubscriptionPlan.starter],
    growth: PLAN_CREDIT_LIMITS[SubscriptionPlan.growth],
    pro: PLAN_CREDIT_LIMITS[SubscriptionPlan.pro],
    agency: PLAN_CREDIT_LIMITS[SubscriptionPlan.agency]
  },
  {
    starter: 50,
    growth: 200,
    pro: 700,
    agency: 2000
  },
  "Monthly credit reset mapping should match the public plan config"
);

assert.deepEqual(
  {
    small: creditPacks.small.credits,
    medium: creditPacks.medium.credits,
    large: creditPacks.large.credits,
    agency: creditPacks.agency.credits
  },
  {
    small: 25,
    medium: 120,
    large: 350,
    agency: 1200
  },
  "Credit pack config should expose the new top-up credit quantities"
);

const publicIndex = read("public/site/index.html");
const publicApp = read("public/site/assets/app.js");
const billingService = read("src/services/billingService.ts");

[
  "10 starter credits for verified production stores, where eligible.",
  "50 credits monthly plus platform access, reports, queue workflow, safety checks, review tools, and image processing credits.",
  "200 credits monthly for regular catalogue work and SEO/image cleanup batches.",
  "700 credits monthly for larger stores, scheduled scan workflows and brand preset usage.",
  "2,000 credits monthly for high-volume teams and multi-store reporting.",
  "25 Credits",
  "120 Credits",
  "350 Credits",
  "1,200 Credits",
  "Small top-up for a quick batch.",
  "Best fit for regular catalogue updates.",
  "Extra capacity for larger store passes.",
  "High-volume processing for teams and clients."
].forEach((expectedCopy) => {
  assert.ok(publicIndex.includes(expectedCopy) || publicApp.includes(expectedCopy), `Missing public/billing copy: ${expectedCopy}`);
});

[
  "credits: String(plan.credits)",
  "monthly_credits: String(plan.credits)",
  "credits: String(pack.credits)",
  "addCredits(userId, pack.credits",
  "resetMonthlyCredits(localSubscription.user_id, localSubscription.plan"
].forEach((expectedSource) => {
  assert.ok(billingService.includes(expectedSource), `Billing source should include: ${expectedSource}`);
});

[
  ["20", "credits monthly", "i"],
  ["100", "credits monthly", "i"],
  ["500", "credits monthly", "i"],
  ["1,500", "credits monthly", "i"],
  ["300", "Credits", ""],
  ["1000", "Credits", ""],
  ["Starter", "20", ""],
  ["Growth", "100", ""],
  ["Pro", "500", ""],
  ["Agency", "1500", ""]
].forEach(([first, second, flags]) => {
  const oldPattern = new RegExp(`${first}\\s+${second}`, flags);
  assert.equal(oldPattern.test(publicIndex), false, `Old pricing text remains in public index: ${oldPattern}`);
  assert.equal(oldPattern.test(publicApp), false, `Old pricing text remains in public app: ${oldPattern}`);
});

console.log("Billing credit configuration checks passed.");
