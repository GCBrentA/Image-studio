import { CreditLedgerReason, Prisma, type FreeCreditGrant } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { addCredits, FREE_TRIAL_CREDITS } from "./creditService";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";

export const signupFreeCreditsGrantType = "signup_free_credits";

export type SiteMetadata = {
  siteUrl?: string;
  homeUrl?: string;
  wordpressInstallId?: string;
  pluginVersion?: string;
  wordpressVersion?: string;
  woocommerceVersion?: string;
  phpVersion?: string;
  adminUrlHash?: string;
  ipAddress?: string;
};

export type ClaimResult = {
  canonicalDomain: string;
  claimStatus: "verified" | "staging" | "pending";
  freeCreditsGranted: boolean;
  message: string;
};

const stagingHostPatterns = [
  /^localhost$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /\.local$/,
  /\.test$/,
  /\.localhost$/,
  /(^|\.)ngrok-free\.app$/,
  /(^|\.)ngrok\.io$/,
  /(^|\.)wpengine\.com$/,
  /(^|\.)wpenginepowered\.com$/,
  /(^|\.)myshopify\.com$/
];

const stagingSubdomains = new Set(["staging", "stage", "dev", "development", "test", "testing", "preview"]);

export const canonicalizeDomain = (value: string): string => {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    throw new HttpError(400, "domain is required");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
  } catch {
    throw new HttpError(400, "domain must be a valid host or URL");
  }

  let hostname = parsedUrl.hostname.replace(/\.$/, "").replace(/^www\./, "");

  if (!hostname) {
    throw new HttpError(400, "domain must be a valid host or URL");
  }

  return hostname;
};

export const isStagingDomain = (canonicalDomain: string): boolean => {
  if (stagingHostPatterns.some((pattern) => pattern.test(canonicalDomain))) {
    return true;
  }

  const [firstLabel] = canonicalDomain.split(".");
  return stagingSubdomains.has(firstLabel ?? "");
};

const maskInstallId = (installId: string): string =>
  installId.length > 12 ? `${installId.slice(0, 8)}...` : installId;

const isKnownPrismaError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

const logFreeCreditGrantResult = (
  canonicalDomain: string,
  grantType: string,
  created: boolean
): void => {
  console.info("Free credit grant idempotency result", {
    canonical_domain: canonicalDomain,
    grant_type: grantType,
    grant_result: created ? "created" : "already_existed",
    created
  });
};

const findFreeCreditGrant = (
  canonicalDomain: string,
  grantType: string
) =>
  prisma.freeCreditGrant.findUnique({
    where: {
      canonical_domain_grant_type: {
        canonical_domain: canonicalDomain,
        grant_type: grantType
      }
    }
  });

const ensureFreeCreditGrant = async (
  canonicalDomain: string,
  grantType: string,
  accountId: string,
  siteId: string,
  now: Date
): Promise<{ grant: FreeCreditGrant; created: boolean }> => {
  const existingGrant = await findFreeCreditGrant(canonicalDomain, grantType);

  if (existingGrant) {
    logFreeCreditGrantResult(canonicalDomain, grantType, false);
    return {
      grant: existingGrant,
      created: false
    };
  }

  try {
    const grant = await prisma.freeCreditGrant.create({
      data: {
        canonical_domain: canonicalDomain,
        account_id: accountId,
        store_id: siteId,
        credits_granted: FREE_TRIAL_CREDITS,
        grant_type: grantType,
        granted_at: now,
        reason: "Verified production WooCommerce store"
      }
    });

    logFreeCreditGrantResult(canonicalDomain, grantType, true);
    return {
      grant,
      created: true
    };
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      const existingRaceGrant = await findFreeCreditGrant(canonicalDomain, grantType);

      if (existingRaceGrant) {
        logFreeCreditGrantResult(canonicalDomain, grantType, false);
        return {
          grant: existingRaceGrant,
          created: false
        };
      }
    }

    throw error;
  }
};

export const noteAbuseSignal = (message: string, details: Record<string, unknown>): void => {
  console.warn("Store claim abuse diagnostic", {
    message,
    ...details,
    wordpressInstallId: typeof details.wordpressInstallId === "string" ? maskInstallId(details.wordpressInstallId) : undefined
  });
};

