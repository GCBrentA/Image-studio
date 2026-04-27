import type { NextFunction, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { hashApiToken } from "../utils/apiToken";
import { verifyConnectedSite, type SiteMetadata } from "../services/storeClaimService";

export type ApiAuthContext = {
  userId: string;
  siteId: string;
  domain: string;
  canonicalDomain: string | null;
  claimStatus: string | null;
  freeCreditMessage?: string;
};

export type AuthenticatedRequest = Request & {
  auth?: ApiAuthContext;
};

const getSiteMetadata = (request: Request): SiteMetadata => ({
  siteUrl: request.header("x-optivra-site-url") ?? undefined,
  homeUrl: request.header("x-optivra-home-url") ?? undefined,
  wordpressInstallId: request.header("x-optivra-wordpress-install-id") ?? undefined,
  pluginVersion: request.header("x-optivra-plugin-version") ?? undefined,
  wordpressVersion: request.header("x-optivra-wordpress-version") ?? undefined,
  woocommerceVersion: request.header("x-optivra-woocommerce-version") ?? undefined,
  phpVersion: request.header("x-optivra-php-version") ?? undefined,
  adminUrlHash: request.header("x-optivra-admin-url-hash") ?? undefined,
  ipAddress: request.ip
});

const getApiToken = (request: Request): string | null => {
  const authorization = request.header("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return request.header("x-api-token")?.trim() ?? null;
};

export const apiTokenAuth = async (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = getApiToken(request);

    if (!token) {
      response.status(401).json({
        status: "error",
        processed_url: null,
        credits_remaining: null,
        error: "Missing API token"
      });
      return;
    }

    const tokenHash = hashApiToken(token);
    const connectedSite = await prisma.connectedSite.findFirst({
      where: {
        api_token_hash: tokenHash
      },
      select: {
        id: true,
        user_id: true,
        domain: true,
        canonical_domain: true,
        claim_status: true
      }
    });

    if (!connectedSite) {
      response.status(401).json({
        status: "error",
        processed_url: null,
        credits_remaining: null,
        error: "Invalid API token"
      });
      return;
    }

    const metadata = getSiteMetadata(request);
    let freeCreditMessage: string | undefined;
    let canonicalDomain = connectedSite.canonical_domain;
    let claimStatus = connectedSite.claim_status;

    if (metadata.homeUrl || metadata.siteUrl || metadata.wordpressInstallId) {
      const claim = await verifyConnectedSite(
        connectedSite.id,
        connectedSite.user_id,
        connectedSite.domain,
        metadata
      );
      freeCreditMessage = claim.message;
      canonicalDomain = claim.canonicalDomain;
      claimStatus = claim.claimStatus;
    } else {
      await prisma.connectedSite.update({
        where: {
          id: connectedSite.id
        },
        data: {
          last_seen_at: new Date()
        }
      });
    }

    request.auth = {
      userId: connectedSite.user_id,
      siteId: connectedSite.id,
      domain: connectedSite.domain,
      canonicalDomain,
      claimStatus,
      freeCreditMessage
    };

    next();
  } catch (error) {
    next(error);
  }
};
