const pages = Array.from(document.querySelectorAll("[data-page]"));
const navLinks = Array.from(document.querySelectorAll("[data-link]"));
const menuToggle = document.querySelector(".mobile-menu-toggle");
const primaryNav = document.getElementById("primary-navigation");
const tokenKey = "optivra_token";
const PRODUCT_NAME = "Optivra Image Studio";
const PRODUCT_NAME_WOOCOMMERCE = "Optivra Image Studio for WooCommerce";
const PRODUCT_TAGLINE = "AI-powered product image optimisation for WooCommerce.";
const pluginRelease = {
  name: "Optivra Image Studio for WooCommerce",
  version: "1.0.0",
  zipPath: "/downloads/optivra-image-studio-for-woocommerce-1.0.0.zip",
  fileSize: "61.5 KB",
  sha256: "546DB7F93B878FEDD7248B0C037918D23A853A87D9400D2F972D9CF693290634",
  wordpressOrgStatus: "WordPress.org review pending",
  updatedAt: "2026-04-29"
};
const gatewayRulesRelease = {
  name: "Payment Gateway Rules for WooCommerce",
  version: "1.0.0",
  zipPath: "/downloads/payment-gateway-rules-for-woocommerce-1.0.0.zip",
  fileSize: "177.5 KB",
  sha256: "33E82D8FABAC9002CB103CF8E210286709345C66C2965C03522BAA2B30AFFDF4",
  status: "Early access",
  updatedAt: "2026-04-28"
};
const blogArticles = [
  {
    slug: "how-to-optimise-woocommerce-product-images-for-seo",
    title: "How to Optimise WooCommerce Product Images for SEO",
    tag: "WooCommerce image SEO",
    date: "Guide",
    readTime: "8 min read",
    excerpt: "Learn how better filenames, alt text, backgrounds, compression, dimensions, and review workflows improve WooCommerce product image SEO.",
    meta: "Learn how to optimise WooCommerce product images with better filenames, alt text, image sizes, backgrounds, compression, and metadata.",
    sections: [
      ["Why product image SEO matters for WooCommerce", "Product images do more than make a product page look good. They help shoppers understand the item, support accessibility, influence page speed, and give search engines extra context about what you sell. In WooCommerce, weak image metadata often comes from exported camera names, repeated alt text, inconsistent backgrounds, and images uploaded quickly without a review step."],
      ["Use descriptive image filenames", "Rename files before publishing or approval. A useful filename should describe the product and category in plain language. Bad filename: photoroom-20251212-154642-scaled.webp. Good filename: hi-capa-holster-gel-blaster-accessory.webp. Keep filenames lowercase, hyphen-separated, and focused on the product rather than the editing app."],
      ["Write helpful alt text", "Alt text should describe the product naturally. Avoid generic text such as Product image. A stronger example is: Hi Capa holster for gel blaster pistols shown as a black tactical sidearm accessory. Include the product name where it helps, but do not stuff keywords."],
      ["Use consistent image backgrounds", "Consistent backgrounds make catalogue pages easier to scan and compare. White and soft grey backgrounds work well for marketplaces and clean ecommerce layouts. Branded backgrounds can work for specialist stores, but they should not overpower the product."],
      ["Compress images without ruining quality", "Large image files slow product pages. Use WebP where possible, keep a high-quality master image, and compress the final image for web delivery. Aim for clear product detail without oversized files."],
      ["Use the right image dimensions", "Square images are common for catalogue grids, but the product should not be shrunk too far. Keep enough padding for normal products and use intentional edge-to-edge framing only where the product shape needs it."],
      ["Add useful titles, captions, and descriptions", "Attachment titles and captions should be product-specific. Use categories, tags, SKU, colour, material, size, compatibility, or brand when they genuinely help shoppers understand the product."],
      ["Keep metadata connected to product data", "The best image SEO comes from the WooCommerce product itself: title, category, tags, attributes, SKU, and brand. Metadata based only on old filenames rarely helps search or accessibility."],
      ["Create a review workflow before publishing", "Before replacing a featured or gallery image, compare the before and after result, review generated SEO metadata, and approve only when the image is correct. This avoids accidental overwrites and keeps the catalogue trustworthy."],
      ["How Optivra Image Studio helps", "Optivra Image Studio scans WooCommerce product images, queues selected images, generates improved product visuals, suggests product-aware metadata, and lets store owners review before approving replacements."]
    ],
    checklist: ["Use product-specific filenames", "Write natural alt text", "Keep backgrounds consistent", "Compress final images", "Review before publishing"]
  },
  {
    slug: "woocommerce-product-image-seo-checklist",
    title: "WooCommerce Product Image SEO Checklist",
    tag: "Checklist",
    date: "Guide",
    readTime: "7 min read",
    excerpt: "A practical checklist for WooCommerce product image filenames, alt text, compression, backgrounds, accessibility, and review.",
    meta: "Use this WooCommerce product image SEO checklist before publishing product images in your store.",
    sections: [
      ["Before uploading product images", "Start with a clear product photo, a sensible crop, and enough resolution for zoom or large product views. Avoid uploading duplicates, screenshots, or exports with random names."],
      ["Filename checklist", "Use lowercase words separated by hyphens. Include the product name and useful category context. Remove dates, camera names, editing app names, and random numeric strings unless they are part of the product model."],
      ["Alt text checklist", "Describe the product for someone who cannot see the image. Mention colour, product type, angle, or key visible detail when useful. Do not repeat the same phrase on every gallery image."],
      ["Image size and compression checklist", "Use WebP where suitable, keep dimensions consistent, and compress images enough for fast loading without making product detail blurry."],
      ["Background consistency checklist", "Use the same background style across related products. Check cutout edges, shadows, and lighting so the image does not look artificial."],
      ["Product gallery checklist", "Featured images should identify the product quickly. Gallery images can show angles, scale, packaging, compatibility, or detail shots."],
      ["Accessibility checklist", "Alt text should support accessibility first. Do not hide important product information in the image only; include key details in visible product copy as well."],
      ["Review before publishing", "Compare before and after images, check metadata, confirm the correct product image slot, and approve a small batch before bulk changes."]
    ],
    checklist: ["Filename is descriptive", "Alt text is useful", "Image is compressed", "Background is consistent", "Metadata reviewed"]
  },
  {
    slug: "how-to-write-alt-text-for-woocommerce-product-images",
    title: "How to Write Alt Text for WooCommerce Product Images",
    tag: "Alt text",
    date: "Guide",
    readTime: "6 min read",
    excerpt: "Write WooCommerce product image alt text that supports accessibility, product context, and search relevance without keyword stuffing.",
    meta: "Write useful WooCommerce product image alt text that supports accessibility, product context, and search relevance.",
    sections: [
      ["What alt text is", "Alt text is a short text alternative for an image. It helps screen readers, can appear when images fail to load, and gives search engines context about the visual content."],
      ["Why alt text matters for ecommerce", "Product images carry important information: colour, type, orientation, material, compatibility, and detail. Good alt text helps shoppers understand what is pictured."],
      ["What product alt text should describe", "Describe the product and the most important visible context. A bad example is: image of product. A better example is: Black Hi Capa holster for gel blaster pistols, shown from the front with tactical belt clip detail."],
      ["Use product names naturally", "Including the product name is useful when it reads naturally. Avoid repeating long product titles exactly across every gallery image."],
      ["Use categories and attributes without stuffing", "Category and attribute context can help. Use terms like gel blaster accessory, leather wallet, stainless watch, or spare part when they describe what is visible."],
      ["Featured images versus gallery images", "The featured image alt text should identify the product clearly. Gallery image alt text can describe the angle, close-up detail, packaging, or compatibility shown."],
      ["Common mistakes", "Avoid raw filenames, dates, vague phrases, repeated keyword lists, and promotional claims that are not visible in the image."],
      ["How Optivra Image Studio helps", "Optivra Image Studio can generate product-aware alt text from WooCommerce product data, then let admins edit it before approval."]
    ],
    checklist: ["Describe the product", "Include visible detail", "Use product/category context", "Avoid keyword stuffing"]
  },
  {
    slug: "how-to-replace-product-image-backgrounds-in-woocommerce",
    title: "How to Replace Product Image Backgrounds in WooCommerce",
    tag: "Background replacement",
    date: "Guide",
    readTime: "7 min read",
    excerpt: "Compare background replacement options and learn how to review WooCommerce image changes safely before publishing.",
    meta: "Compare background replacement options for WooCommerce product images and learn how to review changes safely.",
    sections: [
      ["Why product backgrounds matter", "Backgrounds influence trust and comparison. A messy or inconsistent background can make a catalogue feel unfinished even when the product itself is strong."],
      ["When to use white backgrounds", "White backgrounds are ideal for clean product pages, marketplaces, and stores that want maximum consistency across many categories."],
      ["When to use grey or branded backgrounds", "Soft grey or subtle branded backgrounds can add depth and identity. They work best when they stay quiet and keep the product as the focus."],
      ["Manual editing versus automated replacement", "Manual editing gives precise control but takes time. Automated background replacement can scale faster, but it still needs review for cutout edges, shadows, and product accuracy."],
      ["Common mistakes", "Watch for clipped products, over-dark shadows, halos around transparent edges, backgrounds that overpower the product, and framing that makes items look smaller than the original."],
      ["Why approval workflows matter", "Never silently overwrite product images. Preserve the original, review the generated version, edit metadata, then approve the replacement."],
      ["How Optivra Image Studio handles it", "Optivra Image Studio uses a queue and Review & Approve workflow so WooCommerce admins can process images at scale without losing control."]
    ],
    checklist: ["Choose a background style", "Check cutout edges", "Review shadows", "Preserve originals", "Approve before replacement"]
  },
  {
    slug: "ai-product-photography-for-woocommerce-stores",
    title: "AI Product Photography for WooCommerce Stores",
    tag: "AI product photography",
    date: "Guide",
    readTime: "8 min read",
    excerpt: "Learn how AI product photography tools can improve WooCommerce backgrounds, framing, lighting, metadata, and catalogue consistency.",
    meta: "Learn how AI product photography tools can help WooCommerce stores improve product images, backgrounds, metadata, and catalogue consistency.",
    sections: [
      ["What AI product photography means", "AI product photography for WooCommerce usually means improving existing product images: background replacement, cutouts, framing, lighting corrections, and metadata suggestions."],
      ["Where AI helps ecommerce images", "AI is useful for repetitive catalogue work. It can standardise image backgrounds, crop products consistently, create cleaner product visuals, and suggest SEO metadata based on product context."],
      ["Where human review is still important", "Store owners should still review product accuracy. AI should not change the product, invent details, remove important parts, or publish automatically without approval."],
      ["Background replacement and smart framing", "A strong workflow keeps the product recognisable and uses framing that matches the original unless a specific override is selected."],
      ["Lighting enhancement", "Subtle brightness, contrast, highlight recovery, and shadow lift can improve product clarity. Heavy effects can make products look artificial."],
      ["SEO metadata generation", "AI can draft filenames, alt text, titles, captions, and descriptions, but the best results use WooCommerce product names, categories, tags, SKU, and attributes."],
      ["Best workflow for WooCommerce stores", "Start with a small category, scan products, queue a few images, process, review, edit metadata, approve, then expand to larger batches."],
      ["How Optivra Image Studio fits", "Optivra Image Studio gives WooCommerce teams a practical scan, queue, process, review, and publish workflow for AI-powered product image optimisation."]
    ],
    checklist: ["Start small", "Review every output", "Keep products accurate", "Use subtle enhancements", "Track credits"]
  },
  {
    slug: "how-to-control-woocommerce-payment-gateways-by-country",
    title: "How to Control WooCommerce Payment Gateways by Country",
    tag: "Payment gateway rules",
    date: "Guide",
    readTime: "6 min read",
    excerpt: "Learn how billing and shipping country rules can show or hide WooCommerce payment methods for different regions.",
    meta: "Learn how to control WooCommerce payment gateways by billing country and shipping country with safe checkout rules.",
    sections: [
      ["Why country-based gateway rules matter", "International stores often need different checkout options by region. Cash on Delivery, local bank transfer, or regional gateways may only make sense for specific countries."],
      ["Billing country versus shipping country", "Billing country describes the customer's billing address. Shipping country describes where the order is going. Payment Gateway Rules for WooCommerce supports both conditions so you can choose the checkout context that matches your policy."],
      ["A safe setup workflow", "Create one rule at a time, keep the default all-hidden fallback enabled, and test checkout with different country combinations before relying on the rule."],
      ["How the plugin helps", "The plugin lets you target installed WooCommerce gateways, choose show or hide actions, and order rules by priority without custom code."]
    ],
    checklist: ["Choose billing or shipping country", "Target gateways", "Set show or hide action", "Test checkout"]
  },
  {
    slug: "how-to-hide-cash-on-delivery-for-international-woocommerce-orders",
    title: "How to Hide Cash on Delivery for International WooCommerce Orders",
    tag: "Cash on Delivery",
    date: "Guide",
    readTime: "5 min read",
    excerpt: "A practical guide to hiding Cash on Delivery when WooCommerce orders ship outside your local region.",
    meta: "Hide Cash on Delivery for international WooCommerce orders using payment gateway rules based on shipping country.",
    sections: [
      ["Why hide Cash on Delivery internationally", "COD can create risk and operational friction for international orders. Many stores only want it for local delivery zones or selected countries."],
      ["Use shipping country rules", "Create a shipping country rule, select the Cash on Delivery gateway, and hide the gateway for destinations where COD is not supported."],
      ["Test before publishing", "Use a private browser session, enter domestic and international shipping addresses, and confirm the debug panel shows the expected country and matched rule."],
      ["Keep a fallback", "Keep another payment method visible so customers can still complete checkout."]
    ],
    checklist: ["Select COD", "Use shipping country", "Hide where unsupported", "Confirm alternatives remain"]
  },
  {
    slug: "how-to-show-different-woocommerce-payment-methods-by-cart-value",
    title: "How to Show Different WooCommerce Payment Methods by Cart Value",
    tag: "Cart total rules",
    date: "Guide",
    readTime: "5 min read",
    excerpt: "Use cart total rules to control checkout payment methods for low-value and high-value WooCommerce orders.",
    meta: "Use WooCommerce cart total rules to show or hide payment gateways based on checkout order value.",
    sections: [
      ["Why cart value affects payment options", "High-value orders may need safer payment methods. Low-value orders may not suit manual bank transfer or invoice-style workflows."],
      ["Supported cart conditions", "Payment Gateway Rules for WooCommerce supports cart total conditions including greater than, less than, and between."],
      ["Example setup", "Hide bank transfer below a minimum order value, or hide a high-risk gateway above a specific order value."],
      ["Test totals carefully", "Add products until the cart crosses the rule threshold and confirm the visible gateways update as expected."]
    ],
    checklist: ["Choose cart total", "Set threshold", "Select gateway", "Test below and above"]
  },
  {
    slug: "why-woocommerce-checkout-payment-rules-matter",
    title: "Why WooCommerce Checkout Payment Rules Matter",
    tag: "Checkout operations",
    date: "Guide",
    readTime: "6 min read",
    excerpt: "Understand how checkout payment method rules can reduce friction, risk, and manual support for WooCommerce stores.",
    meta: "Learn why WooCommerce checkout payment rules matter for international stores, high-value orders, and operational control.",
    sections: [
      ["Checkout rules reduce confusion", "Customers should only see payment methods that are relevant and available for their order context."],
      ["Rules reduce operational risk", "Stores can avoid showing COD, manual bank transfer, or regional gateways where they are not practical."],
      ["Rules should be tested", "Payment visibility directly affects checkout conversion, so every rule should be tested before launch."],
      ["How the plugin fits", "Payment Gateway Rules for WooCommerce provides a focused admin tool for gateway visibility without external services or payment processing."]
    ],
    checklist: ["Keep choices relevant", "Avoid unsupported gateways", "Preserve checkout fallback", "Test before launch"]
  },
  {
    slug: "how-to-test-woocommerce-payment-gateway-rules-safely",
    title: "How to Test WooCommerce Payment Gateway Rules Safely",
    tag: "Testing",
    date: "Guide",
    readTime: "5 min read",
    excerpt: "A safe testing checklist for WooCommerce stores using payment gateway visibility rules.",
    meta: "Test WooCommerce payment gateway rules safely with checkout scenarios, cache checks, and rule priority review.",
    sections: [
      ["Use realistic checkout scenarios", "Test guest and logged-in checkout with the countries, currencies, cart totals, and gateways your real customers use."],
      ["Avoid checkout caching", "Cart and checkout pages should not be cached. Clear caches after changing gateway rules."],
      ["Check rule priority", "Rules run by priority, so a later rule may change the result of an earlier one."],
      ["Use the debug panel", "The plugin's debug/test panel shows detected billing country, shipping country, currency, cart total, matched rules, and final visible gateways."]
    ],
    checklist: ["Test incognito", "Try multiple countries", "Change cart totals", "Check debug panel"]
  }
];
let currentUser = null;
let currentUserLoaded = false;