export const verifyConnectedSite = async (
  siteId: string,
  accountId: string,
  fallbackDomain: string,
  metadata: SiteMetadata
): Promise<ClaimResult> => {
  const domainSource = metadata.homeUrl || metadata.siteUrl || fallbackDomain;
  const canonicalDomain = canonicalizeDomain(domainSource);
  const staging = isStagingDomain(canonicalDomain);
  const now = new Date();

  const existingClaim = await prisma.connectedSite.findFirst({
    where: {
      canonical_domain: canonicalDomain,
      user_id: {
        not: accountId
      },
      claim_status: "verified"
    },
    select: {
      id: true,
      user_id: true
    }
  });

  if (existingClaim) {
    noteAbuseSignal("same canonical domain attempted by another account", {
      canonicalDomain,
      accountId,
      existingAccountId: existingClaim.user_id,
      siteId
    });

    throw new HttpError(409, "This WooCommerce store is already connected to another Optivra account. If you own this store, request a transfer or contact support.", {
      code: "store_already_claimed"
    });
  }

  if (metadata.wordpressInstallId) {
    const installIdClaim = await prisma.connectedSite.findFirst({
      where: {
        wordpress_install_id: metadata.wordpressInstallId,
        user_id: {
          not: accountId
        }
      },
      select: {
        id: true,
        user_id: true,
        canonical_domain: true
      }
    });

    if (installIdClaim) {
      noteAbuseSignal("same WordPress install ID used by another account", {
        canonicalDomain,
        accountId,
        existingAccountId: installIdClaim.user_id,
        wordpressInstallId: metadata.wordpressInstallId
      });
    }
  }

  const claimStatus = staging ? "staging" : "verified";

  await prisma.connectedSite.update({
    where: {
      id: siteId
    },
    data: {
      canonical_domain: canonicalDomain,
      site_url: metadata.siteUrl,
      home_url: metadata.homeUrl,
      wordpress_install_id: metadata.wordpressInstallId,
      plugin_version: metadata.pluginVersion,
      wordpress_version: metadata.wordpressVersion,
      woocommerce_version: metadata.woocommerceVersion,
      php_version: metadata.phpVersion,
      claim_status: claimStatus,
      verified_at: staging ? null : now,
      last_seen_at: now
    }
  });

  if (staging) {
    return {
      canonicalDomain,
      claimStatus,
      freeCreditsGranted: false,
      message: "Staging and development stores can connect for testing but do not receive free credits."
    };
  }

  const grant = await ensureFreeCreditGrant(
    canonicalDomain,
    signupFreeCreditsGrantType,
    accountId,
    siteId,
    now
  );

  if (grant.created) {
    await addCredits(accountId, FREE_TRIAL_CREDITS, CreditLedgerReason.trial, {
      source: "free_signup_credits",
      description: "Free signup credits",
      idempotencyKey: `free-signup-store:${canonicalDomain}`
    });

    await prisma.connectedSite.update({
      where: {
        id: siteId
      },
      data: {
        free_credits_granted_at: now
      }
    });

    return {
      canonicalDomain,
      claimStatus,
      freeCreditsGranted: true,
      message: `${FREE_TRIAL_CREDITS} free credits have been added to this store.`
    };
  }

  return {
    canonicalDomain,
    claimStatus,
    freeCreditsGranted: false,
    message: "This store has already received its free credit allocation."
  };
};

export const createTransferChallenge = async (
  newAccountId: string,
  canonicalDomain: string
): Promise<{ transferId: string; challenge: string }> => {
  const normalizedDomain = canonicalizeDomain(canonicalDomain);
  const store = await prisma.connectedSite.findFirst({
    where: {
      canonical_domain: normalizedDomain,
      claim_status: "verified"
    },
    select: {
      id: true,
      user_id: true
    }
  });

  if (!store) {
    throw new HttpError(404, "No verified store claim was found for this domain");
  }

  if (store.user_id === newAccountId) {
    throw new HttpError(400, "This store is already connected to your account");
  }

  const challenge = randomBytes(24).toString("base64url");
  const transferTokenHash = createHash("sha256").update(challenge).digest("hex");
  const transfer = await prisma.storeTransferAudit.create({
    data: {
      old_account_id: store.user_id,
      new_account_id: newAccountId,
      store_id: store.id,
      canonical_domain: normalizedDomain,
      transfer_token_hash: transferTokenHash,
      status: "requested"
    },
    select: {
      id: true
    }
  });

  noteAbuseSignal("store transfer requested", {
    canonicalDomain: normalizedDomain,
    oldAccountId: store.user_id,
    newAccountId
  });

  return {
    transferId: transfer.id,
    challenge
  };
};

export const confirmTransferChallenge = async (
  transferId: string,
  challenge: string,
  wordpressInstallId: string
): Promise<{ canonicalDomain: string; storeId: string }> => {
  const transferTokenHash = createHash("sha256").update(challenge).digest("hex");
  const transfer = await prisma.storeTransferAudit.findFirst({
    where: {
      id: transferId,
      transfer_token_hash: transferTokenHash,
      status: "requested"
    },
    select: {
      id: true,
      old_account_id: true,
      new_account_id: true,
      store_id: true,
      canonical_domain: true,
      store: {
        select: {
          wordpress_install_id: true
        }
      }
    }
  });

  if (!transfer) {
    throw new HttpError(404, "Transfer challenge not found or already used");
  }

  if (!wordpressInstallId || transfer.store.wordpress_install_id !== wordpressInstallId) {
    noteAbuseSignal("store transfer confirmation failed install ID check", {
      canonicalDomain: transfer.canonical_domain,
      transferId,
      wordpressInstallId
    });
    throw new HttpError(403, "Transfer must be confirmed from the connected WordPress install");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.connectedSite.update({
      where: {
        id: transfer.store_id
      },
      data: {
        user_id: transfer.new_account_id,
        last_seen_at: new Date()
      }
    });

    await transaction.storeTransferAudit.update({
      where: {
        id: transfer.id
      },
      data: {
        status: "confirmed",
        confirmed_at: new Date(),
        confirmed_by_install_id: wordpressInstallId
      }
    });
  });

  return {
    canonicalDomain: transfer.canonical_domain,
    storeId: transfer.store_id
  };
};
