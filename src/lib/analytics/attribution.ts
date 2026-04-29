export type AttributionTouch = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
};

export type AttributionState = {
  firstTouch?: AttributionTouch;
  lastTouch?: AttributionTouch;
  landingPage?: string;
  entryRouteGroup?: string;
};

const emptyTouch: AttributionTouch = {
  source: "direct",
  medium: "none",
  campaign: "",
  content: "",
  term: ""
};

export const detectRouteGroup = (path = "/"): string => {
  const normalized = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (normalized === "/") return "home";
  if (normalized.startsWith("/blog") || normalized.startsWith("/resources")) return "blog";
  if (normalized.startsWith("/docs")) return "docs";
  if (normalized.startsWith("/downloads")) return "downloads";
  if (normalized.startsWith("/pricing")) return "pricing";
  if (normalized.startsWith("/optivra-image-studio") || normalized.startsWith("/catalogue-image-studio")) return "product_image_studio";
  if (normalized.startsWith("/payment-gateway-rules")) return "product_payment_gateway_rules";
  if (normalized.startsWith("/woocommerce-plugins") || normalized.startsWith("/plugins")) return "plugins";
  if (normalized.startsWith("/support")) return "support";
  if (normalized.startsWith("/billing")) return "billing";
  if (normalized.startsWith("/account") || normalized.startsWith("/dashboard")) return "account";
  if (normalized.startsWith("/admin")) return "admin";
  if (normalized.startsWith("/auth") || normalized.startsWith("/login")) return "auth";
  if (normalized.startsWith("/api")) return "api";
  return "other";
};

export const attributionFromUrl = (urlValue: string, referrerValue = ""): AttributionTouch => {
  try {
    const url = new URL(urlValue, "https://www.optivra.app");
    const source = url.searchParams.get("utm_source") || "";
    const medium = url.searchParams.get("utm_medium") || "";
    const campaign = url.searchParams.get("utm_campaign") || "";
    const content = url.searchParams.get("utm_content") || "";
    const term = url.searchParams.get("utm_term") || "";

    if (source || medium || campaign || content || term) {
      return {
        source: source || "campaign",
        medium: medium || "unknown",
        campaign,
        content,
        term
      };
    }
  } catch {
    return emptyTouch;
  }

  if (referrerValue) {
    try {
      const referrer = new URL(referrerValue);
      if (!/(^|\.)optivra\.app$/i.test(referrer.hostname)) {
        return {
          source: referrer.hostname.replace(/^www\./i, ""),
          medium: "referral",
          campaign: "",
          content: "",
          term: ""
        };
      }
    } catch {
      return emptyTouch;
    }
  }

  return emptyTouch;
};

export const updateAttributionState = (
  state: AttributionState,
  currentTouch: AttributionTouch,
  currentPath: string
): AttributionState => {
  const next: AttributionState = {
    ...state,
    landingPage: state.landingPage || currentPath,
    entryRouteGroup: state.entryRouteGroup || detectRouteGroup(currentPath)
  };

  if (!next.firstTouch) {
    next.firstTouch = currentTouch;
  }

  const isMeaningfulTouch = currentTouch.source !== "direct" || currentTouch.medium !== "none" || Boolean(currentTouch.campaign);
  if (isMeaningfulTouch || !next.lastTouch) {
    next.lastTouch = currentTouch;
  }

  return next;
};

export const shouldTrackPageView = (previousPath: string | null | undefined, nextPath: string): boolean => previousPath !== nextPath;

export const getUnfiredScrollDepthEvents = (percent: number, fired: Set<number>): number[] =>
  [25, 50, 75, 90].filter((depth) => percent >= depth && !fired.has(depth));

export const checkoutSuccessKey = (path: string, planName?: string | null): string => `${path.split("?")[0]}:${planName || "unknown"}`;

export const shouldTrackCheckoutSuccess = (seen: Set<string>, key: string): boolean => {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
};