function token() {
  return localStorage.getItem(tokenKey) || "";
}

function setToken(value) {
  localStorage.setItem(tokenKey, value);
}

function routeTo(path) {
  closeMobileMenu();
  let normalized = path === "" ? "/" : path;
  if (normalized === "/catalogue-image-studio") {
    normalized = "/optivra-image-studio";
    history.replaceState({}, "", normalized);
  }
  if (normalized === "/docs/optivra-image-studio") {
    normalized = "/docs/ai-image-studio";
    history.replaceState({}, "", normalized);
  }
  if (normalized.startsWith("/resources/")) {
    normalized = normalized.replace("/resources/", "/blog/");
    history.replaceState({}, "", normalized);
  }
  if (normalized === "/resources") {
    normalized = "/blog";
    history.replaceState({}, "", normalized);
  }
  if (normalized === "/account") {
    normalized = "/dashboard";
    history.replaceState({}, "", normalized);
  }
  if (normalized === "/account/sites") {
    normalized = "/dashboard";
    history.replaceState({}, "", normalized);
  }
  if (normalized === "/account/credits") {
    normalized = "/account/billing";
    history.replaceState({}, "", "/account/billing#buy-credits");
  }
  const page = pages.find((node) => node.dataset.page === normalized) || pages[0];
  pages.forEach((node) => node.classList.toggle("active", node === page));
  navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === normalized));
  document.title = pageTitle(normalized);
  updateMetadata(normalized);
  if (normalized === "/dashboard") {
    loadDashboard();
  }
  if (normalized === "/account/billing" || normalized === "/billing/success" || normalized === "/billing/credits/success") {
    loadBilling();
  }
  if (normalized === "/downloads") {
    loadDownloads();
  }
  if (normalized === "/blog" || normalized.startsWith("/blog/")) {
    renderBlog(normalized);
  }
  if (normalized === "/admin/plugin-analytics") {
    loadAdminAnalytics();
  }
  return normalized;
}

