import { readFileSync } from "fs";
import { Router } from "express";
import path from "path";
import { env } from "../config/env";

const siteBaseUrl = "https://www.optivra.app";
const indexPath = path.resolve(process.cwd(), "public", "site", "index.html");

const blogSlugs = [
  "how-to-optimise-woocommerce-product-images-for-seo",
  "woocommerce-product-image-seo-checklist",
  "how-to-write-alt-text-for-woocommerce-product-images",
  "how-to-replace-product-image-backgrounds-in-woocommerce",
  "ai-product-photography-for-woocommerce-stores",
  "how-to-control-woocommerce-payment-gateways-by-country",
  "how-to-hide-cash-on-delivery-for-international-woocommerce-orders",
  "how-to-show-different-woocommerce-payment-methods-by-cart-value",
  "why-woocommerce-checkout-payment-rules-matter",
  "how-to-test-woocommerce-payment-gateway-rules-safely"
];

const webPaths = new Set([
  "/",
  "/plugins",
  "/woocommerce-plugins",
  "/catalogue-image-studio",
  "/optivra-image-studio",
  "/free-woocommerce-image-audit",
  "/payment-gateway-rules-for-woocommerce",
  "/pricing",
  "/downloads",
  "/feedback",
  "/unsubscribe",
  "/resources",
  "/blog",
  ...blogSlugs.map((slug) => `/blog/${slug}`),
  ...blogSlugs.map((slug) => `/resources/${slug}`),
  "/login",
  "/dashboard",
  "/reports",
  "/recommendations",
  "/queue",
  "/analytics",
  "/backgrounds",
  "/seo-tools",
  "/settings",
  "/admin",
  "/admin/plugin-analytics",
  "/account/billing",
  "/billing/success",
  "/billing/cancel",
  "/billing/credits/success",
  "/billing/credits/cancel",
  "/docs",
  "/docs/ai-image-studio",
  "/docs/optivra-image-studio",
  "/docs/payment-gateway-rules-for-woocommerce",
  "/support",
  "/terms",
  "/privacy",
  "/refund-policy"
]);

type PageMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  type?: "website" | "article";
  jsonLd?: object[];
};

const privateRobots = "noindex,nofollow";
const socialImage = `${siteBaseUrl}/assets/hero-optivra-image-studio-desktop.webp`;
const gaEnabled = env.nodeEnv === "production" && /^G-[A-Z0-9-]+$/i.test(env.ga4MeasurementId);
const googleTagEnabled = env.nodeEnv === "production" && /^GT-[A-Z0-9-]+$/i.test(env.googleTagId);
const gtmEnabled = env.nodeEnv === "production" && /^GTM-[A-Z0-9-]+$/i.test(env.viteGtmId);

const isPublicAnalyticsPath = (requestPath: string): boolean => {
  const normalizedPath = requestPath === "/catalogue-image-studio" ? "/optivra-image-studio" : requestPath;
  if (
    normalizedPath.startsWith("/admin") ||
    normalizedPath.startsWith("/api") ||
    normalizedPath.startsWith("/account") ||
    normalizedPath.startsWith("/dashboard") ||
    (normalizedPath.startsWith("/billing/") &&
      !["/billing/success", "/billing/cancel", "/billing/credits/success", "/billing/credits/cancel"].includes(normalizedPath))
  ) {
    return false;
  }

  return (
    normalizedPath === "/" ||
    normalizedPath === "/login" ||
    normalizedPath === "/optivra-image-studio" ||
    normalizedPath === "/free-woocommerce-image-audit" ||
    normalizedPath === "/payment-gateway-rules-for-woocommerce" ||
    normalizedPath === "/woocommerce-plugins" ||
    normalizedPath === "/downloads" ||
    normalizedPath === "/feedback" ||
    normalizedPath === "/unsubscribe" ||
    normalizedPath === "/pricing" ||
    normalizedPath === "/support" ||
    normalizedPath === "/privacy" ||
    normalizedPath === "/terms" ||
    normalizedPath === "/refund-policy" ||
    normalizedPath === "/billing/success" ||
    normalizedPath === "/billing/cancel" ||
    normalizedPath === "/billing/credits/success" ||
    normalizedPath === "/billing/credits/cancel" ||
    normalizedPath === "/docs" ||
    normalizedPath === "/blog" ||
    normalizedPath.startsWith("/docs/") ||
    normalizedPath.startsWith("/blog/")
  );
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does scanning use credits?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Scanning only finds WooCommerce product images. Credits are used when images are processed."
      }
    },
    {
      "@type": "Question",
      name: "Can I edit SEO metadata before approval?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Optivra Image Studio lets you review and edit filenames, alt text, titles, captions, and descriptions before approval."
      }
    }
  ]
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Optivra",
  url: siteBaseUrl,
  logo: `${siteBaseUrl}/assets/optivra-logo.png`,
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@optivra.app",
    contactType: "customer support"
  }
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Optivra",
  url: siteBaseUrl
};

const imageStudioJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Optivra Image Studio",
    applicationCategory: "BusinessApplication",
    operatingSystem: "WordPress, WooCommerce",
    description: "WooCommerce product image intelligence with Product Image Health Reports, SEO insights, safe AI background cleanup, review queues, and rollback-aware workflows.",
    url: `${siteBaseUrl}/optivra-image-studio`,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: "19"
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Optivra Image Studio for WooCommerce",
    description: "Product Image Health Reports, safe AI image processing, review workflow, and SEO metadata for WooCommerce.",
    brand: {
      "@type": "Brand",
      name: "Optivra"
    }
  },
  faqJsonLd
];

const gatewayRulesFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does Payment Gateway Rules for WooCommerce process payments?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. It controls payment gateway visibility. Payments are still processed by the WooCommerce payment gateways installed on the store."
      }
    },
    {
      "@type": "Question",
      name: "Does the plugin store card details?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The plugin does not store card details or payment credentials."
      }
    },
    {
      "@type": "Question",
      name: "What happens if all gateways are hidden?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "By default, the plugin restores all gateways to protect checkout. Store owners can change this safety fallback."
      }
    }
  ]
};

const gatewayRulesJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Payment Gateway Rules for WooCommerce",
    applicationCategory: "BusinessApplication",
    operatingSystem: "WordPress, WooCommerce",
    description: "WooCommerce payment gateway visibility rules for billing country, shipping country, active currency, and cart total conditions.",
    url: `${siteBaseUrl}/payment-gateway-rules-for-woocommerce`,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: "0"
    }
  },
  gatewayRulesFaqJsonLd
];

const breadcrumb = (items: Array<{ name: string; path: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: `${siteBaseUrl}${item.path}`
  }))
});

const blogTitles: Record<string, string> = {
  "how-to-optimise-woocommerce-product-images-for-seo": "How to Optimise WooCommerce Product Images for SEO",
  "woocommerce-product-image-seo-checklist": "WooCommerce Product Image SEO Checklist",
  "how-to-write-alt-text-for-woocommerce-product-images": "How to Write Alt Text for WooCommerce Product Images",
  "how-to-replace-product-image-backgrounds-in-woocommerce": "How to Replace Product Image Backgrounds in WooCommerce",
  "ai-product-photography-for-woocommerce-stores": "AI Product Photography for WooCommerce Stores",
  "how-to-control-woocommerce-payment-gateways-by-country": "How to Control WooCommerce Payment Gateways by Country",
  "how-to-hide-cash-on-delivery-for-international-woocommerce-orders": "How to Hide Cash on Delivery for International WooCommerce Orders",
  "how-to-show-different-woocommerce-payment-methods-by-cart-value": "How to Show Different WooCommerce Payment Methods by Cart Value",
  "why-woocommerce-checkout-payment-rules-matter": "Why WooCommerce Checkout Payment Rules Matter",
  "how-to-test-woocommerce-payment-gateway-rules-safely": "How to Test WooCommerce Payment Gateway Rules Safely"
};

