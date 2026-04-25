import { prisma } from "../utils/prisma";
import { generateApiToken, hashApiToken } from "../utils/apiToken";
import { HttpError } from "../utils/httpError";

export type ConnectedSiteResult = {
  site: {
    id: string;
    domain: string;
  };
  api_token: string;
};

const normalizeDomain = (domain: string): string => {
  const trimmed = domain.trim().toLowerCase();

  if (!trimmed) {
    throw new HttpError(400, "domain is required");
  }

  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    throw new HttpError(400, "domain must be a valid host or URL");
  }
};

export const connectSite = async (userId: string, domain: string): Promise<ConnectedSiteResult> => {
  const normalizedDomain = normalizeDomain(domain);
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
      api_token_hash: apiTokenHash
    },
    create: {
      user_id: userId,
      domain: normalizedDomain,
      api_token_hash: apiTokenHash
    },
    select: {
      id: true,
      domain: true
    }
  });

  return {
    site,
    api_token: apiToken
  };
};