function closeMobileMenu() {
  document.body.classList.remove("mobile-menu-open");
  if (primaryNav) primaryNav.classList.remove("open");
  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
  }
}

function toggleMobileMenu() {
  const isOpen = !document.body.classList.contains("mobile-menu-open");
  document.body.classList.toggle("mobile-menu-open", isOpen);
  if (primaryNav) primaryNav.classList.toggle("open", isOpen);
  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  }
}

function pageTitle(path) {
  if (path.startsWith("/blog/")) {
    const article = blogArticles.find((item) => `/blog/${item.slug}` === path);
    if (article) return `${article.title} | Optivra`;
  }
  const names = {
    "/": `${PRODUCT_NAME} | Optivra`,
    "/plugins": "Plugins | Optivra",
    "/woocommerce-plugins": "WooCommerce Plugins by Optivra | Checkout Rules and Image Optimisation",
    "/optivra-image-studio": "Optivra Image Studio for WooCommerce | AI Product Image Optimisation",
    "/payment-gateway-rules-for-woocommerce": "Payment Gateway Rules for WooCommerce | Control Checkout Payment Methods",
    "/catalogue-image-studio": "Optivra Image Studio for WooCommerce | AI Product Image Optimisation",
    "/pricing": "Pricing | Optivra",
    "/downloads": "Download WooCommerce Plugins | Optivra",
    "/blog": "WooCommerce Image SEO Blog | Optivra",
    "/blog/how-to-optimise-woocommerce-product-images-for-seo": "How to Optimise WooCommerce Product Images for SEO | Optivra",
    "/blog/woocommerce-product-image-seo-checklist": "WooCommerce Product Image SEO Checklist | Optivra",
    "/blog/how-to-write-alt-text-for-woocommerce-product-images": "How to Write Alt Text for WooCommerce Product Images | Optivra",
    "/blog/how-to-replace-product-image-backgrounds-in-woocommerce": "How to Replace Product Image Backgrounds in WooCommerce | Optivra",
    "/blog/ai-product-photography-for-woocommerce-stores": "AI Product Photography for WooCommerce Stores | Optivra",
    "/blog/how-to-control-woocommerce-payment-gateways-by-country": "How to Control WooCommerce Payment Gateways by Country | Optivra",
    "/blog/how-to-hide-cash-on-delivery-for-international-woocommerce-orders": "How to Hide Cash on Delivery for International WooCommerce Orders | Optivra",
    "/blog/how-to-show-different-woocommerce-payment-methods-by-cart-value": "How to Show Different WooCommerce Payment Methods by Cart Value | Optivra",
    "/blog/why-woocommerce-checkout-payment-rules-matter": "Why WooCommerce Checkout Payment Rules Matter | Optivra",
    "/blog/how-to-test-woocommerce-payment-gateway-rules-safely": "How to Test WooCommerce Payment Gateway Rules Safely | Optivra",
    "/login": "Login | Optivra",
    "/dashboard": "Dashboard | Optivra",
    "/admin/plugin-analytics": `${PRODUCT_NAME} Analytics | Optivra`,
    "/account/billing": `Billing & Credits | ${PRODUCT_NAME}`,
    "/billing/success": "Billing Success | Optivra",
    "/billing/cancel": "Billing Cancelled | Optivra",
    "/billing/credits/success": "Credit Purchase Success | Optivra",
    "/billing/credits/cancel": "Credit Purchase Cancelled | Optivra",
    "/docs": "Docs | Optivra",
    "/docs/ai-image-studio": `${PRODUCT_NAME} Guide | Optivra`,
    "/docs/payment-gateway-rules-for-woocommerce": "Payment Gateway Rules for WooCommerce Guide | Optivra",
    "/support": "Support | Optivra",
    "/terms": "Terms | Optivra",
    "/privacy": "Privacy | Optivra",
    "/refund-policy": "Refund Policy | Optivra"
  };
  return names[path] || names["/"];
}

function pageDescription(path) {
  if (path.startsWith("/blog/")) {
    const article = blogArticles.find((item) => `/blog/${item.slug}` === path);
    if (article) return article.meta;
  }
  const descriptions = {
    "/": "AI-powered ecommerce tools for WooCommerce stores, starting with Optivra Image Studio for product image optimisation.",
    "/woocommerce-plugins": "Download WooCommerce plugins from Optivra, including Payment Gateway Rules for WooCommerce and Optivra Image Studio for product image optimisation and SEO metadata.",
    "/optivra-image-studio": "Scan, enhance, review and publish WooCommerce product images with AI background replacement, smart framing and SEO-ready filenames, alt text, titles, captions and descriptions.",
    "/payment-gateway-rules-for-woocommerce": "Create WooCommerce payment gateway rules to show or hide checkout payment methods based on country, shipping location, cart conditions, and store rules.",
    "/pricing": "Compare Optivra Image Studio plans, monthly credits, and credit packs for WooCommerce product image optimisation.",
    "/downloads": "Download Optivra WooCommerce plugins, including Optivra Image Studio and Payment Gateway Rules for WooCommerce.",
    "/docs/ai-image-studio": "Learn how to use Optivra Image Studio to scan, process, review, approve, and optimise WooCommerce product images.",
    "/docs/payment-gateway-rules-for-woocommerce": "Learn how to install Payment Gateway Rules for WooCommerce, create checkout gateway rules, test payment method visibility, and troubleshoot common issues.",
    "/blog": "WooCommerce image SEO guides covering alt text, product image metadata, background replacement, and AI product photography.",
    "/blog/how-to-optimise-woocommerce-product-images-for-seo": "Learn how to optimise WooCommerce product images with better filenames, alt text, backgrounds, review workflows, and metadata.",
    "/blog/woocommerce-product-image-seo-checklist": "Use this WooCommerce product image SEO checklist before publishing product images in your store.",
    "/blog/how-to-write-alt-text-for-woocommerce-product-images": "Write useful WooCommerce product image alt text that supports accessibility, product context, and search relevance.",
    "/blog/how-to-replace-product-image-backgrounds-in-woocommerce": "Learn how to replace product image backgrounds in WooCommerce while preserving originals and reviewing results.",
    "/blog/ai-product-photography-for-woocommerce-stores": "See how AI product photography can standardise WooCommerce product visuals with review controls.",
    "/support": "Contact Optivra support for Optivra Image Studio setup, billing, plugin, and product image processing help."
  };
  return descriptions[path] || descriptions["/"];
}