const blogDescriptions: Record<string, string> = {
  "how-to-optimise-woocommerce-product-images-for-seo": "Learn how to optimise WooCommerce product images with better filenames, alt text, image sizes, backgrounds, compression, and metadata.",
  "woocommerce-product-image-seo-checklist": "Use this WooCommerce product image SEO checklist before publishing product images in your store.",
  "how-to-write-alt-text-for-woocommerce-product-images": "Write useful WooCommerce product image alt text that supports accessibility, product context, and search relevance.",
  "how-to-replace-product-image-backgrounds-in-woocommerce": "Compare background replacement options for WooCommerce product images and learn how to review changes safely.",
  "ai-product-photography-for-woocommerce-stores": "Learn how AI product photography tools can help WooCommerce stores improve product images, backgrounds, metadata, and catalogue consistency.",
  "how-to-control-woocommerce-payment-gateways-by-country": "Learn how to control WooCommerce payment gateways by billing country and shipping country with safe checkout rules.",
  "how-to-hide-cash-on-delivery-for-international-woocommerce-orders": "Hide Cash on Delivery for international WooCommerce orders using payment gateway rules based on shipping country.",
  "how-to-show-different-woocommerce-payment-methods-by-cart-value": "Use WooCommerce cart total rules to show or hide payment gateways based on checkout order value.",
  "why-woocommerce-checkout-payment-rules-matter": "Learn why WooCommerce checkout payment rules matter for international stores, high-value orders, and operational control.",
  "how-to-test-woocommerce-payment-gateway-rules-safely": "Test WooCommerce payment gateway rules safely with checkout scenarios, cache checks, and rule priority review."
};

