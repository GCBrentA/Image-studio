import assert from "node:assert/strict";
import { app } from "../src/app";
import { FREE_TRIAL_CREDITS } from "../src/services/creditService";
import { signupFreeCreditsGrantType } from "../src/services/storeClaimService";
import { generateApiToken, hashApiToken } from "../src/utils/apiToken";
import { prisma } from "../src/utils/prisma";

type UsageBody = {
  credits_remaining?: number;
  credits_total?: number;
  canonical_domain?: string;
  free_credit_message?: string;
  error?: string;
};

const requestUsage = async (
  baseUrl: string,
  token: string,
  rawDomain: string,
  installId: string
): Promise<{ status: number; body: UsageBody }> => {
  const response = await fetch(`${baseUrl}/usage`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Optivra-Site-Url": rawDomain,
      "X-Optivra-Home-Url": rawDomain,
      "X-Optivra-WordPress-Install-Id": installId,
      "X-Optivra-Plugin-Version": "test"
    }
  });

  return {
    status: response.status,
    body: await response.json() as UsageBody
  };
};

const main = async (): Promise<void> => {
  const token = generateApiToken();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const canonicalDomain = `free-credit-idempotency-${unique}.example.com`;
  const rawDomain = ` HTTPS://WWW.${canonicalDomain}/ `;
  const installId = `free-credit-idempotency-${unique}`;
  const email = `free-credit-idempotency-${unique}@example.test`;

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: "test-only"
    },
    select: {
      id: true
    }
  });

  await prisma.connectedSite.create({
    data: {
      user_id: user.id,
      domain: rawDomain.trim(),
      api_token_hash: hashApiToken(token),
      claim_status: "pending"
    }
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start test server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const first = await requestUsage(baseUrl, token, rawDomain, installId);
    assert.equal(first.status, 200, `First grant request should succeed: ${JSON.stringify(first.body)}`);
    assert.equal(first.body.canonical_domain, canonicalDomain, "First request should normalize the canonical domain");
    assert.equal(first.body.credits_remaining, FREE_TRIAL_CREDITS, "First request should add trial credits");
    assert.match(first.body.free_credit_message ?? "", /free credits have been added/i);

    const second = await requestUsage(baseUrl, token, rawDomain, installId);
    assert.equal(second.status, 200, `Duplicate grant request should succeed: ${JSON.stringify(second.body)}`);
    assert.equal(second.body.canonical_domain, canonicalDomain, "Second request should reuse the same canonical domain");
    assert.equal(second.body.credits_remaining, FREE_TRIAL_CREDITS, "Duplicate request should not add credits twice");
    assert.match(second.body.free_credit_message ?? "", /already received/i);

    const [grantCount, ledgerCount] = await Promise.all([
      prisma.freeCreditGrant.count({
        where: {
          canonical_domain: canonicalDomain,
          grant_type: signupFreeCreditsGrantType
        }
      }),
      prisma.creditLedger.count({
        where: {
          userId: user.id,
          idempotencyKey: `free-signup-store:${canonicalDomain}`
        }
      })
    ]);

    assert.equal(grantCount, 1, "Only one free credit grant should exist for the domain/grant type");
    assert.equal(ledgerCount, 1, "Only one free signup credit ledger entry should exist");

    console.log(JSON.stringify({
      ok: true,
      canonical_domain: canonicalDomain,
      grant_type: signupFreeCreditsGrantType,
      first_status: first.status,
      first_free_credit_message: first.body.free_credit_message,
      second_status: second.status,
      second_free_credit_message: second.body.free_credit_message,
      free_credit_grant_count: grantCount,
      free_signup_ledger_count: ledgerCount,
      credits_remaining_after_duplicate: second.body.credits_remaining
    }, null, 2));
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await prisma.user.delete({
      where: {
        id: user.id
      }
    }).catch(() => undefined);
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