function pageRobots(path) {
  return (
    path.startsWith("/account") ||
    path.startsWith("/admin") ||
    path === "/dashboard" ||
    path === "/billing/success" ||
    path === "/billing/cancel" ||
    path === "/billing/credits/success" ||
    path === "/billing/credits/cancel"
  ) ? "noindex,nofollow" : "index,follow";
}

function updateMetadata(path) {
  const description = document.querySelector('meta[name="description"]');
  const canonical = document.querySelector('link[rel="canonical"]');
  const robots = document.querySelector('meta[name="robots"]');
  const title = pageTitle(path);
  const desc = pageDescription(path);
  const canonicalUrl = `https://www.optivra.app${path === "/" ? "/" : path}`;
  if (description) description.setAttribute("content", pageDescription(path));
  if (canonical) canonical.setAttribute("href", canonicalUrl);
  if (robots) robots.setAttribute("content", pageRobots(path));
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", desc);
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonicalUrl);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", desc);
}

function renderBlog(path) {
  if (path === "/blog") {
    const page = document.querySelector('[data-page="/blog"] .resources-page');
    if (!page) return;
    page.innerHTML = `
      <p class="eyebrow">Resources</p>
      <h1>WooCommerce Product Image Optimisation Blog</h1>
      <p class="lead">Practical guides for improving WooCommerce product photography, image SEO, backgrounds, metadata, and catalogue workflows.</p>
      <div class="resource-grid blog-card-grid">
        ${blogArticles.map((article) => `
          <article class="resource-card blog-card">
            <p class="eyebrow">${escapeHtml(article.tag)}</p>
            <h2>${escapeHtml(article.title)}</h2>
            <p>${escapeHtml(article.excerpt)}</p>
            <div class="blog-meta"><span>${escapeHtml(article.date)}</span><span>${escapeHtml(article.readTime)}</span></div>
            <a class="button ghost" href="/blog/${escapeHtml(article.slug)}" data-link>Read guide</a>
          </article>
        `).join("")}
      </div>
    `;
    return;
  }

  const slug = path.replace("/blog/", "");
  const article = blogArticles.find((item) => item.slug === slug);
  const page = document.querySelector(`[data-page="${path}"] .article-content`);
  if (!article || !page) return;
  const related = blogArticles.filter((item) => item.slug !== article.slug).slice(0, 3);
  page.innerHTML = `
    <p class="eyebrow">${escapeHtml(article.tag)}</p>
    <h1>${escapeHtml(article.title)}</h1>
    <p class="lead">${escapeHtml(article.excerpt)}</p>
    <div class="article-meta"><span>${escapeHtml(article.date)}</span><span>${escapeHtml(article.readTime)}</span></div>
    <nav class="article-toc" aria-label="Article contents">
      <strong>In this guide</strong>
      ${article.sections.map(([heading]) => `<a href="#${slugify(heading)}">${escapeHtml(heading)}</a>`).join("")}
    </nav>
    ${article.sections.map(([heading, body]) => `
      <section id="${slugify(heading)}">
        <h2>${escapeHtml(heading)}</h2>
        <p>${escapeHtml(body)}</p>
      </section>
    `).join("")}
    <section class="checklist-box">
      <h2>Quick checklist</h2>
      <ul>${article.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    <section class="doc-callout tip">
      <strong>Try Optivra Image Studio for WooCommerce</strong>
      <p>Scan product images, queue improvements, review before and after results, edit SEO metadata, and approve replacements from a practical WooCommerce workflow.</p>
      <div class="docs-actions">
        <a class="button primary" href="/downloads" data-link data-analytics="download_plugin_clicked">Download Plugin</a>
        <a class="button ghost" href="/docs/ai-image-studio" data-link data-analytics="docs_opened">Read setup guide</a>
        <a class="button ghost" href="/pricing" data-link data-analytics="pricing_plan_clicked">View pricing</a>
      </div>
    </section>
    <section>
      <h2>Related guides</h2>
      <div class="resource-grid related-grid">
        ${related.map((item) => `<article class="resource-card"><p class="eyebrow">${escapeHtml(item.tag)}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt)}</p><a href="/blog/${escapeHtml(item.slug)}" data-link>Read guide</a></article>`).join("")}
      </div>
    </section>
  `;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (!link) return;
  const href = link.getAttribute("href");
  if (!href || href.startsWith("http")) return;
  event.preventDefault();
  history.pushState({}, "", href);
  const normalized = routeTo(location.pathname);
  trackPageView(normalized);
  if (!link.dataset.analytics) {
    if (normalized === "/pricing") trackConversion("pricing_cta_click", { page_path: normalized, funnel_stage: "intent" });
    if (normalized === "/support") trackConversion("support_docs_click", { page_path: normalized, cta_location: "navigation" });
    if (normalized === "/docs" || normalized.startsWith("/docs/")) trackConversion("docs_support_click", { page_path: normalized, cta_location: "navigation" });
    if (normalized === "/blog" || normalized.startsWith("/blog/")) trackConversion("blog_cta_click", { page_path: normalized, cta_location: "navigation" });
  }
});

menuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMobileMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

document.addEventListener("click", (event) => {
  if (!document.body.classList.contains("mobile-menu-open")) return;
  if (event.target.closest(".site-header")) return;
  closeMobileMenu();
});

const approvedAnalyticsEvents = new Set([
  "page_view", "nav_click", "footer_click", "hero_cta_click", "scroll_depth_25", "scroll_depth_50", "scroll_depth_75", "scroll_depth_90",
  "time_on_page_30s", "time_on_page_60s", "time_on_page_120s", "outbound_click", "file_download", "error_viewed",
  "home_page_view", "home_hero_cta_click", "home_product_card_click", "home_pricing_cta_click", "home_download_cta_click", "home_docs_cta_click",
  "image_studio_page_view", "image_studio_hero_cta_click", "image_studio_feature_view", "image_studio_feature_click", "image_studio_before_after_view",
  "image_studio_demo_view", "image_studio_pricing_click", "image_studio_download_click", "image_studio_docs_click", "image_studio_faq_expand",
  "image_studio_preserve_mode_interest", "image_studio_background_generation_interest", "image_studio_seo_feature_interest", "image_studio_bulk_processing_interest",
  "downloads_page_view", "plugin_download_click", "plugin_download_started", "plugin_download_completed", "plugin_download_failed",
  "download_email_capture_start", "download_email_capture_submit", "download_email_capture_error", "download_version_selected", "download_changelog_view",
  "pricing_page_view", "pricing_plan_view", "pricing_plan_expand", "pricing_plan_compare", "pricing_cta_click", "pricing_faq_expand",
  "pricing_monthly_selected", "pricing_yearly_selected", "checkout_started", "checkout_redirected", "checkout_success_landing", "checkout_cancelled", "checkout_error",
  "docs_page_view", "docs_section_view", "docs_search", "docs_install_step_view", "docs_copy_code_click", "docs_support_click",
  "docs_previous_next_click", "docs_plugin_setup_interest", "docs_api_token_interest",
  "blog_index_view", "blog_post_view", "blog_scroll_75", "blog_cta_click", "blog_related_post_click", "blog_category_click", "blog_author_click",
  "blog_exit_to_product", "blog_exit_to_download", "blog_exit_to_pricing",
  "support_page_view", "contact_form_start", "contact_form_submit", "contact_form_success", "contact_form_error", "support_email_click", "support_docs_click",
  "shopify_embedded_app_loaded"
]);

const sensitiveAnalyticsKeyPattern = /(email|e_mail|phone|mobile|address|street|postcode|zip_code|postal|full_name|first_name|last_name|display_name|contact_name|license|licence|token|secret|password|api_key|apikey|openai|stripe|customer_id|session_id|checkout_session|payment_intent|key|raw|stack|trace|uploaded_image|image_url|source_image_url)/i;
const emailAnalyticsPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phoneAnalyticsPattern = /(?:\+?\d[\s().-]*){8,}/;
const analyticsStorageKeys = {
  attribution: "optivra_attribution_v1",
  visitor: "optivra_visitor_type_v1",
  session: "optivra_session_engagement_id"
};
const analyticsState = {
  lastPagePath: null,
  scrollDepths: new Set(),
  timeouts: [],
  checkoutSuccesses: new Set()
};