const metaForPath = (requestPath: string): PageMeta => {
  const normalizedPath = requestPath === "/catalogue-image-studio" ? "/optivra-image-studio" : requestPath;
  const blogSlug = normalizedPath.startsWith("/blog/") ? normalizedPath.replace("/blog/", "") : "";

  if (blogSlug && blogTitles[blogSlug]) {
    const title = `${blogTitles[blogSlug]} | Optivra`;
    const description = blogDescriptions[blogSlug];
    return {
      title,
      description,
      canonicalPath: `/blog/${blogSlug}`,
      type: "article",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: blogTitles[blogSlug],
          description,
          author: {
            "@type": "Organization",
            name: "Optivra"
          },
          publisher: organizationJsonLd,
          mainEntityOfPage: `${siteBaseUrl}/blog/${blogSlug}`
        },
        breadcrumb([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: blogTitles[blogSlug], path: `/blog/${blogSlug}` }
        ])
      ]
    };
  }

  const meta: Record<string, PageMeta> = {
    "/": {
      title: "Optivra | WooCommerce Product Image Intelligence",
      description: "Run a free WooCommerce Product Image Health Report, find image SEO, speed, consistency and product presentation issues, then fix priority product images safely with AI.",
      canonicalPath: "/",
      jsonLd: [organizationJsonLd, websiteJsonLd]
    },
    "/woocommerce-plugins": {
      title: "WooCommerce Plugins by Optivra | Checkout Rules and Image Optimisation",
      description: "Download WooCommerce plugins from Optivra, including Payment Gateway Rules for WooCommerce and Optivra Image Studio for product image optimisation and SEO metadata.",
      canonicalPath: "/woocommerce-plugins",
      jsonLd: [
        breadcrumb([
          { name: "Home", path: "/" },
          { name: "WooCommerce Plugins", path: "/woocommerce-plugins" }
        ])
      ]
    },
    "/optivra-image-studio": {
      title: "Optivra Image Studio | WooCommerce Product Image SEO & AI Image Optimisation",
      description: "Scan, score and improve WooCommerce product images with Image Health Reports, SEO insights, safe AI background cleanup, review queues and rollback.",
      canonicalPath: "/optivra-image-studio",
      jsonLd: imageStudioJsonLd
    },
    "/free-woocommerce-image-audit": {
      title: "Free WooCommerce Product Image Audit | Optivra",
      description: "Find missing alt text, oversized images, generic filenames, inconsistent backgrounds and product image issues with a free Product Image Health Report.",
      canonicalPath: "/free-woocommerce-image-audit",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Free WooCommerce Product Image Health Report",
          applicationCategory: "BusinessApplication",
          operatingSystem: "WordPress, WooCommerce",
          description: "Free WooCommerce product image audit for missing alt text, oversized images, generic filenames, consistency issues and product-feed readiness opportunities.",
          url: `${siteBaseUrl}/free-woocommerce-image-audit`,
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: "0"
          }
        },
        faqJsonLd
      ]
    },
    "/payment-gateway-rules-for-woocommerce": {
      title: "Free WooCommerce Payment Gateway Rules Plugin | Optivra",
      description: "Control WooCommerce payment gateways by cart value, currency, country, shipping method, user role and more.",
      canonicalPath: "/payment-gateway-rules-for-woocommerce",
      jsonLd: gatewayRulesJsonLd
    },
    "/downloads": {
      title: "Download WooCommerce Plugins | Optivra",
      description: "Download Optivra WooCommerce plugins, including Optivra Image Studio and Payment Gateway Rules for WooCommerce.",
      canonicalPath: "/downloads"
    },
    "/feedback": {
      title: "Optivra Plugin Feedback | Optivra",
      description: "Share private feedback about your Optivra WooCommerce plugin experience.",
      canonicalPath: "/feedback"
    },
    "/unsubscribe": {
      title: "Unsubscribe | Optivra",
      description: "Update Optivra plugin email preferences without logging in.",
      canonicalPath: "/unsubscribe"
    },
    "/pricing": {
      title: "Optivra Pricing | Free Image Audit & AI Image Processing Credits",
      description: "Start with a free Product Image Health Report. Use credits when Optivra processes, optimises or improves WooCommerce product images.",
      canonicalPath: "/pricing"
    },
    "/docs/ai-image-studio": {
      title: "Optivra Image Studio Guide | WooCommerce Image Optimisation Docs",
      description: "Learn how to install, connect, scan, process, review, approve, and optimise WooCommerce product images with Optivra Image Studio.",
      canonicalPath: "/docs/optivra-image-studio",
      type: "article",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Optivra Image Studio Guide",
          description: "WooCommerce image optimisation documentation for Optivra Image Studio.",
          author: {
            "@type": "Organization",
            name: "Optivra"
          },
          mainEntityOfPage: `${siteBaseUrl}/docs/optivra-image-studio`
        },
        breadcrumb([
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "Optivra Image Studio Guide", path: "/docs/optivra-image-studio" }
        ]),
        faqJsonLd
      ]
    },
    "/docs/optivra-image-studio": {
      title: "Optivra Image Studio Guide | WooCommerce Image Optimisation Docs",
      description: "Learn how to install, connect, scan, process, review, approve, and optimise WooCommerce product images with Optivra Image Studio.",
      canonicalPath: "/docs/optivra-image-studio",
      type: "article"
    },
    "/docs/payment-gateway-rules-for-woocommerce": {
      title: "Payment Gateway Rules for WooCommerce Guide | Setup and Rule Examples",
      description: "Learn how to install Payment Gateway Rules for WooCommerce, create checkout gateway rules, test payment method visibility, and troubleshoot common issues.",
      canonicalPath: "/docs/payment-gateway-rules-for-woocommerce",
      type: "article",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Payment Gateway Rules for WooCommerce Guide",
          description: "Setup and rule examples for controlling WooCommerce payment gateway visibility.",
          author: {
            "@type": "Organization",
            name: "Optivra"
          },
          mainEntityOfPage: `${siteBaseUrl}/docs/payment-gateway-rules-for-woocommerce`
        },
        breadcrumb([
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "Payment Gateway Rules for WooCommerce Guide", path: "/docs/payment-gateway-rules-for-woocommerce" }
        ]),
        gatewayRulesFaqJsonLd
      ]
    },
    "/blog": {
      title: "WooCommerce Product Image Optimisation Blog | Optivra",
      description: "Practical guides for improving WooCommerce product photography, image SEO, backgrounds, metadata, and catalogue workflows.",
      canonicalPath: "/blog"
    },
    "/support": {
      title: "Support | Optivra",
      description: "Get support for Optivra Image Studio setup, WooCommerce plugin connection, billing, credits, and image processing.",
      canonicalPath: "/support"
    },
    "/privacy": {
      title: "Privacy Policy | Optivra",
      description: "Optivra privacy information for account, billing, connected site, and image processing data.",
      canonicalPath: "/privacy"
    },
    "/terms": {
      title: "Terms | Optivra",
      description: "Terms for using Optivra and Optivra Image Studio.",
      canonicalPath: "/terms"
    },
    "/account/billing": {
      title: "Billing & Credits | Optivra Image Studio",
      description: "Private Optivra Image Studio billing page.",
      canonicalPath: "/account/billing",
      robots: privateRobots
    },
    "/dashboard": {
      title: "Dashboard | Optivra Image Studio",
      description: "Private Optivra account dashboard.",
      canonicalPath: "/dashboard",
      robots: privateRobots
    },
    "/reports": {
      title: "Product Image Health Reports | Optivra Image Studio",
      description: "Private Product Image Health Report history and detail pages.",
      canonicalPath: "/reports",
      robots: privateRobots
    },
    "/recommendations": {
      title: "Recommendations | Optivra Image Studio",
      description: "Private product image recommendations workspace.",
      canonicalPath: "/recommendations",
      robots: privateRobots
    },
    "/queue": {
      title: "Queue | Optivra Image Studio",
      description: "Private product image processing queue workspace.",
      canonicalPath: "/queue",
      robots: privateRobots
    },
    "/analytics": {
      title: "Analytics | Optivra Image Studio",
      description: "Private Optivra growth and image workflow analytics.",
      canonicalPath: "/analytics",
      robots: privateRobots
    },
    "/backgrounds": {
      title: "Backgrounds | Optivra Image Studio",
      description: "Private background preset workspace.",
      canonicalPath: "/backgrounds",
      robots: privateRobots
    },
    "/seo-tools": {
      title: "SEO Tools | Optivra Image Studio",
      description: "Private image SEO tools workspace.",
      canonicalPath: "/seo-tools",
      robots: privateRobots
    },
    "/settings": {
      title: "Settings | Optivra Image Studio",
      description: "Private Optivra Image Studio settings.",
      canonicalPath: "/settings",
      robots: privateRobots
    },
    "/admin": {
      title: "Admin | Optivra",
      description: "Private Optivra admin page.",
      canonicalPath: "/admin",
      robots: privateRobots
    },
    "/admin/plugin-analytics": {
      title: "Optivra Image Studio Analytics | Optivra",
      description: "Private internal analytics dashboard.",
      canonicalPath: "/admin/plugin-analytics",
      robots: privateRobots
    },
    "/billing/success": {
      title: "Billing Success | Optivra",
      description: "Private checkout success page.",
      canonicalPath: "/billing/success",
      robots: privateRobots
    },
    "/billing/cancel": {
      title: "Billing Cancelled | Optivra",
      description: "Private checkout cancellation page.",
      canonicalPath: "/billing/cancel",
      robots: privateRobots
    },
    "/billing/credits/success": {
      title: "Credit Purchase Success | Optivra",
      description: "Private credit checkout success page.",
      canonicalPath: "/billing/credits/success",
      robots: privateRobots
    },
    "/billing/credits/cancel": {
      title: "Credit Purchase Cancelled | Optivra",
      description: "Private credit checkout cancellation page.",
      canonicalPath: "/billing/credits/cancel",
      robots: privateRobots
    }
  };

  return meta[normalizedPath] ?? {
    title: "Optivra | WooCommerce Product Image Intelligence",
    description: "Run a free WooCommerce Product Image Health Report and fix priority product image opportunities safely with AI.",
    canonicalPath: normalizedPath
  };
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderAnalyticsSnippet = (requestPath: string): string => {
  if (!isPublicAnalyticsPath(requestPath)) return "";

  const measurementId = escapeHtml(env.ga4MeasurementId);
  const googleTagId = escapeHtml(env.googleTagId);
  const primaryTagId = measurementId || googleTagId;
  const gtmId = escapeHtml(env.viteGtmId);
  const debugEnabled = env.analyticsDebug && env.nodeEnv !== "production";
  const enabled = gaEnabled || googleTagEnabled || gtmEnabled || debugEnabled;
  if (!enabled) {
    return `
    <script>
      window.optivraAnalytics = { enabled: false, environment: "${escapeHtml(env.nodeEnv)}", debug: ${debugEnabled ? "true" : "false"}, serverEndpoint: "/api/analytics/events" };
    </script>
`;
  }

  return `
    <script>
      window.optivraAnalytics = {
        enabled: true,
        measurementId: "${measurementId}",
        googleTagId: "${googleTagId}",
        gtmId: "${gtmId}",
        environment: "${escapeHtml(env.nodeEnv)}",
        debug: ${debugEnabled ? "true" : "false"},
        serverEndpoint: "/api/analytics/events",
        gtagLoaded: false,
        gtagLoadError: false
      };
      window.dataLayer = window.dataLayer || [];
      function gtag(){window.dataLayer.push(arguments);}
      (function(){
        try {
          if (window.localStorage && window.localStorage.getItem("optivra_analytics_consent") === "denied") {
            window.optivraAnalytics.enabled = false;
            return;
          }
          ${gtmEnabled ? `
          var gtm = document.createElement("script");
          gtm.async = true;
          gtm.src = "https://www.googletagmanager.com/gtm.js?id=${gtmId}";
          document.head.appendChild(gtm);
          ` : ""}
          ${gaEnabled || googleTagEnabled ? `
          var tag = document.createElement("script");
          tag.async = true;
          tag.src = "https://www.googletagmanager.com/gtag/js?id=${primaryTagId}";
          tag.dataset.optivraAnalyticsTag = "gtag";
          tag.onload = function(){ window.optivraAnalytics.gtagLoaded = true; };
          tag.onerror = function(){ window.optivraAnalytics.gtagLoadError = true; };
          document.head.appendChild(tag);
          gtag("js", new Date());
          ${gaEnabled ? `gtag("config", "${measurementId}", { page_path: window.location.pathname, anonymize_ip: true, send_page_view: false });` : ""}
          ` : ""}
          ${googleTagEnabled ? `gtag("config", "${googleTagId}", { page_path: window.location.pathname, anonymize_ip: true, send_page_view: false });` : ""}
        } catch (error) {
          window.optivraAnalytics.enabled = false;
        }
      })();
    </script>
`;
};

