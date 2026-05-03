import type { NextFunction, Request, Response } from "express";
import { verifyConnectedSite, type SiteMetadata } from "../services/storeClaimService";
import { getApiTokenFingerprint, hasEmbeddedApiToken, hashApiTokenCandidates } from "../utils/apiToken";
import { verifyJwt } from "../utils/jwt";
import { prisma } from "../utils/prisma";

export type ImageStudioAuthContext = {
  authType: "site_token" | "account_jwt";
  userId: string;
  siteId?: string;
  domain?: string;
  canonicalDomain?: string | null;
};

export type ImageStudioAuthenticatedRequest = Request & {
  imageStudioAuth?: ImageStudioAuthContext;
};

const getBearerToken = (request: Request): string | null => {
  const authorization = request.header("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return null;
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

export const imageStudioAuth = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiToken = request.header("x-api-token")?.trim() ?? getBearerToken(request);

    if (apiToken) {
      const tokenHashes = hashApiTokenCandidates(apiToken);
      const connectedSite = await prisma.connectedSite.findFirst({
        where: {
          OR: [
            {
              api_token_hash: {
                in: tokenHashes
              }
            },
            {
              previous_api_token_hash: {
                in: tokenHashes
              }
            }
          ]
        },
        select: {
          id: true,
          user_id: true,
          domain: true,
          canonical_domain: true
        }
      });

      if (connectedSite) {
        const metadata = getSiteMetadata(request);
        let canonicalDomain = connectedSite.canonical_domain;

        if (metadata.homeUrl || metadata.siteUrl || metadata.wordpressInstallId) {
          const claim = await verifyConnectedSite(
            connectedSite.id,
            connectedSite.user_id,
            connectedSite.domain,
            metadata
          );
          canonicalDomain = claim.canonicalDomain;
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

        request.imageStudioAuth = {
          authType: "site_token",
          userId: connectedSite.user_id,
          siteId: connectedSite.id,
          domain: connectedSite.domain,
          canonicalDomain
        };
        next();
        return;
      }
    }

    const jwtToken = getBearerToken(request);
    if (jwtToken) {
      const payload = verifyJwt(jwtToken);
      request.imageStudioAuth = {
        authType: "account_jwt",
        userId: payload.sub
      };
      next();
      return;
    }

    if (apiToken) {
      console.warn("Invalid image-studio site API token rejected", {
        tokenFingerprint: getApiTokenFingerprint(apiToken),
        embeddedTokenExtracted: hasEmbeddedApiToken(apiToken),
        authHeaderPresent: Boolean(request.header("authorization")),
        xApiTokenPresent: Boolean(request.header("x-api-token")),
        siteUrl: request.header("x-optivra-site-url") ?? null,
        homeUrl: request.header("x-optivra-home-url") ?? null
      });
    }

    response.status(401).json({
      status: "error",
      error: apiToken ? "Invalid API token" : "Missing auth token",
      code: apiToken ? "invalid_api_token" : "missing_auth_token"
    });
  } catch (error) {
    next(error);
  }
};