function analyticsDebug(message, data = {}) {
  if (window.optivraAnalytics?.debug && window.optivraAnalytics?.environment !== "production") {
    console.info(`[Optivra analytics] ${message}`, sanitizeAnalyticsParams(data));
  }
}

function isPublicAnalyticsPath(path = location.pathname) {
  return !(
    path.startsWith("/admin") ||
    path.startsWith("/api") ||
    path.startsWith("/account") ||
    path.startsWith("/dashboard") ||
    (path.startsWith("/billing/") && !["/billing/success", "/billing/cancel", "/billing/credits/success", "/billing/credits/cancel"].includes(path))
  );
}

function analyticsReady(path = location.pathname) {
  return Boolean(window.optivraAnalytics?.enabled && isPublicAnalyticsPath(path));
}

function sanitizeAnalyticsKey(key) {
  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function containsLikelyPii(value) {
  if (typeof value !== "string") return false;
  return emailAnalyticsPattern.test(value) || phoneAnalyticsPattern.test(value) || /^https?:\/\/[^?\s]+[?][^\s]+/i.test(value);
}

function sanitizeAnalyticsParams(properties = {}) {
  const safe = {};
  Object.entries(properties).forEach(([rawKey, value]) => {
    const key = sanitizeAnalyticsKey(rawKey);
    if (!key || sensitiveAnalyticsKeyPattern.test(key) || value === undefined) {
      if (window.optivraAnalytics?.debug) analyticsDebug("stripped unsafe analytics param", { key });
      return;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) safe[key] = value;
      return;
    }
    if (typeof value === "boolean" || value === null) {
      safe[key] = value;
      return;
    }
    const text = String(value).trim();
    if (!text || containsLikelyPii(text)) {
      if (window.optivraAnalytics?.debug) analyticsDebug("stripped likely PII analytics value", { key });
      return;
    }
    safe[key] = text
      .replace(/https?:\/\/[^\s?#]+([?#][^\s]*)?/gi, (url) => {
        try {
          const parsed = new URL(url);
          return `${parsed.origin}${parsed.pathname}`;
        } catch {
          return "";
        }
      })
      .replace(/[^\w\-./:# ]/g, "")
      .slice(0, 120);
  });
  return safe;
}

function pluginFromTarget(target) {
  const href = target?.getAttribute?.("href") || "";
  const path = location.pathname;
  if (href.includes("payment-gateway-rules") || path.includes("payment-gateway-rules")) return "payment_gateway_rules";
  if (href.includes("optivra-image-studio") || path.includes("optivra-image-studio")) return "optivra_image_studio";
  return "woocommerce_plugins";
}

function routeGroup(path = location.pathname) {
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
  if (normalized.startsWith("/login")) return "auth";
  return "other";
}

function cleanCurrentUrl(path = location.pathname) {
  return `${location.origin}${path.split("?")[0]}`;
}

function referrerDomain() {
  if (!document.referrer) return "";
  try {
    const referrer = new URL(document.referrer);
    return /(^|\.)optivra\.app$/i.test(referrer.hostname) ? "" : referrer.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function getStorageJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

function setStorageJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable in private browsing */
  }
}

function campaignTouch() {
  const url = new URL(location.href);
  const hasUtm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].some((key) => url.searchParams.has(key));
  if (hasUtm) {
    return {
      source: url.searchParams.get("utm_source") || "campaign",
      medium: url.searchParams.get("utm_medium") || "unknown",
      campaign: url.searchParams.get("utm_campaign") || "",
      content: url.searchParams.get("utm_content") || "",
      term: url.searchParams.get("utm_term") || ""
    };
  }
  const referrer = referrerDomain();
  if (referrer) {
    return { source: referrer, medium: "referral", campaign: "", content: "", term: "" };
  }
  return { source: "direct", medium: "none", campaign: "", content: "", term: "" };
}

function attributionState(path = location.pathname) {
  const current = campaignTouch();
  const existing = getStorageJson(analyticsStorageKeys.attribution, {});
  const next = {
    firstTouch: existing.firstTouch || current,
    lastTouch: existing.lastTouch || current,
    landingPage: existing.landingPage || path,
    entryRouteGroup: existing.entryRouteGroup || routeGroup(path)
  };
  if (current.source !== "direct" || current.medium !== "none" || current.campaign) {
    next.lastTouch = current;
  }
  setStorageJson(analyticsStorageKeys.attribution, next);
  return next;
}

function visitorType() {
  try {
    const existing = localStorage.getItem(analyticsStorageKeys.visitor);
    if (existing) return "returning";
    localStorage.setItem(analyticsStorageKeys.visitor, "seen");
  } catch {
    return "unknown";
  }
  return "new";
}

function sessionEngagementId() {
  try {
    let id = sessionStorage.getItem(analyticsStorageKeys.session);
    if (!id) {
      id = `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(analyticsStorageKeys.session, id);
    }
    return id;
  } catch {
    return "session_unavailable";
  }
}

function deviceType() {
  const width = window.innerWidth || 0;
  if (width < 768) return "mobile";
  if (width < 1100) return "tablet";
  return "desktop";
}

function contentSlug(path = location.pathname) {
  if (path.startsWith("/blog/")) return path.replace("/blog/", "");
  if (path.startsWith("/docs/")) return path.replace("/docs/", "");
  return "";
}

function pageBaseParams(path = location.pathname) {
  const attribution = attributionState(path);
  return {
    page_path: path,
    clean_url: cleanCurrentUrl(path),
    page_title: document.title,
    route_group: routeGroup(path),
    referrer_domain: referrerDomain(),
    device_type: deviceType(),
    viewport_size: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
    session_engagement_id: sessionEngagementId(),
    first_touch_source: attribution.firstTouch?.source,
    first_touch_medium: attribution.firstTouch?.medium,
    first_touch_campaign: attribution.firstTouch?.campaign,
    first_touch_content: attribution.firstTouch?.content,
    first_touch_term: attribution.firstTouch?.term,
    last_touch_source: attribution.lastTouch?.source,
    last_touch_medium: attribution.lastTouch?.medium,
    last_touch_campaign: attribution.lastTouch?.campaign,
    last_touch_content: attribution.lastTouch?.content,
    last_touch_term: attribution.lastTouch?.term,
    landing_page: attribution.landingPage,
    entry_route_group: attribution.entryRouteGroup,
    visitor_type: visitorType(),
    environment: window.optivraAnalytics?.environment || "development",
    content_slug: contentSlug(path)
  };
}

function sendFirstPartyEvent(eventName, params) {
  const endpoint = window.optivraAnalytics?.serverEndpoint;
  if (!endpoint || !navigator.sendBeacon) {
    fetch(endpoint || "/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name: eventName, params }),
      keepalive: true
    }).catch(() => analyticsDebug("first-party event skipped", { event_name: eventName }));
    return;
  }
  navigator.sendBeacon(endpoint, new Blob([JSON.stringify({ event_name: eventName, params })], { type: "application/json" }));
}

function trackEvent(eventName, properties = {}) {
  const normalizedEvent = sanitizeAnalyticsKey(eventName);
  if (!approvedAnalyticsEvents.has(normalizedEvent)) {
    analyticsDebug("skipped unapproved event", { event_name: normalizedEvent });
    return;
  }
  if (!analyticsReady(properties.page_path || location.pathname)) return;
  const safe = sanitizeAnalyticsParams({ ...pageBaseParams(properties.page_path || location.pathname), ...properties });
  if (window.gtag && (window.optivraAnalytics?.measurementId || window.optivraAnalytics?.googleTagId)) {
    window.gtag("event", normalizedEvent, safe);
  }
  sendFirstPartyEvent(normalizedEvent, safe);
  analyticsDebug("tracked event", { event_name: normalizedEvent, ...safe });
}

function pageSpecificViewEvent(path) {
  if (path === "/") return "home_page_view";
  if (path === "/optivra-image-studio" || path === "/catalogue-image-studio") return "image_studio_page_view";
  if (path === "/downloads") return "downloads_page_view";
  if (path === "/pricing") return "pricing_page_view";
  if (path === "/support") return "support_page_view";
  if (path === "/blog") return "blog_index_view";
  if (path.startsWith("/blog/")) return "blog_post_view";
  if (path === "/docs" || path.startsWith("/docs/")) return "docs_page_view";
  return "";
}

function trackPageView(path = location.pathname) {
  if (!analyticsReady(path) || analyticsState.lastPagePath === path) return;
  analyticsState.lastPagePath = path;
  analyticsState.scrollDepths = new Set();
  analyticsState.timeouts.forEach((id) => clearTimeout(id));
  analyticsState.timeouts = [];
  trackEvent("page_view", { page_path: path });
  const specific = pageSpecificViewEvent(path);
  if (specific) {
    trackEvent(specific, {
      page_path: path,
      content_type: path.startsWith("/blog/") ? "blog_post" : path.startsWith("/docs") ? "docs" : "page",
      content_slug: contentSlug(path),
      product_slug: path.includes("image-studio") ? "optivra_image_studio" : undefined,
      funnel_stage: path === "/" || path.startsWith("/blog") ? "awareness" : "interest"
    });
  }
  trackCheckoutLanding(path);
  setupPageEngagementTimers(path);
}

function trackConversion(eventName, properties = {}) {
  trackEvent(eventName, properties);
}

function setupPageEngagementTimers(path) {
  [30, 60, 120].forEach((seconds) => {
    const id = setTimeout(() => trackEvent(`time_on_page_${seconds}s`, { page_path: path }), seconds * 1000);
    analyticsState.timeouts.push(id);
  });
}

window.addEventListener("scroll", () => {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const percent = Math.round((window.scrollY / maxScroll) * 100);
  [25, 50, 75, 90].forEach((depth) => {
    if (percent >= depth && !analyticsState.scrollDepths.has(depth)) {
      analyticsState.scrollDepths.add(depth);
      trackEvent(`scroll_depth_${depth}`, { reading_depth: depth });
      if (depth === 75 && location.pathname.startsWith("/blog/")) {
        trackEvent("blog_scroll_75", { reading_depth: 75, content_slug: contentSlug(location.pathname), content_type: "blog_post" });
      }
    }
  });
}, { passive: true });

function eventForExplicitAnalytics(value, target) {
  const route = routeGroup(location.pathname);
  const plugin = pluginFromTarget(target);
  if (value === "signup_clicked") return route === "home" ? "home_hero_cta_click" : "hero_cta_click";
  if (value === "download_plugin_clicked") {
    if (route === "home") return "home_download_cta_click";
    if (plugin === "optivra_image_studio") return "image_studio_download_click";
    return "plugin_download_click";
  }
  if (value === "docs_opened") return plugin === "optivra_image_studio" ? "image_studio_docs_click" : "docs_support_click";
  if (value === "pricing_plan_clicked") return route === "home" ? "home_pricing_cta_click" : "pricing_cta_click";
  return sanitizeAnalyticsKey(value);
}

function ctaLocation(target) {
  if (target.closest(".site-header")) return "header";
  if (target.closest(".site-footer")) return "footer";
  if (target.closest(".hero")) return "hero";
  if (target.closest(".price-card")) return "pricing_card";
  if (target.closest(".doc-callout")) return "content_callout";
  if (target.closest(".resource-card")) return "resource_card";
  return routeGroup(location.pathname);
}

function downloadParamsForTarget(target) {
  const plugin = pluginFromTarget(target);
  return {
    plugin_slug: plugin,
    plugin_name: plugin === "payment_gateway_rules" ? "Payment Gateway Rules for WooCommerce" : "Optivra Image Studio",
    plugin_version: plugin === "payment_gateway_rules" ? gatewayRulesRelease.version : pluginRelease.version,
    download_location: ctaLocation(target),
    download_type: "zip",
    gated: false,
    funnel_stage: "conversion"
  };
}

function trackCheckoutLanding(path) {
  if (path === "/billing/success" || path === "/billing/credits/success") {
    const key = `${path}:${sessionEngagementId()}`;
    if (!analyticsState.checkoutSuccesses.has(key)) {
      analyticsState.checkoutSuccesses.add(key);
      trackEvent("checkout_success_landing", { page_path: path, funnel_stage: "conversion" });
    }
  }
  if (path === "/billing/cancel" || path === "/billing/credits/cancel") {
    trackEvent("checkout_cancelled", { page_path: path, funnel_stage: "intent" });
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("a, button, [data-analytics], [data-download-zip], [data-plan], [data-pack]");
  if (!target) return;

  const explicitEvent = target.dataset?.analytics;
  const href = target.getAttribute?.("href") || "";
  const props = {
    cta_location: ctaLocation(target),
    cta_text: target.textContent || "",
    page_path: location.pathname,
    plugin_slug: pluginFromTarget(target),
    product_slug: pluginFromTarget(target) === "optivra_image_studio" ? "optivra_image_studio" : undefined,
    funnel_stage: "interest"
  };

  if (target.closest(".site-header")) trackEvent("nav_click", props);
  if (target.closest(".site-footer")) trackEvent("footer_click", props);
  if (href.startsWith("http") && !href.includes(location.hostname)) trackEvent("outbound_click", props);
  if (href.startsWith("mailto:")) trackEvent("support_email_click", { ...props, funnel_stage: "intent" });

  if (target.matches("[data-download-zip]")) {
    const params = { ...props, ...downloadParamsForTarget(target) };
    trackEvent("plugin_download_click", params);
    trackEvent("plugin_download_started", params);
    trackEvent("file_download", params);
    return;
  }

  if (target.matches("[data-plan]")) {
    trackEvent("pricing_cta_click", { ...props, plan_name: target.dataset.plan, plan_interval: "monthly", currency: "usd", funnel_stage: "intent" });
    return;
  }

  if (target.matches("[data-pack]")) {
    trackEvent("pricing_cta_click", { ...props, plan_name: `credits_${target.dataset.pack}`, plan_interval: "one_time", currency: "usd", funnel_stage: "intent" });
    return;
  }

  if (explicitEvent) {
    trackEvent(eventForExplicitAnalytics(explicitEvent, target), props);
  }

  if (location.pathname.startsWith("/blog/") && href) {
    if (href.includes("/optivra-image-studio")) trackEvent("blog_exit_to_product", props);
    if (href.includes("/downloads")) trackEvent("blog_exit_to_download", props);
    if (href.includes("/pricing")) trackEvent("blog_exit_to_pricing", props);
    if (href.includes("/blog/")) trackEvent("blog_related_post_click", props);
  }
});

function bindTimeCalculator() {
  const calculator = document.querySelector("[data-calculator]");
  if (!calculator) return;

  const products = calculator.querySelector("[data-calc-products]");
  const images = calculator.querySelector("[data-calc-images]");
  const minutes = calculator.querySelector("[data-calc-minutes]");
  const output = calculator.querySelector("[data-calc-output]");

  const update = () => {
    const productCount = Math.max(0, Number(products?.value || 0));
    const imageCount = Math.max(0, Number(images?.value || 0));
    const minuteCount = Math.max(0, Number(minutes?.value || 0));
    const hours = Math.round((productCount * imageCount * minuteCount) / 60);
    if (output) output.textContent = `Estimated manual image workload: ${hours.toLocaleString()} hours`;
  };

  [products, images, minutes].forEach((input) => input?.addEventListener("input", update));
  update();
}

bindTimeCalculator();

window.addEventListener("popstate", () => {
  const normalized = routeTo(location.pathname);
  trackPageView(normalized);
});

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || "Request failed");
  }
  return body;
}

const authForm = document.getElementById("auth-form");
const authMessage = document.getElementById("auth-message");
authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  trackConversion("hero_cta_click", { page_path: location.pathname, cta_location: "login_form", funnel_stage: "intent" });
  await submitAuth("/auth/login");
});
document.getElementById("register-button")?.addEventListener("click", async () => {
  trackConversion("hero_cta_click", { page_path: location.pathname, cta_location: "register_form", funnel_stage: "intent" });
  await submitAuth("/auth/register");
});

async function submitAuth(path) {
  const form = new FormData(authForm);
  authMessage.textContent = "Working...";
  try {
    const body = await api(path, {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });
    setToken(body.token);
    currentUser = body.user || null;
    currentUserLoaded = true;
    updateAdminVisibility();
    if (path === "/auth/register") {
      trackConversion("hero_cta_click", { page_path: location.pathname, cta_location: "register_success", funnel_stage: "conversion" });
    }
    authMessage.textContent = "Signed in.";
    history.pushState({}, "", "/dashboard");
    routeTo("/dashboard");
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

async function loadDashboard() {
  if (!token()) {
    document.getElementById("dash-plan").textContent = "Login required";
    return;
  }
  try {
    const data = await api("/account/dashboard");
    const usage = data.usage;
    document.getElementById("dash-plan").textContent = `${usage.plan} · ${usage.subscription_status}`;
    document.getElementById("dash-credits").textContent = `${usage.credits_remaining} / ${usage.credits_total}`;
    const pct = usage.credits_total > 0 ? Math.max(0, Math.min(100, Math.round((usage.credits_remaining / usage.credits_total) * 100))) : 0;
    document.getElementById("dash-meter").style.width = `${pct}%`;
    renderList("dash-sites", data.connected_sites, (site) => `${escapeHtml(site.domain)}<br><small>${escapeHtml(site.api_token_status)}</small>`);
    renderList("dash-history", data.usage_history, (entry) => `${escapeHtml(entry.reason)}: ${escapeHtml(entry.change_amount)}<br><small>${escapeHtml(new Date(entry.created_at).toLocaleDateString())}</small>`);
  } catch (error) {
    document.getElementById("dash-plan").textContent = error.message;
  }
}

async function loadBilling() {
  if (!token()) {
    setText("billing-plan", "Login required");
    return;
  }

  try {
    const data = await api("/account/dashboard");
    const billing = data.billing || {};
    const usage = data.usage || {};
    const remaining = Number(billing.credits_remaining ?? usage.credits_remaining ?? 0);
    const total = Number(billing.credits_total ?? usage.credits_total ?? 0);
    setText("billing-plan", billing.plan || usage.plan || "-");
    setText("billing-status", billing.cancel_at_period_end ? `${billing.status} · cancels at period end` : (billing.status || usage.subscription_status || "-"));
    setText("billing-credits", `${remaining} / ${total}`);
    setText("billing-used", String(Number(billing.credits_used ?? Math.max(total - remaining, 0))));
    setText("billing-reset", formatDate(billing.credits_reset_at || billing.current_period_end || usage.next_reset_at));
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0;
    const meter = document.getElementById("billing-meter");
    if (meter) meter.style.width = `${pct}%`;
    document.querySelectorAll("#portal-button, #portal-button-secondary").forEach((button) => {
      button.disabled = !billing.stripe_customer_id;
      button.textContent = billing.stripe_customer_id ? "Manage Billing" : "Billing not active yet";
    });
  } catch (error) {
    setText("billing-plan", error.message);
  }
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function renderList(id, items, renderer) {
  const node = document.getElementById(id);
  if (!node) return;
  if (!items?.length) {
    node.innerHTML = `<p>No records yet.</p>`;
    return;
  }
  node.innerHTML = `<div class="dash-list">${items.map((item) => `<div class="dash-item">${renderer(item)}</div>`).join("")}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadCurrentUser() {
  if (!token()) {
    currentUser = null;
    currentUserLoaded = true;
    updateAdminVisibility();
    return null;
  }

  if (currentUserLoaded) {
    return currentUser;
  }

  try {
    const body = await api("/auth/me");
    currentUser = body.user || null;
  } catch {
    currentUser = null;
  }

  currentUserLoaded = true;
  updateAdminVisibility();
  return currentUser;
}

function updateAdminVisibility() {
  const isAdmin = Boolean(currentUser?.is_internal_admin);
  document.querySelectorAll("[data-admin-only]").forEach((node) => {
    node.hidden = !isAdmin;
  });
  document.querySelectorAll("[data-admin-badge]").forEach((node) => {
    node.hidden = !isAdmin;
  });
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function loadDownloads() {
  setText("download-plugin-name", pluginRelease.name);
  setText("download-plugin-version", pluginRelease.version);
  setText("download-plugin-size", pluginRelease.fileSize);
  setText("download-plugin-updated", pluginRelease.updatedAt);
  setText("download-plugin-status", pluginRelease.wordpressOrgStatus);
  setText("download-plugin-sha", pluginRelease.sha256);
  document.querySelectorAll("[data-download-zip]").forEach((node) => {
    const plugin = pluginFromTarget(node);
    node.setAttribute("href", plugin === "payment_gateway_rules" ? gatewayRulesRelease.zipPath : pluginRelease.zipPath);
  });
}

async function loadAdminAnalytics() {
  const denied = document.getElementById("admin-denied");
  const content = document.getElementById("admin-analytics-content");
  if (denied) denied.hidden = true;
  if (content) content.hidden = true;

  const user = await loadCurrentUser();
  if (!user?.is_internal_admin) {
    if (denied) denied.hidden = false;
    return;
  }

  try {
    ensureAdminRangeControl();
    const range = document.getElementById("admin-range")?.value || "7";
    const [overviewBody, storesBody, eventsBody, siteBody] = await Promise.all([
      api(`/api/admin/plugin-analytics/overview?range=${encodeURIComponent(range)}`),
      api("/api/admin/plugin-analytics/stores"),
      api("/api/admin/plugin-analytics/events"),
      api(`/api/admin/site-analytics/overview?range=${encodeURIComponent(range)}`)
    ]);
    const cards = overviewBody.overview?.cards || {};
    const emptyStates = overviewBody.overview?.empty_states || {};
    setText("admin-connected-stores", cards.connected_stores ?? "-");
    setText("admin-active-stores", cards.active_stores ?? cards.active_stores_7d ?? "-");
    setText("admin-new-stores", cards.new_stores ?? cards.new_stores_7d ?? "-");
    setText("admin-processed", cards.images_processed ?? cards.images_processed_7d ?? "-");
    setText("admin-credits", cards.credits_consumed ?? cards.credits_consumed_7d ?? "-");
    setText("admin-failure-rate", formatPercent(cards.processing_failure_rate));
    setText("admin-approval-rate", formatPercent(cards.approval_rate));
    setText("admin-subscriptions", cards.active_subscriptions ?? "-");
    setText("admin-mrr", `$${Number(cards.mrr_usd || 0).toLocaleString()} USD`);
    setHelper("admin-processed", emptyStates.images_processed);
    setHelper("admin-failure-rate", emptyStates.processing_failure_rate);
    setHelper("admin-approval-rate", emptyStates.approval_rate);
    setHelper("admin-subscriptions", emptyStates.active_subscriptions);

    renderEventMix(overviewBody.event_counts_30d || []);
    renderAdminTrends(overviewBody.trends || []);
    renderSiteAnalyticsOverview(siteBody.overview);

    const storeRows = document.getElementById("admin-store-rows");
    if (storeRows) {
      const stores = storesBody.stores || [];
      storeRows.innerHTML = stores.length
        ? stores.map((store) => `
          <tr>
            <td>${escapeHtml(store.domain)}</td>
            <td>${escapeHtml(store.account_email)}</td>
            <td>${escapeHtml(store.plan || "-")}</td>
            <td>${escapeHtml(store.billing_status || store.claim_status || "-")}</td>
            <td>${escapeHtml(store.credits_remaining ?? "-")}</td>
            <td>${escapeHtml(store.plugin_version || "-")}</td>
            <td>${escapeHtml(store.woocommerce_version || "-")}</td>
            <td>${escapeHtml(store.total_processed ?? 0)}</td>
            <td>${escapeHtml(store.total_approved ?? 0)}</td>
            <td>${escapeHtml(store.total_failed ?? 0)}</td>
            <td>${escapeHtml(formatDate(store.last_seen_at))}</td>
          </tr>
        `).join("")
        : `<tr><td colspan="11">No connected stores yet.</td></tr>`;
    }

    renderList("admin-event-rows", eventsBody.events || [], (event) => `${escapeHtml(event.event_type)}<br><small>${escapeHtml(event.canonical_domain || "-")} · ${escapeHtml(formatDate(event.created_at))}</small>`);

    if (content) content.hidden = false;
  } catch (error) {
    if (denied) {
      denied.hidden = false;
      const message = denied.querySelector("p");
      if (message) message.textContent = error.message;
    }
  }
}

function ensureAdminRangeControl() {
  const content = document.getElementById("admin-analytics-content");
  if (!content || document.getElementById("admin-range")) return;
  const control = document.createElement("div");
  control.className = "admin-range-control";
  control.innerHTML = `
    <label for="admin-range">Date range</label>
    <select id="admin-range">
      <option value="7">Last 7 days</option>
      <option value="30">Last 30 days</option>
      <option value="90">Last 90 days</option>
      <option value="all">All time</option>
    </select>
  `;
  content.prepend(control);
  control.querySelector("select")?.addEventListener("change", loadAdminAnalytics);
}

function setHelper(metricId, message) {
  const metric = document.getElementById(metricId);
  if (!metric) return;
  let helper = metric.parentElement?.querySelector(".metric-helper");
  if (!helper && metric.parentElement) {
    helper = document.createElement("small");
    helper.className = "metric-helper";
    metric.parentElement.appendChild(helper);
  }
  if (helper) helper.textContent = message || "";
}

function renderEventMix(items) {
  const node = document.getElementById("admin-event-counts");
  if (!node) return;
  if (!items.length) {
    node.innerHTML = `<p>No plugin events have been recorded yet. Events start after connected stores perform actions.</p>`;
    return;
  }
  const max = Math.max(...items.map((item) => Number(item.count || 0)), 1);
  node.innerHTML = items.map((item) => `
    <div class="event-bar-row">
      <span>${escapeHtml(item.event_type)}</span>
      <strong>${escapeHtml(item.count)}</strong>
      <div class="event-bar"><div style="width:${Math.round((Number(item.count || 0) / max) * 100)}%"></div></div>
    </div>
  `).join("");
}

function renderAdminTrends(rows) {
  let node = document.getElementById("admin-trends");
  const anchor = document.getElementById("admin-event-counts")?.closest(".dash-panel");
  if (!node && anchor) {
    const panel = document.createElement("section");
    panel.className = "dash-panel wide admin-table-panel";
    panel.innerHTML = `<h2>Usage and credits trend</h2><div id="admin-trends" class="dash-list"></div>`;
    anchor.after(panel);
    node = panel.querySelector("#admin-trends");
  }
  if (!node) return;
  if (!rows.length) {
    node.innerHTML = `<p>No trend data yet for this period.</p>`;
    return;
  }
  node.innerHTML = rows.slice(-14).map((row) => `
    <div class="dash-item">
      <strong>${escapeHtml(row.date)}</strong><br>
      <small>Processed: ${escapeHtml(row.processed || 0)} · Approved: ${escapeHtml(row.approved || 0)} · Failed: ${escapeHtml(row.failed || 0)} · Credits used: ${escapeHtml(row.credits_consumed || 0)} · Credits added: ${escapeHtml(row.credits_added || 0)}</small>
    </div>
  `).join("");
}

function renderSiteAnalyticsOverview(overview) {
  const content = document.getElementById("admin-analytics-content");
  if (!content || !overview) return;
  let node = document.getElementById("site-growth-analytics");
  if (!node) {
    const panel = document.createElement("section");
    panel.className = "dash-panel wide admin-table-panel";
    panel.id = "site-growth-analytics";
    panel.innerHTML = `
      <h2>Website growth analytics</h2>
      <div class="metric-grid site-growth-cards"></div>
      <div class="dashboard-grid compact-growth-grid">
        <div><h3>Top landing pages</h3><div data-growth-list="landing"></div></div>
        <div><h3>Top referrers</h3><div data-growth-list="referrers"></div></div>
        <div><h3>Top campaigns</h3><div data-growth-list="campaigns"></div></div>
        <div><h3>Conversion by source</h3><div data-growth-list="sources"></div></div>
      </div>
    `;
    content.prepend(panel);
    node = panel;
  }
  const cards = overview.cards || {};
  const cardLabels = [
    ["Visitors", cards.total_visitors],
    ["Landing events", cards.total_events],
    ["Product views", cards.product_page_views],
    ["Download clicks", cards.download_clicks],
    ["Downloads done", cards.download_completions],
    ["Pricing clicks", cards.pricing_cta_clicks],
    ["Checkout starts", cards.checkout_starts],
    ["Checkout wins", cards.checkout_successes],
    ["Contacts", cards.contact_submits],
    ["Shopify installs", cards.shopify_installs]
  ];
  node.querySelector(".site-growth-cards").innerHTML = cardLabels.map(([label, value]) => `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></div>`).join("");
  const renderRows = (selector, rows, formatter = (row) => `${row.label || row.source || row.landing_page || "-"} - ${row.count || row.visits || 0}`) => {
    const target = node.querySelector(`[data-growth-list="${selector}"]`);
    if (!target) return;
    target.innerHTML = rows?.length
      ? `<div class="dash-list">${rows.slice(0, 6).map((row) => `<div class="dash-item">${escapeHtml(formatter(row))}</div>`).join("")}</div>`
      : `<p>No data yet.</p>`;
  };
  renderRows("landing", overview.top_landing_pages);
  renderRows("referrers", overview.top_referrers);
  renderRows("campaigns", overview.top_utm_campaigns);
  renderRows("sources", overview.conversion_rate_by_source, (row) => `${row.source || "-"} - ${row.conversions || 0}/${row.visits || 0} (${formatPercent(row.conversion_rate)})`);
}

document.getElementById("site-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const body = await api("/sites/connect", {
      method: "POST",
      body: JSON.stringify({ domain: form.get("domain") })
    });
    document.getElementById("new-token").textContent = `New site token for ${body.site.domain}:\n${body.api_token}`;
    trackConversion("docs_api_token_interest", { cta_location: "site_connect", funnel_stage: "retention" });
    await loadDashboard();
  } catch (error) {
    document.getElementById("new-token").textContent = error.message;
  }
});

document.addEventListener("click", async (event) => {
  const planButton = event.target.closest("[data-plan]");
  const packButton = event.target.closest("[data-pack]");
  if (planButton) {
    event.preventDefault();
    await checkout({ type: "subscription", plan: planButton.dataset.plan }, planButton);
    return;
  }
  if (packButton) {
    event.preventDefault();
    await creditCheckout(packButton.dataset.pack, packButton);
  }
});

function checkoutMessageNode(button) {
  return document.getElementById("billing-message")
    || document.getElementById("pricing-message")
    || button?.closest(".dash-panel, .page-band")?.querySelector(".form-message")
    || null;
}

function showCheckoutMessage(button, message) {
  const node = checkoutMessageNode(button);
  if (node) {
    node.textContent = message;
    return;
  }

  if (message) {
    alert(message);
  }
}

async function checkout(payload, button) {
  if (!token()) {
    showCheckoutMessage(button, "Login or create an account before opening checkout.");
    trackEvent("checkout_error", { page_path: location.pathname, plan_name: payload?.plan, error_category: "auth", funnel_stage: "intent" });
    history.pushState({}, "", "/login");
    routeTo("/login");
    return;
  }

  const originalText = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Opening checkout...";
    }
    showCheckoutMessage(button, "");
    trackEvent("checkout_started", { page_path: location.pathname, plan_name: payload?.plan, plan_interval: "monthly", currency: "usd", funnel_stage: "intent" });
    const body = await api("/api/billing/create-checkout-session", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    trackEvent("checkout_redirected", { page_path: location.pathname, plan_name: payload?.plan, plan_interval: "monthly", currency: "usd", funnel_stage: "intent" });
    location.href = body.url;
  } catch (error) {
    showCheckoutMessage(button, error.message);
    trackEvent("checkout_error", { page_path: location.pathname, plan_name: payload?.plan, error_category: "checkout_start", funnel_stage: "intent" });
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function creditCheckout(pack, button) {
  if (!token()) {
    showCheckoutMessage(button, "Login or create an account before buying credits.");
    trackEvent("checkout_error", { page_path: location.pathname, plan_name: `credits_${pack}`, error_category: "auth", funnel_stage: "intent" });
    history.pushState({}, "", "/login");
    routeTo("/login");
    return;
  }

  const originalText = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Opening checkout...";
    }
    showCheckoutMessage(button, "");
    trackEvent("checkout_started", { page_path: location.pathname, plan_name: `credits_${pack}`, plan_interval: "one_time", currency: "usd", funnel_stage: "intent" });
    const body = await api("/api/billing/create-credit-checkout-session", {
      method: "POST",
      body: JSON.stringify({ pack })
    });
    trackEvent("checkout_redirected", { page_path: location.pathname, plan_name: `credits_${pack}`, plan_interval: "one_time", currency: "usd", funnel_stage: "intent" });
    location.href = body.url;
  } catch (error) {
    showCheckoutMessage(button, error.message);
    trackEvent("checkout_error", { page_path: location.pathname, plan_name: `credits_${pack}`, error_category: "checkout_start", funnel_stage: "intent" });
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function openPortal() {
  if (!token()) {
    history.pushState({}, "", "/login");
    routeTo("/login");
    return;
  }
  const body = await api("/api/billing/create-portal-session", { method: "POST", body: "{}" });
  location.href = body.url;
}
document.getElementById("portal-button")?.addEventListener("click", openPortal);
document.getElementById("portal-button-secondary")?.addEventListener("click", openPortal);

loadCurrentUser().finally(() => routeTo(location.pathname));
