import { prisma } from "../utils/prisma";
import { generateApiToken, hashApiToken } from "../utils/apiToken";
import { HttpError } from "../utils/httpError";
import { canonicalizeDomain, isStagingDomain, noteAbuseSignal, type SiteMetadata } from "./storeClaimService";

export type ConnectedSiteResult = {
  site: {
    id: string;
    domain: string;
    canonical_domain: string | null;
    claim_status: string;
  };
  api_token: string;
  free_credit_message: string;
};

export type ConnectSiteInput = SiteMetadata & {
  domain: string;
};

export const connectSite = async (userId: string, input: ConnectSiteInput): Promise<ConnectedSiteResult> => {
  const normalizedDomain = canonicalizeDomain(input.domain);
  const canonicalDomain = canonicalizeDomain(input.homeUrl || input.siteUrl || input.domain);
  const claimStatus = isStagingDomain(canonicalDomain) ? "staging" : "pending";

  const existingVerifiedClaim = await prisma.connectedSite.findFirst({
    where: {
      canonical_domain: canonicalDomain,
      user_id: {
        not: userId
      },
      claim_status: "verified"
    },
    select: {
      id: true,
      user_id: true
    }
  });

  if (existingVerifiedClaim) {
    noteAbuseSignal("attempted token creation for already claimed store", {
      canonicalDomain,
      accountId: userId,
      existingAccountId: existingVerifiedClaim.user_id
    });

    throw new HttpError(409, "This WooCommerce store is already connected to another Optivra account. If you own this store, request a transfer or contact support.", {
      code: "store_already_claimed"
    });
  }

  const apiToken = generateApiToken();
  const apiTokenHash = hashApiToken(apiToken);

  const site = await prisma.connectedSite.upsert({
    where: {
      user_id_domain: {
        user_id: userId,
        domain: normalizedDomain
      }
    },
    update: {
      api_token_hash: apiTokenHash,
      canonical_domain: canonicalDomain,
      site_url: input.siteUrl,
      home_url: input.homeUrl,
      wordpress_install_id: input.wordpressInstallId,
      plugin_version: input.pluginVersion,
      woocommerce_version: input.woocommerceVersion,
      claim_status: claimStatus,
      last_seen_at: new Date()
    },
    create: {
      user_id: userId,
      domain: normalizedDomain,
      canonical_domain: canonicalDomain,
      site_url: input.siteUrl,
      home_url: input.homeUrl,
      wordpress_install_id: input.wordpressInstallId,
      plugin_version: input.pluginVersion,
      woocommerce_version: input.woocommerceVersion,
      claim_status: claimStatus,
      last_seen_at: new Date(),
      api_token_hash: apiTokenHash
    },
    select: {
      id: true,
      domain: true,
      canonical_domain: true,
      claim_status: true
    }
  });

  return {
    site,
    api_token: apiToken,
    free_credit_message: claimStatus === "staging"
      ? "Staging and development stores can connect for testing but do not receive free credits."
      : "Connect this token from the WooCommerce plugin to verify the production store and claim free credits."
  };
};
