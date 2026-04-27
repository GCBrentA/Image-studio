import type { Response } from "express";
import { connectSite } from "../services/siteService";
import type { JwtAuthenticatedRequest } from "../middleware/jwtAuth";
import { confirmTransferChallenge, createTransferChallenge } from "../services/storeClaimService";

type ConnectSiteBody = {
  domain?: unknown;
  site_url?: unknown;
  home_url?: unknown;
  wordpress_install_id?: unknown;
  plugin_version?: unknown;
  woocommerce_version?: unknown;
  admin_url_hash?: unknown;
};

type TransferRequestBody = {
  canonical_domain?: unknown;
};

type TransferConfirmBody = {
  transfer_id?: unknown;
  challenge?: unknown;
  wordpress_install_id?: unknown;
};

export const connect = async (
  request: JwtAuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.user) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  const body = request.body as ConnectSiteBody;
  const domain = typeof body.domain === "string" ? body.domain : "";

  response.status(201).json(await connectSite(request.user.userId, {
    domain,
    siteUrl: typeof body.site_url === "string" ? body.site_url : undefined,
    homeUrl: typeof body.home_url === "string" ? body.home_url : undefined,
    wordpressInstallId: typeof body.wordpress_install_id === "string" ? body.wordpress_install_id : undefined,
    pluginVersion: typeof body.plugin_version === "string" ? body.plugin_version : undefined,
    woocommerceVersion: typeof body.woocommerce_version === "string" ? body.woocommerce_version : undefined,
    adminUrlHash: typeof body.admin_url_hash === "string" ? body.admin_url_hash : undefined
  }));
};

export const requestTransfer = async (
  request: JwtAuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.user) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  const body = request.body as TransferRequestBody;
  const canonicalDomain = typeof body.canonical_domain === "string" ? body.canonical_domain : "";
  response.status(201).json(await createTransferChallenge(request.user.userId, canonicalDomain));
};

export const confirmTransfer = async (
  request: JwtAuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.user) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  const body = request.body as TransferConfirmBody;
  const transferId = typeof body.transfer_id === "string" ? body.transfer_id : "";
  const challenge = typeof body.challenge === "string" ? body.challenge : "";
  const wordpressInstallId = typeof body.wordpress_install_id === "string" ? body.wordpress_install_id : "";
  response.status(200).json(await confirmTransferChallenge(transferId, challenge, wordpressInstallId));
};