const renderIndex = (requestPath: string): string => {
  const html = readFileSync(indexPath, "utf8");
  const meta = metaForPath(requestPath);
  const canonicalUrl = `${siteBaseUrl}${meta.canonicalPath === "/" ? "/" : meta.canonicalPath}`;
  const robots = meta.robots ?? "index,follow";
  const jsonLd = (meta.jsonLd ?? [])
    .map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`)
    .join("\n    ");

  const analyticsSnippet = renderAnalyticsSnippet(requestPath);
  const verificationMeta = env.googleSiteVerification
    ? `<meta name="google-site-verification" content="${escapeHtml(env.googleSiteVerification)}" />`
    : "";

  return html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(meta.description)}" />`)
    .replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/>/, `<meta name="robots" content="${robots}" />`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonicalUrl}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonicalUrl}" />`)
    .replace(/<meta\s+property="og:type"\s+content="[^"]*"\s*\/>/, `<meta property="og:type" content="${meta.type ?? "website"}" />`)
    .replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/, `<meta property="og:image" content="${socialImage}" />`)
    .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`)
    .replace(/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${socialImage}" />`)
    .replace(/<meta\s+name="google-site-verification"\s+content="[^"]*"\s*\/>/, verificationMeta)
    .replace("</head>", `${jsonLd ? `    ${jsonLd}\n` : ""}${analyticsSnippet}  </head>`);
};

export const webRoutes = Router();

webRoutes.get("/account", (_request, response) => {
  response.redirect(302, "/dashboard");
});

webRoutes.get("/account/sites", (_request, response) => {
  response.redirect(302, "/dashboard");
});

webRoutes.get("/account/credits", (_request, response) => {
  response.redirect(302, "/account/billing#buy-credits");
});

webRoutes.get([...webPaths], (request, response) => {
  response.type("html").send(renderIndex(request.path));
});
