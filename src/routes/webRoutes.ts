import { readFileSync } from "fs";
import { Router } from "express";
import path from "path";

const siteBaseUrl = "https://www.optivra.app";
const indexPath = path.resolve(process.cwd(), "public", "site", "index.html");

const blogSlugs = [
  "how-to-optimise-woocommerce-product-images-for-seo",
  "woocommerce-product-image-seo-checklist",
  "how-to-write-alt-text-for-woocommerce-product-images",
  "how-to-replace-product-image-backgrounds-in-woocommerce",
  "ai-product-photography-for-woocommerce-stores"
];

const webPaths = new Set([
  "/",
  "/plugins",
  "/catalogue-image-studio",
  "/optivra-image-studio",
  "/pricing",
  "/downloads",
  "/resources",
  "/blog",
  ...blogSlugs.map((slug) => `/blog/${slug}`),
  ...blogSlugs.map((slug) => `/resources/${slug}`),
  "/login",
  "/dashboard",
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
const socialImage = `${siteBaseUrl}/assets/hero-image.png`;

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
    description: "WooCommerce product image optimisation with AI-powered background replacement, review workflows, and SEO-friendly image metadata.",
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
    description: "AI-powered product image optimisation, background replacement, review workflow, and SEO metadata for WooCommerce.",
    brand: {
      "@type": "Brand",
      name: "Optivra"
    }
  },
  faqJsonLd
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
  "ai-product-photography-for-woocommerce-stores": "AI Product Photography for WooCommerce Stores"
};

const metaForPath = (requestPath: string): PageMeta => {
  const normalizedPath = requestPath === "/catalogue-image-studio" ? "/optivra-image-studio" : requestPath;
  const blogSlug = normalizedPath.startsWith("/blog/") ? normalizedPath.replace("/blog/", "") : "";

  if (blogSlug && blogTitles[blogSlug]) {
    const title = `${blogTitles[blogSlug]} | Optivra`;
    return {
      title,
      description: `${blogTitles[blogSlug]} with practical WooCommerce image SEO guidance and links to Optivra Image Studio.`,
      canonicalPath: `/blog/${blogSlug}`,
      type: "article",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: blogTitles[blogSlug],
          description: `${blogTitles[blogSlug]} for WooCommerce store owners.`,
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
      title: "Optivra | AI-Powered Ecommerce Tools for WooCommerce",
      description: "Optivra builds AI-powered ecommerce tools for WooCommerce stores, including product image optimisation, SEO metadata, and catalogue workflow automation.",
      canonicalPath: "/",
      jsonLd: [organizationJsonLd, websiteJsonLd]
    },
    "/optivra-image-studio": {
      title: "Optivra Image Studio | WooCommerce Product Image Optimisation",
      description: "Optimise WooCommerce product images with AI-powered background replacement, review workflows, smart framing, and SEO-friendly image metadata.",
      canonicalPath: "/optivra-image-studio",
      jsonLd: imageStudioJsonLd
    },
    "/downloads": {
      title: "Download Optivra Image Studio for WooCommerce",
      description: "Download the Optivra Image Studio WooCommerce plugin and connect your store to AI-powered product image optimisation and SEO metadata tools.",
      canonicalPath: "/downloads"
    },
    "/pricing": {
      title: "Optivra Image Studio Pricing | WooCommerce Image Optimisation Plans",
      description: "Choose an Optivra Image Studio plan for WooCommerce product image optimisation, AI background replacement, SEO metadata, and processing credits.",
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
    "/blog": {
      title: "WooCommerce Image SEO Blog | Optivra",
      description: "Guides for WooCommerce product image SEO, background replacement, alt text, metadata, and AI product photography.",
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
    title: "Optivra | AI-Powered Ecommerce Tools for WooCommerce",
    description: "Optivra builds AI-powered ecommerce tools for WooCommerce stores.",
    canonicalPath: normalizedPath
  };
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderIndex = (requestPath: string): string => {
  const html = readFileSync(indexPath, "utf8");
  const meta = metaForPath(requestPath);
  const canonicalUrl = `${siteBaseUrl}${meta.canonicalPath === "/" ? "/" : meta.canonicalPath}`;
  const robots = meta.robots ?? "index,follow";
  const jsonLd = (meta.jsonLd ?? [])
    .map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`)
    .join("\n    ");

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
    .replace("</head>", `${jsonLd ? `    ${jsonLd}\n` : ""}  </head>`);
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
