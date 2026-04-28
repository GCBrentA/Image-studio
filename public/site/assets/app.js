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
  fileSize: "61.7 KB",
  sha256: "5836CACF36938E23505D333608C43ABF70485B64A2E045A3E77969D5A6ED808E",
  wordpressOrgStatus: "WordPress.org review pending",
  updatedAt: "2026-04-28"
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
    "/optivra-image-studio": "Optivra Image Studio | WooCommerce Product Image Optimisation",
    "/payment-gateway-rules-for-woocommerce": "Payment Gateway Rules for WooCommerce | Control Checkout Payment Methods",
    "/catalogue-image-studio": "Optivra Image Studio | WooCommerce Product Image Optimisation",
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
    "/optivra-image-studio": "Optimise WooCommerce product images with AI-powered background replacement, review workflows, and SEO-friendly image metadata.",
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
    if (normalized === "/pricing") trackConversion("pricing_clicked", { path: normalized });
    if (normalized === "/support") trackConversion("support_clicked", { path: normalized });
    if (normalized === "/login") trackConversion("login_clicked", { path: normalized });
    if (normalized === "/docs" || normalized.startsWith("/docs/")) trackConversion("view_docs_clicked", { path: normalized });
    if (normalized === "/blog" || normalized.startsWith("/blog/")) trackConversion("blog_cta_clicked", { path: normalized });
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

const analyticsParamKeys = new Set(["path", "plugin", "location", "plan", "pack", "source", "cta"]);

function isPublicAnalyticsPath(path = location.pathname) {
  return !(
    path.startsWith("/admin") ||
    path.startsWith("/api") ||
    path.startsWith("/account") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/billing/")
  );
}

function analyticsReady(path = location.pathname) {
  return Boolean(
    window.optivraAnalytics?.enabled &&
    window.optivraAnalytics?.measurementId &&
    typeof window.gtag === "function" &&
    isPublicAnalyticsPath(path)
  );
}

function sanitizeAnalyticsParams(properties = {}) {
  const safe = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (!analyticsParamKeys.has(key)) return;
    if (value === undefined || value === null) return;
    safe[key] = String(value).replace(/[^\w\-./# ]/g, "").slice(0, 90);
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

function trackPageView(path = location.pathname) {
  if (!analyticsReady(path)) return;
  window.gtag("config", window.optivraAnalytics.measurementId, {
    page_path: path,
    anonymize_ip: true
  });
}

function trackEvent(eventName, properties = {}) {
  if (!analyticsReady()) return;
  window.gtag("event", eventName, sanitizeAnalyticsParams(properties));
}

function trackConversion(eventName, properties = {}) {
  trackEvent(eventName, properties);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-analytics], [data-download-zip], [data-plan], [data-pack]");
  if (!target) return;

  const explicitEvent = target.dataset.analytics;
  if (explicitEvent) {
    const plugin = pluginFromTarget(target);
    const props = { path: location.pathname, plugin, location: location.pathname };
    trackConversion(explicitEvent, props);
    if (explicitEvent === "signup_clicked") {
      trackConversion("create_account_clicked", props);
      trackConversion("signup_started", props);
    }
    if (explicitEvent === "download_plugin_clicked") {
      trackConversion(plugin === "payment_gateway_rules" ? "download_payment_rules_clicked" : "download_image_studio_clicked", props);
    }
    if (explicitEvent === "docs_opened") {
      trackConversion("view_docs_clicked", props);
      trackConversion(plugin === "payment_gateway_rules" ? "payment_rules_docs_clicked" : "image_studio_docs_clicked", props);
    }
    if (explicitEvent === "pricing_plan_clicked") {
      trackConversion("pricing_clicked", props);
    }
    return;
  }

  if (target.matches("[data-download-zip]")) {
    const plugin = pluginFromTarget(target);
    const props = { path: location.pathname, plugin, location: "downloads_page" };
    trackConversion("download_plugin_clicked", props);
    trackConversion(plugin === "payment_gateway_rules" ? "download_payment_rules_clicked" : "download_image_studio_clicked", props);
  } else if (target.matches("[data-plan]")) {
    trackConversion("pricing_clicked", { plan: target.dataset.plan, path: location.pathname });
  } else if (target.matches("[data-pack]")) {
    trackConversion("buy_credits_clicked", { pack: target.dataset.pack, path: location.pathname });
  }
});

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
  trackConversion("login_clicked", { path: location.pathname });
  await submitAuth("/auth/login");
});
document.getElementById("register-button")?.addEventListener("click", async () => {
  trackConversion("signup_started", { path: location.pathname });
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
      trackConversion("signup_completed", { path: location.pathname });
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
    const [overviewBody, storesBody, eventsBody] = await Promise.all([
      api(`/api/admin/plugin-analytics/overview?range=${encodeURIComponent(range)}`),
      api("/api/admin/plugin-analytics/stores"),
      api("/api/admin/plugin-analytics/events")
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

document.getElementById("site-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const body = await api("/sites/connect", {
      method: "POST",
      body: JSON.stringify({ domain: form.get("domain") })
    });
    document.getElementById("new-token").textContent = `New site token for ${body.site.domain}:\n${body.api_token}`;
    trackConversion("copy_api_token_clicked", { source: "site_connect" });
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
    const body = await api("/api/billing/create-checkout-session", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    location.href = body.url;
  } catch (error) {
    showCheckoutMessage(button, error.message);
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
    const body = await api("/api/billing/create-credit-checkout-session", {
      method: "POST",
      body: JSON.stringify({ pack })
    });
    location.href = body.url;
  } catch (error) {
    showCheckoutMessage(button, error.message);
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
