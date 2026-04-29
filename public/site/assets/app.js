const pages = Array.from(document.querySelectorAll("[data-page]"));
const navLinks = Array.from(document.querySelectorAll("[data-link]"));
const menuToggle = document.querySelector(".mobile-menu-toggle");
const primaryNav = document.getElementById("primary-navigation");
const tokenKey = "optivra_token";
const PRODUCT_NAME = "Optivra Image Studio";
const PRODUCT_NAME_WOOCOMMERCE = "Optivra Image Studio for WooCommerce";
const PRODUCT_TAGLINE = "Product image intelligence for WooCommerce.";
const pluginRelease = {
  slug: "optivra-image-studio",
  name: "Optivra Image Studio for WooCommerce",
  version: "1.0.0",
  zipPath: "/downloads/optivra-image-studio-for-woocommerce-1.0.0.zip",
  fileSize: "61.5 KB",
  sha256: "546DB7F93B878FEDD7248B0C037918D23A853A87D9400D2F972D9CF693290634",
  wordpressOrgStatus: "WordPress.org review pending",
  updatedAt: "2026-04-29"
};
const gatewayRulesRelease = {
  slug: "optivra-gateway-rules",
  name: "Optivra Gateway Rules for WooCommerce",
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
let headerAccountMenuOpen = false;
const authActionsRoot = document.getElementById("header-auth-actions");
const mobileHeaderShortcuts = document.getElementById("mobile-account-shortcuts");

function token() {
  return localStorage.getItem(tokenKey) || "";
}

function setToken(value) {
  localStorage.setItem(tokenKey, value);
}

function userDisplayName(user = {}) {
  const firstName = String(user.first_name || "").trim();
  const displayName = String(user.display_name || user.name || "").trim();
  const email = String(user.email || "").trim();
  if (displayName) return displayName;
  if (firstName) return firstName;
  if (email) return email.split("@")[0] || "Account";
  return "Account";
}

function userDisplayLabel(user = {}) {
  const name = userDisplayName(user);
  return name.length > 18 ? `${name.slice(0, 16)}…` : name;
}

function userInitials(user = {}) {
  const primary = userDisplayName(user);
  if (!primary || primary === "Account") return "AU";
  const parts = String(primary).trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function closeHeaderAccountMenu() {
  if (!headerActionsRoot) return;
  const menu = headerActionsRoot.querySelector("#header-account-menu");
  const trigger = headerActionsRoot.querySelector("#header-account-trigger");
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  headerAccountMenuOpen = false;
}

function toggleHeaderAccountMenu() {
  if (!headerActionsRoot) return;
  const menu = headerActionsRoot.querySelector("#header-account-menu");
  const trigger = headerActionsRoot.querySelector("#header-account-trigger");
  if (!menu || !trigger) return;
  headerAccountMenuOpen = !headerAccountMenuOpen;
  menu.hidden = !headerAccountMenuOpen;
  trigger.setAttribute("aria-expanded", String(headerAccountMenuOpen));
}

function updateMobileAuthShortcuts() {
  if (!mobileHeaderShortcuts) return;

  if (!currentUserLoaded) {
    mobileHeaderShortcuts.hidden = true;
    mobileHeaderShortcuts.innerHTML = "";
    return;
  }

  if (!currentUser) {
    mobileHeaderShortcuts.hidden = true;
    mobileHeaderShortcuts.innerHTML = "";
    return;
  }

  const portalHref = "/dashboard";
  mobileHeaderShortcuts.hidden = false;
  mobileHeaderShortcuts.innerHTML = `
    <div class="mobile-auth-title">Account</div>
    <a href="${portalHref}" data-link>Portal</a>
    <a href="/account" data-link>My Account</a>
    <a href="/account/billing" data-link>Billing</a>
    <a href="/support" data-link>Support</a>
    <button type="button" data-auth-logout>Log out</button>
  `;
}

function updateAuthActions() {
  if (!authActionsRoot) return;
  if (!currentUserLoaded) {
    authActionsRoot.innerHTML = `
      <div class="header-auth-loading" role="status" aria-live="polite" aria-label="Checking your account session">
        <span class="header-skeleton-pill"></span>
      </div>
    `;
    return;
  }

  if (!currentUser) {
    authActionsRoot.innerHTML = `
      <a class="button ghost" href="/login" data-link data-analytics="click_open_admin">Login</a>
      <a class="button primary" href="/free-woocommerce-image-audit" data-link data-analytics="click_run_free_audit">Run Free Audit</a>
    `;
    closeHeaderAccountMenu();
    updateMobileAuthShortcuts();
    return;
  }

  const accountName = userDisplayName(currentUser);
  const accountLabel = userDisplayLabel(currentUser);
  const signedInLine = String(currentUser.email || currentUser.display_name || accountName || "account");
  const portalHref = "/dashboard";
  const menuId = "header-account-menu";
  const triggerId = "header-account-trigger";
  const avatar = userInitials(currentUser);

  authActionsRoot.innerHTML = `
    <a class="button ghost header-portal-btn" href="${portalHref}" data-link aria-label="Open portal">Portal</a>
    <div class="account-menu-wrap">
      <button id="${triggerId}" class="account-chip" type="button" data-auth-account-trigger aria-expanded="false" aria-controls="${menuId}" aria-haspopup="menu" aria-label="Open account menu">
        <span class="account-avatar" aria-hidden="true">${escapeHtml(avatar)}</span>
        <span class="account-chip-text" title="${escapeHtml(accountName)}">${escapeHtml(accountLabel)}</span>
        <span class="account-chip-caret" aria-hidden="true">&#9662;</span>
      </button>
      <div id="${menuId}" class="account-dropdown" hidden>
        <p class="account-meta">Signed in as</p>
        <p class="account-meta-value" title="${escapeHtml(signedInLine)}">${escapeHtml(signedInLine)}</p>
        <a href="/account" data-link>My Account</a>
        <a href="${portalHref}" data-link>Portal / Dashboard</a>
        <a href="/account/billing" data-link>Billing</a>
        <a href="/settings" data-link>Connected Stores</a>
        <a href="/downloads" data-link>Downloads</a>
        <a href="/support" data-link>Support</a>
        <button type="button" data-auth-logout>Log out</button>
      </div>
    </div>
  `;
  updateMobileAuthShortcuts();
}

function handleHeaderAuthLogout() {
  setToken("");
  currentUser = null;
  currentUserLoaded = true;
  updateAdminVisibility();
  closeHeaderAccountMenu();
  updateAuthActions();
  history.pushState({}, "", "/");
  routeTo("/");
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
  if (normalized === "/reports") {
    loadReports();
  }
  if (normalized === "/analytics") {
    loadAnalyticsTrends();
  }
  if (normalized === "/recommendations") {
    loadPortalRecommendations();
  }
  if (normalized === "/queue") {
    loadAuditQueuePage();
  }
  if (normalized === "/backgrounds") {
    loadBackgroundsPage();
  }
  if (normalized === "/settings") {
    loadSettingsPage();
  }
  if (normalized === "/support") {
    loadSupportPage();
  }
  if (["/seo-tools"].includes(normalized)) {
    renderPortalPlaceholder(normalized);
  }
  if (normalized === "/account/billing" || normalized === "/billing/success" || normalized === "/billing/credits/success") {
    loadBilling();
  }
  if (normalized === "/downloads") {
    loadDownloads();
  }
  if (normalized === "/feedback") {
    loadFeedbackPage();
  }
  if (normalized === "/unsubscribe") {
    loadUnsubscribePage();
  }
  if (normalized === "/blog" || normalized.startsWith("/blog/")) {
    renderBlog(normalized);
  }
  renderExampleReportMocks();
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
    "/": "Optivra | WooCommerce Product Image Intelligence",
    "/plugins": "Plugins | Optivra",
    "/woocommerce-plugins": "WooCommerce Plugins by Optivra | Checkout Rules and Image Optimisation",
    "/optivra-image-studio": "Optivra Image Studio | WooCommerce Product Image SEO & AI Image Optimisation",
    "/free-woocommerce-image-audit": "Free WooCommerce Product Image Audit | Optivra",
    "/payment-gateway-rules-for-woocommerce": "Free WooCommerce Payment Gateway Rules Plugin | Optivra",
    "/catalogue-image-studio": "Optivra Image Studio | WooCommerce Product Image SEO & AI Image Optimisation",
    "/pricing": "Optivra Pricing | Free Image Audit & AI Image Processing Credits",
    "/downloads": "Download WooCommerce Plugins | Optivra",
    "/feedback": "Optivra Plugin Feedback | Optivra",
    "/unsubscribe": "Unsubscribe | Optivra",
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
    "/reports": "Product Image Health Reports | Optivra",
    "/recommendations": "Recommendations | Optivra",
    "/queue": "Queue | Optivra",
    "/analytics": "Analytics | Optivra",
    "/backgrounds": "Backgrounds | Optivra",
    "/seo-tools": "SEO Tools | Optivra",
    "/settings": "Settings | Optivra",
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
    "/": "Run a free WooCommerce Product Image Health Report, find image SEO, speed, consistency and product presentation issues, then fix priority product images safely with AI.",
    "/woocommerce-plugins": "Download WooCommerce plugins from Optivra, including Payment Gateway Rules for WooCommerce and Optivra Image Studio for product image optimisation and SEO metadata.",
    "/optivra-image-studio": "Scan, score and improve WooCommerce product images with Image Health Reports, SEO insights, safe AI background cleanup, review queues and rollback.",
    "/free-woocommerce-image-audit": "Find missing alt text, oversized images, generic filenames, inconsistent backgrounds and product image issues with a free Product Image Health Report.",
    "/payment-gateway-rules-for-woocommerce": "Control WooCommerce payment gateways by cart value, currency, country, shipping method, user role and more.",
    "/pricing": "Start with a free Product Image Health Report. Use credits when Optivra processes, optimises or improves WooCommerce product images.",
    "/downloads": "Download Optivra WooCommerce plugins, including Optivra Image Studio and Payment Gateway Rules for WooCommerce.",
    "/feedback": "Share private feedback about Optivra plugin downloads, setup, and WooCommerce plugin use.",
    "/unsubscribe": "Update Optivra plugin email preferences without logging in.",
    "/docs/ai-image-studio": "Learn how to use Optivra Image Studio to scan, process, review, approve, and optimise WooCommerce product images.",
    "/docs/payment-gateway-rules-for-woocommerce": "Learn how to install Payment Gateway Rules for WooCommerce, create checkout gateway rules, test payment method visibility, and troubleshoot common issues.",
    "/blog": "WooCommerce image SEO guides covering alt text, product image metadata, background replacement, and AI product photography.",
    "/blog/how-to-optimise-woocommerce-product-images-for-seo": "Learn how to optimise WooCommerce product images with better filenames, alt text, backgrounds, review workflows, and metadata.",
    "/blog/woocommerce-product-image-seo-checklist": "Use this WooCommerce product image SEO checklist before publishing product images in your store.",
    "/blog/how-to-write-alt-text-for-woocommerce-product-images": "Write useful WooCommerce product image alt text that supports accessibility, product context, and search relevance.",
    "/blog/how-to-replace-product-image-backgrounds-in-woocommerce": "Learn how to replace product image backgrounds in WooCommerce while preserving originals and reviewing results.",
    "/blog/ai-product-photography-for-woocommerce-stores": "See how AI product photography can standardise WooCommerce product visuals with review controls.",
    "/reports": "View Product Image Health Report history and full ecommerce image audit reports in the Optivra portal.",
    "/recommendations": "Review product image recommendations from Optivra Image Health Reports.",
    "/queue": "Review and manage Optivra Image Studio processing queue actions.",
    "/analytics": "Review Optivra Image Studio catalogue and conversion analytics.",
    "/backgrounds": "Manage Optivra Image Studio background presets.",
    "/seo-tools": "Review Optivra Image Studio image SEO tools.",
    "/settings": "Manage Optivra Image Studio portal settings.",
    "/support": "Contact Optivra support for Optivra Image Studio setup, billing, plugin, and product image processing help."
  };
  return descriptions[path] || descriptions["/"];
}

function renderExampleReportMocks() {
  document.querySelectorAll("[data-example-report-mock]").forEach((node) => {
    node.innerHTML = `
      <article class="example-report-card" aria-label="Example Product Image Health Report preview">
        <div class="example-report-header">
          <div>
            <p class="eyebrow">Example report preview</p>
            <h2>Product Image Health Score</h2>
            <p>Sample values only. Run your own free audit to see your catalogue.</p>
          </div>
          <div class="score-orb"><strong>64</strong><span>/100</span></div>
        </div>
        <div class="report-score-grid">
          <div><span>Image SEO</span><strong>42/100</strong></div>
          <div><span>Catalogue Consistency</span><strong>54/100</strong></div>
          <div><span>Performance</span><strong>48/100</strong></div>
        </div>
        <div class="report-finding-list">
          <span>184 missing alt text fields</span>
          <span>211 oversized product images</span>
          <span>91 inconsistent backgrounds</span>
          <span>37 generic filenames</span>
          <span>18-34 hours manual work found</span>
        </div>
        <a class="button primary" href="/free-woocommerce-image-audit" data-link data-analytics="click_run_free_audit">Run your own free audit</a>
      </article>
    `;
  });
}

function pageRobots(path) {
  return (
    path.startsWith("/account") ||
    path.startsWith("/admin") ||
    path === "/dashboard" ||
    path === "/reports" ||
    path === "/recommendations" ||
    path === "/queue" ||
    path === "/analytics" ||
    path === "/backgrounds" ||
    path === "/seo-tools" ||
    path === "/settings" ||
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
    const plannedTopics = [
      "Free WooCommerce Product Image Audit: What to Check Before Optimising",
      "WooCommerce Image SEO: Alt Text, Filenames and Product Feed Readiness",
      "AI Background Removers vs WooCommerce Image Workflow Tools",
      "How to Keep Product Images Accurate When Using AI",
      "Why Inconsistent Product Images Hurt Ecommerce Trust",
      "WooCommerce Product Image Health Score: What It Means",
      "How to Prepare WooCommerce Product Images for Product Feeds",
      "Why Review-Before-Replace Matters for AI Product Images"
    ];
    page.innerHTML = `
      <p class="eyebrow">Resources</p>
      <h1>WooCommerce Product Image Optimisation Blog</h1>
      <p class="lead">Practical guides for WooCommerce Product Image Health Reports, image SEO, product-feed readiness, safe AI processing, backgrounds, metadata, and catalogue workflows.</p>
      <div class="docs-actions">
        <a class="button primary" href="/free-woocommerce-image-audit" data-link data-analytics="click_run_free_audit">Run Free Image Audit</a>
        <a class="button ghost" href="/optivra-image-studio" data-link>Explore Image Studio</a>
        <a class="button ghost" href="/docs" data-link>Read Docs</a>
      </div>
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
      <section class="landing-section">
        <h2>Planned Image Studio guides</h2>
        <div class="mini-card-grid">
          ${plannedTopics.map((topic) => `<div><strong>${escapeHtml(topic)}</strong><p>Coming soon, with links to the free audit, Image Studio workflow, pricing and docs.</p></div>`).join("")}
        </div>
      </section>
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
      <p>Run a free Product Image Health Report, queue priority fixes, review before and after results, edit SEO metadata, and approve replacements from a practical WooCommerce workflow.</p>
      <div class="docs-actions">
        <a class="button primary" href="/free-woocommerce-image-audit" data-link data-analytics="click_run_free_audit">Run Free Image Audit</a>
        <a class="button ghost" href="/optivra-image-studio" data-link>Explore Image Studio</a>
        <a class="button ghost" href="/pricing" data-link data-analytics="click_pricing_plan">View pricing</a>
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
  const logoutButton = event.target.closest("[data-auth-logout]");
  if (logoutButton) {
    event.preventDefault();
    handleHeaderAuthLogout();
    return;
  }

  const authTrigger = event.target.closest("[data-auth-account-trigger]");
  if (authTrigger) {
    event.preventDefault();
    toggleHeaderAccountMenu();
    return;
  }

  if (headerActionsRoot && !headerActionsRoot.contains(event.target)) {
    closeHeaderAccountMenu();
  } else if (event.target.closest(".account-dropdown a")) {
    closeHeaderAccountMenu();
  }

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
  if (event.target && event.target.closest("#header-account-trigger") && (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")) {
    event.preventDefault();
    toggleHeaderAccountMenu();
    return;
  }
  if (event.key === "Escape") {
    closeMobileMenu();
    closeHeaderAccountMenu();
  }
  if (event.key === "Tab" && headerAccountMenuOpen && authActionsRoot && !authActionsRoot.contains(document.activeElement)) {
    closeHeaderAccountMenu();
  }
});

document.addEventListener("click", (event) => {
  if (headerAccountMenuOpen && headerActionsRoot && !headerActionsRoot.contains(event.target) && !event.target.closest(".account-dropdown")) {
    closeHeaderAccountMenu();
  }
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
  "downloads_page_view", "plugin_download_click", "plugin_download_modal_open", "plugin_download_request_submit", "plugin_download_started", "plugin_download_completed", "plugin_download_failed", "plugin_feedback_submit",
  "download_email_capture_start", "download_email_capture_submit", "download_email_capture_error", "download_version_selected", "download_changelog_view",
  "pricing_page_view", "pricing_plan_view", "pricing_plan_expand", "pricing_plan_compare", "pricing_cta_click", "pricing_faq_expand",
  "pricing_monthly_selected", "pricing_yearly_selected", "checkout_started", "checkout_redirected", "checkout_success_landing", "checkout_cancelled", "checkout_error",
  "docs_page_view", "docs_section_view", "docs_search", "docs_install_step_view", "docs_copy_code_click", "docs_support_click",
  "docs_previous_next_click", "docs_plugin_setup_interest", "docs_api_token_interest",
  "blog_index_view", "blog_post_view", "blog_scroll_75", "blog_cta_click", "blog_related_post_click", "blog_category_click", "blog_author_click",
  "blog_exit_to_product", "blog_exit_to_download", "blog_exit_to_pricing",
  "support_page_view", "contact_form_start", "contact_form_submit", "contact_form_success", "contact_form_error", "support_email_click", "support_docs_click",
  "shopify_embedded_app_loaded",
  "click_run_free_audit", "click_view_example_report", "click_download_image_studio", "click_download_gateway_rules",
  "click_pricing_plan", "click_credit_pack", "click_open_admin", "click_docs_getting_started", "click_support_contact"
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

window.optivraAnalyticsDebug = function optivraAnalyticsDebug() {
  let consentState = "granted";
  try {
    consentState = localStorage.getItem("optivra_analytics_consent") || "granted";
  } catch {
    consentState = "storage_unavailable";
  }
  const ga4MeasurementId = window.optivraAnalytics?.measurementId || "";
  const googleTagId = window.optivraAnalytics?.googleTagId || "";
  const gtagLoaded = Boolean(window.optivraAnalytics?.gtagLoaded);
  const analyticsEnabled = Boolean(window.optivraAnalytics?.enabled);
  return {
    ga4MeasurementId,
    googleTagId,
    gtagLoaded,
    dataLayerLength: Array.isArray(window.dataLayer) ? window.dataLayer.length : 0,
    lastPageViewPath: analyticsState.lastPagePath,
    analyticsEnabled,
    consentState,
    cspLikelyBlocking: Boolean(analyticsEnabled && (ga4MeasurementId || googleTagId) && !gtagLoaded)
  };
};

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
  const explicit = target?.dataset?.pluginDownload || target?.dataset?.pluginSlug || "";
  if (explicit.includes("gateway")) return "optivra-gateway-rules";
  if (explicit.includes("image-studio")) return "optivra-image-studio";
  const path = location.pathname;
  if (href.includes("payment-gateway-rules") || href.includes("optivra-gateway-rules") || path.includes("payment-gateway-rules")) return "optivra-gateway-rules";
  if (href.includes("optivra-image-studio") || path.includes("optivra-image-studio")) return "optivra-image-studio";
  return "woocommerce_plugins";
}

function routeGroup(path = location.pathname) {
  const normalized = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (normalized === "/") return "home";
  if (normalized.startsWith("/blog") || normalized.startsWith("/resources")) return "blog";
  if (normalized.startsWith("/docs")) return "docs";
  if (normalized.startsWith("/downloads")) return "downloads";
  if (normalized.startsWith("/pricing")) return "pricing";
  if (normalized.startsWith("/free-woocommerce-image-audit")) return "free_image_audit";
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
      product_slug: path.includes("image-studio") ? "optivra-image-studio" : undefined,
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
  if (approvedAnalyticsEvents.has(value)) return value;
  if (value === "signup_clicked") return route === "home" ? "home_hero_cta_click" : "hero_cta_click";
  if (value === "download_plugin_clicked") {
    if (route === "home") return "home_download_cta_click";
    if (plugin === "optivra-image-studio") return "image_studio_download_click";
    return "plugin_download_click";
  }
  if (value === "docs_opened") return plugin === "optivra-image-studio" ? "image_studio_docs_click" : "docs_support_click";
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
    plugin_name: plugin === "optivra-gateway-rules" ? "Optivra Gateway Rules for WooCommerce" : "Optivra Image Studio",
    plugin_version: plugin === "optivra-gateway-rules" ? gatewayRulesRelease.version : pluginRelease.version,
    download_location: ctaLocation(target),
    download_type: "zip",
    gated: true,
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
  const target = event.target.closest("a, button, [data-analytics], [data-plugin-download], [data-download-zip], [data-plan], [data-pack]");
  if (!target) return;

  const explicitEvent = target.dataset?.analytics;
  const href = target.getAttribute?.("href") || "";
  const props = {
    cta_location: ctaLocation(target),
    cta_text: target.textContent || "",
    page_path: location.pathname,
    plugin_slug: pluginFromTarget(target),
    product_slug: pluginFromTarget(target) === "optivra-image-studio" ? "optivra-image-studio" : undefined,
    funnel_stage: "interest"
  };

  if (target.closest(".site-header")) trackEvent("nav_click", props);
  if (target.closest(".site-footer")) trackEvent("footer_click", props);
  if (href.startsWith("http") && !href.includes(location.hostname)) trackEvent("outbound_click", props);
  if (href.startsWith("mailto:")) trackEvent("support_email_click", { ...props, funnel_stage: "intent" });

  if (target.matches("[data-plugin-download]")) {
    event.preventDefault();
    openPluginDownloadModal(target.dataset.pluginDownload, target);
    return;
  }

  if (target.matches("[data-download-zip]")) {
    event.preventDefault();
    openPluginDownloadModal(pluginFromTarget(target), target);
    return;
  }

  if (target.matches("[data-plan]")) {
    trackEvent("pricing_cta_click", { ...props, plan_name: target.dataset.plan, plan_interval: "monthly", currency: "usd", funnel_stage: "intent" });
    trackEvent("click_pricing_plan", { ...props, plan_name: target.dataset.plan, plan_interval: "monthly", currency: "usd", funnel_stage: "intent" });
    return;
  }

  if (target.matches("[data-pack]")) {
    trackEvent("pricing_cta_click", { ...props, plan_name: `credits_${target.dataset.pack}`, plan_interval: "one_time", currency: "usd", funnel_stage: "intent" });
    trackEvent("click_credit_pack", { ...props, plan_name: `credits_${target.dataset.pack}`, plan_interval: "one_time", currency: "usd", funnel_stage: "intent" });
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
    throw new Error(body?.error?.message || body?.error || body?.message || "Request failed");
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
    updateAuthActions();
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
  const root = document.getElementById("studio-dashboard-root");
  if (root) {
    if (!token()) {
      root.innerHTML = portalShell("Image Studio Dashboard", "Log in to view Product Image Health Report trends, queue status and credit usage.", "overview", `
        <section class="portal-empty-state">
          <h2>Login required</h2>
          <p>Your Image Studio dashboard is connected to your Optivra account and WooCommerce stores.</p>
          <a class="button primary" href="/login" data-link>Login</a>
        </section>
      `);
      return;
    }

    root.innerHTML = portalShell("Image Studio Dashboard", "Loading your latest catalogue image health and processing activity.", "overview", renderPortalLoading("Loading dashboard..."));

    try {
      const [account, auditData] = await Promise.all([
        api("/account/dashboard"),
        api("/api/image-studio/audits?limit=50")
      ]);
      const scans = auditData.scans || [];
      const latestScan = scans[0] || null;
      const latestReport = latestScan?.id ? await api(`/api/image-studio/audits/${encodeURIComponent(latestScan.id)}`).catch(() => null) : null;
      root.innerHTML = portalShell("Image Studio Dashboard", "Your latest Product Image Health Report, queue signals and growth levers in one workspace.", "overview", renderImageStudioDashboard(account, scans, latestReport));
    } catch (error) {
      root.innerHTML = portalShell("Image Studio Dashboard", "Something stopped the dashboard from loading.", "overview", `
        <section class="portal-empty-state error">
          <h2>Dashboard unavailable</h2>
          <p>${escapeHtml(error.message)}</p>
          <button class="button primary" data-dashboard-reload>Try again</button>
        </section>
      `);
    }
    return;
  }

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

function renderImageStudioDashboard(account, scans, latestReport) {
  const latestScan = scans[0] || {};
  const metrics = latestReport?.metrics || latestScan || {};
  const recommendations = latestReport?.recommendations || latestReport?.top_recommendations || [];
  const imageJobs = account.image_jobs || [];
  const billing = account.billing || {};
  const usage = account.usage || {};
  const monthJobs = imageJobs.filter((job) => isThisMonth(job.created_at));
  const processedThisMonth = monthJobs.filter((job) => ["completed", "approved", "applied"].includes(String(job.status || ""))).length;
  const successRate = imageJobs.length
    ? Math.round((imageJobs.filter((job) => ["completed", "approved", "applied"].includes(String(job.status || ""))).length / imageJobs.length) * 100)
    : 0;
  const queueCount = imageJobs.filter((job) => ["queued", "processing", "pending"].includes(String(job.status || ""))).length;
  const creditsRemaining = billing.credits_remaining ?? usage.credits_remaining ?? 0;
  const creditsTotal = billing.credits_total ?? usage.credits_total ?? 0;
  const timeSaved = scans.filter((scan) => isThisMonth(scan.scan_completed_at || scan.created_at)).reduce((sum, scan) => sum + numeric(scan.estimated_manual_minutes_high), 0);
  const valueSaved = scans.filter((scan) => isThisMonth(scan.scan_completed_at || scan.created_at)).reduce((sum, scan) => sum + numeric(scan.estimated_cost_saved_high), 0);

  if (!scans.length) {
    return `
      <section class="dashboard-hero-card">
        <div>
          <span class="status-badge processing">Setup</span>
          <h2>Run your first Product Image Health Report</h2>
          <p>Scans are launched from the WooCommerce plugin so Optivra can inspect local product and attachment metadata safely.</p>
        </div>
        <div class="dashboard-actions">
          <a class="button primary" href="/docs/ai-image-studio#product-scan" data-link>Scan instructions</a>
          <a class="button ghost" href="/downloads" data-link>Download plugin</a>
        </div>
      </section>
      ${renderStoreConnectionPanel(account)}
      <section class="portal-card">
        <h2>No scan data yet</h2>
        <p class="muted-note">After a scan completes, this dashboard will show image health, recommendations, trends, queue health and ROI estimates.</p>
      </section>
    `;
  }

  return `
    <section class="dashboard-hero-card">
      <div>
        <span class="status-badge ready">Latest Scan Ready</span>
        <h2>Image health score ${scoreText(metrics.product_image_health_score)}</h2>
        <p>Latest scan: ${escapeHtml(formatDate(latestScan.scan_completed_at || latestScan.created_at))}. ${formatNumber(latestScan.images_scanned)} images across ${formatNumber(latestScan.products_scanned)} products.</p>
      </div>
      <div class="dashboard-actions">
        <button class="button primary" data-report-open="${escapeHtml(latestScan.id || "")}">View latest report</button>
        <a class="button ghost" href="/queue" data-link>Open queue</a>
        <a class="button ghost" href="/docs/ai-image-studio#product-scan" data-link>Run scan from plugin</a>
      </div>
    </section>

    <section class="dashboard-kpi-grid">
      ${metricTile("Health score", `${scoreText(metrics.product_image_health_score)}/100`)}
      ${metricTile("Latest scan date", formatDate(latestScan.scan_completed_at || latestScan.created_at))}
      ${metricTile("Images scanned", latestScan.images_scanned)}
      ${metricTile("Products scanned", latestScan.products_scanned)}
      ${metricTile("Credits remaining", `${formatNumber(creditsRemaining)} / ${formatNumber(creditsTotal)}`)}
      ${metricTile("Images processed this month", processedThisMonth)}
      ${metricTile("Estimated time saved this month", `${minutesToHours(timeSaved)} hrs`)}
      ${metricTile("Estimated editing value", `$${formatNumber(valueSaved)}`)}
      ${metricTile("Queue count", queueCount)}
      ${metricTile("Processing success rate", `${successRate}%`)}
    </section>

    ${renderStoreConnectionPanel(account)}

    <section class="report-two-column">
      <section class="portal-card">
        <div class="portal-section-head"><div><h2>Top recommendations</h2><p>The next fixes most likely to improve catalogue quality.</p></div></div>
        <div class="mini-recommendation-list">${renderMiniRecommendations(recommendations.slice(0, 3))}</div>
      </section>
      <section class="portal-card">
        <div class="portal-section-head"><div><h2>Score trend</h2><p>Latest Product Image Health Score over recent scans.</p></div><a class="button ghost" href="/analytics" data-link>Open analytics</a></div>
        ${renderTrendChart(scans.slice().reverse(), "product_image_health_score", "Health Score", "score")}
      </section>
    </section>

    <section class="portal-card">
      <div class="portal-section-head"><div><h2>Processed Image History</h2><p>Recent processed images with Product Preservation Safety status and processing mode.</p></div></div>
      ${renderProcessedImageHistory(imageJobs)}
    </section>
  `;
}

function renderStoreConnectionPanel(account = {}) {
  const sites = Array.isArray(account.connected_sites) ? account.connected_sites : [];
  return `
    <section class="portal-card store-connect-card">
      <div class="portal-section-head">
        <div>
          <h2>Connect a WooCommerce store</h2>
          <p>Generate a Site API Token, then paste it into the Optivra Image Studio plugin settings in WordPress. Existing tokens are never displayed again.</p>
        </div>
        <span class="status-badge ready">${sites.length ? `${sites.length} connected` : "Ready"}</span>
      </div>
      <div class="store-connect-grid">
        <form class="site-connect-form" id="site-form">
          <label>
            Store domain
            <input type="text" name="domain" placeholder="example.com" autocomplete="url" required />
          </label>
          <button class="button primary" type="submit">Generate Site API Token</button>
          <p class="muted-note">Use your production domain for store verification. Staging and local stores can connect for testing.</p>
          <pre class="token-output" id="new-token" aria-live="polite">Your new token will appear here once. Copy it into the WooCommerce plugin before leaving this page.</pre>
        </form>
        <div class="connected-sites-panel">
          <h3>Connected stores</h3>
          ${sites.length ? `
            <div class="dash-list">
              ${sites.map((site) => `
                <div class="dash-item">
                  <strong>${escapeHtml(site.domain || "WooCommerce store")}</strong><br>
                  <small>${escapeHtml(site.api_token_status || "configured")} · connected ${escapeHtml(formatDate(site.created_at))}</small>
                </div>
              `).join("")}
            </div>
          ` : `<p class="muted-note">No connected stores yet. Generate a token above, then connect it from WordPress.</p>`}
        </div>
      </div>
    </section>
  `;
}

function renderProcessedImageHistory(imageJobs) {
  const rows = imageJobs.filter((job) => job.original_url || job.processed_url).slice(0, 12);
  if (!rows.length) {
    return `<p class="muted-note">Processed image history will appear after images are processed.</p>`;
  }
  return `
    <div class="portal-table-wrap">
      <table class="portal-table">
        <thead><tr><th>Original</th><th>Processed</th><th>Status</th><th>Safety</th><th>Mode</th><th>Updated</th></tr></thead>
        <tbody>
          ${rows.map((job) => `
            <tr>
              <td>${job.original_url ? `<a href="${escapeHtml(job.original_url)}" target="_blank" rel="noopener noreferrer">View Original</a>` : "-"}</td>
              <td>${job.processed_url ? `<a href="${escapeHtml(job.processed_url)}" target="_blank" rel="noopener noreferrer">View Processed</a>` : "-"}</td>
              <td>${statusBadge(job.status || "unknown")}</td>
              <td>${safetyBadge(job.preservation_safety_status || "not_assessed")}</td>
              <td>${escapeHtml(formatProcessingMode(job.processing_mode || ""))}</td>
              <td>${escapeHtml(formatDate(job.updated_at || job.created_at))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMiniRecommendations(recommendations) {
  if (!recommendations.length) {
    return `<p class="muted-note">No recommendations are available yet. Run a fresh scan after recommendations are enabled for this store.</p>`;
  }
  return recommendations.map((item) => `
    <div class="mini-recommendation">
      ${priorityBadge(item.priority || item.severity || "medium")}
      <div>
        <strong>${escapeHtml(item.title || "Recommended fix")}</strong>
        <p>${escapeHtml(item.description || item.body || "")}</p>
      </div>
    </div>
  `).join("");
}

async function loadAnalyticsTrends() {
  const root = document.getElementById("analytics-root");
  if (!root) return;
  if (!token()) {
    root.innerHTML = portalShell("Analytics", "Log in to view Image Studio health trends.", "analytics", `
      <section class="portal-empty-state">
        <h2>Login required</h2>
        <p>Analytics are private to your Optivra account.</p>
        <a class="button primary" href="/login" data-link>Login</a>
      </section>
    `);
    return;
  }

  root.innerHTML = portalShell("Analytics", "Loading historical Product Image Health Report trends.", "analytics", renderPortalLoading("Loading analytics..."));

  try {
    const data = await api("/api/image-studio/audits?limit=100");
    const scans = data.scans || [];
    const latest = scans[0]?.id ? await api(`/api/image-studio/audits/${encodeURIComponent(scans[0].id)}`).catch(() => null) : null;
    root.innerHTML = portalShell("Analytics", "Track image health, SEO, quality, consistency, performance, issues and ROI over time.", "analytics", renderAnalyticsPage(scans, latest));
  } catch (error) {
    root.innerHTML = portalShell("Analytics", "Something stopped analytics from loading.", "analytics", `
      <section class="portal-empty-state error">
        <h2>Analytics unavailable</h2>
        <p>${escapeHtml(error.message)}</p>
        <button class="button primary" data-analytics-reload>Try again</button>
      </section>
    `);
  }
}

function renderAnalyticsPage(scans, latestReport) {
  if (!scans.length) {
    return `
      <section class="portal-empty-state">
        <h2>No scans yet</h2>
        <p>Analytics will appear after your WooCommerce plugin completes its first Product Image Health Report scan.</p>
        <a class="button primary" href="/docs/ai-image-studio#product-scan" data-link>Run scan from plugin</a>
      </section>
    `;
  }

  const ordered = scans.slice().reverse();
  const hasTrends = scans.length > 1;
  return `
    ${hasTrends ? "" : `<section class="portal-empty-state compact-empty"><h2>Trends will appear after you run more than one scan.</h2><p>Your latest scan is shown below, and historical trend lines will unlock after another scan completes.</p></section>`}
    <section class="analytics-chart-grid">
      ${renderTrendChart(ordered, "product_image_health_score", "Product Image Health Score", "score")}
      ${renderTrendChart(ordered, "seo_score", "SEO Score", "score")}
      ${renderTrendChart(ordered, "image_quality_score", "Quality Score", "score")}
      ${renderTrendChart(ordered, "catalogue_consistency_score", "Consistency Score", "score")}
      ${renderTrendChart(ordered, "performance_score", "Performance Score", "score")}
      ${renderTrendChart(ordered, "issue_count", "Issues Found", "count")}
      ${renderTrendChart(ordered, "resolved_issue_count", "Issues Resolved", "count")}
      ${renderTrendChart(ordered, "images_processed", "Images Processed", "count")}
      ${renderTrendChart(ordered, "estimated_manual_minutes_high", "Time Saved", "minutes")}
      ${renderTrendChart(ordered, "estimated_cost_saved_high", "Cost Saved Estimate", "currency")}
    </section>
    <section class="portal-card">
      <div class="portal-section-head"><div><h2>Category Insights</h2><p>Weakest categories and issue concentration from the latest full report.</p></div></div>
      ${renderCategoryInsights(latestReport?.category_scores || [])}
    </section>
  `;
}

function renderTrendChart(scans, key, title, type = "score") {
  if (!scans.length) return `<article class="chart-card"><h3>${escapeHtml(title)}</h3><p class="muted-note">No data yet.</p></article>`;
  const values = scans.map((scan) => numeric(scan[key]));
  const latest = values[values.length - 1] || 0;
  const max = type === "score" ? 100 : Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = scans.length === 1 ? 50 : (index / (scans.length - 1)) * 100;
    const y = 100 - Math.max(0, Math.min(100, (value / max) * 100));
    return `${x},${y}`;
  }).join(" ");
  return `
    <article class="chart-card">
      <div class="chart-head">
        <h3>${escapeHtml(title)}</h3>
        <strong>${formatChartValue(latest, type)}</strong>
      </div>
      ${scans.length > 1 ? `<svg class="trend-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" /></svg>` : `<div class="single-scan-chart"><span style="height:${Math.max(4, Math.min(100, (latest / max) * 100))}%"></span></div>`}
      <div class="chart-axis"><span>${escapeHtml(formatDate(scans[0]?.scan_completed_at || scans[0]?.created_at))}</span><span>${escapeHtml(formatDate(scans[scans.length - 1]?.scan_completed_at || scans[scans.length - 1]?.created_at))}</span></div>
    </article>
  `;
}

function renderCategoryInsights(categories) {
  if (!categories.length) {
    return `<p class="muted-note">Category insights will appear when the latest report includes category-level scoring.</p>`;
  }
  const weakest = categories.slice().sort((a, b) => numeric(a.health_score) - numeric(b.health_score)).slice(0, 5);
  const missingAlt = categories.filter((item) => String(item.top_issue_type || "").includes("alt")).slice(0, 5);
  const oversized = categories.filter((item) => String(item.top_issue_type || "").includes("oversized") || String(item.top_issue_type || "").includes("dimension")).slice(0, 5);
  const consistency = categories.filter((item) => String(item.top_issue_type || "").includes("consistent") || String(item.top_issue_type || "").includes("aspect")).slice(0, 5);
  return `
    <div class="category-insight-grid">
      ${categoryInsightList("Weakest categories", weakest)}
      ${categoryInsightList("Most improved categories", [])}
      ${categoryInsightList("Most missing alt text", missingAlt)}
      ${categoryInsightList("Most oversized images", oversized)}
      ${categoryInsightList("Most consistency issues", consistency)}
    </div>
  `;
}

function categoryInsightList(title, rows) {
  if (!rows.length) {
    return `<div class="category-insight-card"><h3>${escapeHtml(title)}</h3><p class="muted-note">${title === "Most improved categories" ? "Improvement ranking will appear after multiple category-scored scans." : "No category data for this issue yet."}</p></div>`;
  }
  return `
    <div class="category-insight-card">
      <h3>${escapeHtml(title)}</h3>
      ${rows.map((row) => `
        <div class="category-insight-row">
          <strong>${escapeHtml(row.category_name || "Uncategorised")}</strong>
          <span>${scoreText(row.health_score)}/100</span>
          <small>${escapeHtml(issueLabel(row.top_issue_type || ""))}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function formatChartValue(value, type) {
  if (type === "currency") return `$${formatNumber(value)}`;
  if (type === "minutes") return `${minutesToHours(value)} hrs`;
  if (type === "score") return `${scoreText(value)}/100`;
  return formatNumber(value);
}

function isThisMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

async function loadReports() {
  const root = document.getElementById("reports-root");
  if (!root) return;
  if (!token()) {
    root.innerHTML = portalShell("Product Image Health Reports", "Log in to view private catalogue image audit reports.", "reports", `
      <section class="portal-empty-state">
        <h2>Login required</h2>
        <p>Your reports are connected to your Optivra account and WooCommerce stores.</p>
        <a class="button primary" href="/login" data-link>Login</a>
      </section>
    `);
    return;
  }

  root.innerHTML = portalShell("Product Image Health Reports", "Loading your latest scan history and recommendations.", "reports", renderPortalLoading("Loading reports..."));
  const selectedScanId = new URLSearchParams(location.search).get("view") === "detail"
    ? sessionStorage.getItem("optivraSelectedReportId")
    : "";

  try {
    if (selectedScanId) {
      const report = await api(`/api/image-studio/audits/${encodeURIComponent(selectedScanId)}`);
      window.optivraCurrentReport = report;
      root.innerHTML = portalShell("Full Health Report", "Premium catalogue audit with recommendations, ROI, performance and safety insights.", "reports", renderHealthReportDetail(report));
      return;
    }

    const data = await api("/api/image-studio/audits?limit=50");
    root.innerHTML = portalShell("Product Image Health Reports", "Review scan history across your connected WooCommerce stores.", "reports", renderReportsList(data.scans || []));
  } catch (error) {
    root.innerHTML = portalShell("Product Image Health Reports", "Something stopped the report from loading.", "reports", `
      <section class="portal-empty-state error">
        <h2>Report unavailable</h2>
        <p>${escapeHtml(error.message)}</p>
        <button class="button primary" data-report-reload>Try again</button>
      </section>
    `);
  }
}

async function loadPortalRecommendations() {
  const root = document.getElementById("recommendations-root");
  if (!root) return;
  if (!token()) {
    root.innerHTML = portalShell("Recommendations", "Log in to view Product Image Health Report recommendations.", "recommendations", `
      <section class="portal-empty-state"><h2>Login required</h2><p>Recommendations are tied to your Optivra account and connected store.</p><a class="button primary" href="/login" data-link>Login</a></section>
    `);
    return;
  }

  root.innerHTML = portalShell("Recommendations", "Loading latest audit recommendations and queue actions.", "recommendations", renderPortalLoading("Loading recommendations..."));
  try {
    const latest = await api("/api/image-studio/audits?limit=1&status=completed");
    const scan = (latest.scans || [])[0];
    if (!scan) {
      root.innerHTML = portalShell("Recommendations", "Run a Product Image Health Report from WooCommerce to create recommendations.", "recommendations", `
        <section class="portal-empty-state"><h2>No recommendations yet</h2><p>Run a free Product Image Health Report from the WooCommerce plugin to generate prioritised fixes.</p><a class="button primary" href="/reports" data-link>Open reports</a></section>
      `);
      return;
    }

    const report = await api(`/api/image-studio/audits/${encodeURIComponent(scan.id)}`);
    window.optivraCurrentReport = report;
    const recommendations = report.recommendations || report.top_recommendations || [];
    root.innerHTML = portalShell("Recommendations", "Prioritised fixes from your latest Product Image Health Report.", "recommendations", `
      <section class="portal-card">
        <div class="portal-section-head">
          <div><h2>Latest Report Recommendations</h2><p>SEO-only jobs stay separate from AI image processing. Background and crop jobs default to preserve mode and require review.</p></div>
          <a class="button ghost" href="/reports" data-link>View full report</a>
        </div>
      </section>
      <section class="portal-section"><div class="recommendation-grid">${renderReportRecommendations(recommendations)}</div></section>
    `);
  } catch (error) {
    root.innerHTML = portalShell("Recommendations", "Something stopped recommendations from loading.", "recommendations", `
      <section class="portal-empty-state error"><h2>Recommendations unavailable</h2><p>${escapeHtml(error.message)}</p><button class="button primary" data-recommendations-reload>Try again</button></section>
    `);
  }
}

async function loadAuditQueuePage() {
  const root = document.getElementById("queue-root");
  if (!root) return;
  if (!token()) {
    root.innerHTML = portalShell("Queue", "Log in to view queued Product Image Health Report tasks.", "queue", `
      <section class="portal-empty-state"><h2>Login required</h2><p>Your queue is connected to your Optivra account and store.</p><a class="button primary" href="/login" data-link>Login</a></section>
    `);
    return;
  }

  root.innerHTML = portalShell("Queue", "Loading audit queue jobs.", "queue", renderPortalLoading("Loading queue..."));
  try {
    const data = await api("/api/image-studio/audit-queue?limit=100");
    root.innerHTML = portalShell("Queue", "Tasks created from Product Image Health Report issues and recommendations.", "queue", renderAuditQueueJobs(data.queue_jobs || []));
  } catch (error) {
    root.innerHTML = portalShell("Queue", "Something stopped the queue from loading.", "queue", `
      <section class="portal-empty-state error"><h2>Queue unavailable</h2><p>${escapeHtml(error.message)}</p><button class="button primary" data-queue-reload>Try again</button></section>
    `);
  }
}

function portalShell(title, subtitle, active, body) {
  return `
    <div class="portal-shell">
      ${renderPortalNav(active)}
      <div class="portal-workspace">
        <div class="portal-head">
          <div>
            <p class="eyebrow">Optivra Portal</p>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <div class="dashboard-actions">
            <a class="button ghost" href="/reports" data-link>Reports</a>
            <a class="button primary" href="/dashboard" data-link>Overview</a>
          </div>
        </div>
        ${renderImageStudioTabs(active)}
        ${body}
      </div>
    </div>
  `;
}

function renderPortalNav(active) {
  const items = [
    ["overview", "Overview", "/dashboard"],
    ["image_studio", "Image Studio", "/reports"],
    ["reports", "Reports", "/reports"],
    ["recommendations", "Recommendations", "/recommendations"],
    ["queue", "Queue", "/queue"],
    ["analytics", "Analytics", "/analytics"],
    ["backgrounds", "Backgrounds", "/backgrounds"],
    ["seo", "SEO Tools", "/seo-tools"],
    ["billing", "Billing", "/account/billing"],
    ["settings", "Settings", "/settings"],
    ["support", "Support", "/support"]
  ];
  return `
    <aside class="portal-sidebar" aria-label="Portal menu">
      <strong>Optivra</strong>
      <nav>${items.map(([key, label, href]) => `<a class="${key === active ? "active" : ""}" href="${href}" data-link>${label}</a>`).join("")}</nav>
    </aside>
  `;
}

function renderImageStudioTabs(active) {
  const tabs = [
    ["dashboard", "Dashboard", "/dashboard"],
    ["scan", "Product Scan", "/reports"],
    ["reports", "Health Report", "/reports"],
    ["recommendations", "Recommendations", "/recommendations"],
    ["queue", "Queue", "/queue"],
    ["before_after", "Before & After", "/queue"],
    ["backgrounds", "Backgrounds", "/backgrounds"],
    ["seo", "SEO", "/seo-tools"],
    ["settings", "Settings", "/settings"]
  ];
  return `<nav class="studio-tabs" aria-label="Image Studio">${tabs.map(([key, label, href]) => `<a class="${key === active ? "active" : ""}" href="${href}" data-link>${label}</a>`).join("")}</nav>`;
}

function renderPortalLoading(label) {
  return `<section class="portal-loading"><span></span>${escapeHtml(label)}</section>`;
}

function renderBillingContent() {
  return `
    <section class="portal-card">
      <div class="portal-section-head">
        <div>
          <h2>Plan and credit usage</h2>
          <p>Manage your Optivra Image Studio plan, monthly credits, top-ups and Stripe billing portal.</p>
        </div>
        <div class="dashboard-actions">
          <button class="button ghost" id="portal-button">Manage Billing</button>
        </div>
      </div>
      <div class="metric-card-grid">
        <div class="metric-tile"><span>Current plan</span><strong id="billing-plan">Loading...</strong></div>
        <div class="metric-tile"><span>Status</span><strong id="billing-status">-</strong></div>
        <div class="metric-tile"><span>Credits</span><strong id="billing-credits">-</strong></div>
        <div class="metric-tile"><span>Credits used</span><strong id="billing-used">-</strong></div>
        <div class="metric-tile"><span>Reset date</span><strong id="billing-reset">-</strong></div>
      </div>
      <div class="meter billing-meter"><div id="billing-meter"></div></div>
      <p class="muted-note">Billing is handled through Stripe. Saved API tokens are never displayed here.</p>
    </section>

    <section class="portal-card">
      <div class="portal-section-head">
        <div>
          <h2>Upgrade plan</h2>
          <p>Plans include platform access, reports, queue workflow, safety checks, review tools and image processing credits.</p>
        </div>
      </div>
      <div class="pricing-grid compact-pricing">
        <article class="price-card"><h2>Optivra Image Studio Starter</h2><strong>$19 USD/month</strong><p>20 credits monthly.</p><button data-plan="starter">Subscribe</button></article>
        <article class="price-card"><h2>Optivra Image Studio Growth</h2><strong>$69 USD/month</strong><p>100 credits monthly.</p><button data-plan="growth">Upgrade</button></article>
        <article class="price-card"><h2>Optivra Image Studio Pro</h2><strong>$159 USD/month</strong><p>500 credits monthly.</p><button data-plan="pro">Upgrade</button></article>
        <article class="price-card"><h2>Optivra Image Studio Agency</h2><strong>$429 USD/month</strong><p>1,500 credits monthly.</p><button data-plan="agency">Upgrade</button></article>
      </div>
    </section>

    <section class="portal-card" id="buy-credits">
      <div class="portal-section-head">
        <div>
          <h2>Buy Extra Credits</h2>
          <p>Use credit packs as top-ups when a catalogue batch needs more image processing capacity.</p>
        </div>
      </div>
      <p class="form-message" id="billing-message"></p>
      <div class="pricing-grid compact-pricing credit-pack-grid">
        <article class="price-card credit-pack-card"><p class="eyebrow">Optivra Image Studio Credits</p><h2>25 Credits</h2><strong>$10 USD</strong><p>Small top-up for a quick batch.</p><button class="button primary" data-pack="small">Buy Credits</button></article>
        <article class="price-card credit-pack-card featured"><p class="eyebrow">Optivra Image Studio Credits</p><h2>100 Credits</h2><strong>$35 USD</strong><p>Medium pack for a catalogue pass.</p><button class="button primary" data-pack="medium">Buy Credits</button></article>
        <article class="price-card credit-pack-card"><p class="eyebrow">Optivra Image Studio Credits</p><h2>300 Credits</h2><strong>$90 USD</strong><p>Large pack for growing stores.</p><button class="button primary" data-pack="large">Buy Credits</button></article>
        <article class="price-card credit-pack-card"><p class="eyebrow">Optivra Image Studio Credits</p><h2>1000 Credits</h2><strong>$250 USD</strong><p>Agency pack for high-volume work.</p><button class="button primary" data-pack="agency">Buy Credits</button></article>
      </div>
    </section>
  `;
}

function renderSupportContent() {
  return `
    <section class="portal-card">
      <div class="portal-section-head">
        <div>
          <h2>Get help with Image Studio</h2>
          <p>Optivra does not automatically replace product images unless your settings allow it. You can review outputs before publishing.</p>
        </div>
        <div class="dashboard-actions">
          <a class="button primary" href="/docs/ai-image-studio" data-link data-analytics="click_docs_getting_started">Read Image Studio docs</a>
          <a class="button ghost" href="mailto:support@optivra.app" data-analytics="click_support_contact">Contact support</a>
        </div>
      </div>
    </section>
    <section class="portal-card">
      <div class="portal-section-head"><div><h2>Common issues</h2><p>Include your store domain, plugin version, scan status and a short description when contacting support.</p></div></div>
      <div class="mini-card-grid">
        <div><strong>Scan not finding products</strong><p>Check WooCommerce product status, image permissions and plugin connection.</p></div>
        <div><strong>API token not connecting</strong><p>Reconnect Optivra and confirm the saved token is masked, present and current.</p></div>
        <div><strong>Image processing failed</strong><p>Review the safety status and failure reason before retrying.</p></div>
        <div><strong>Product changed in AI output</strong><p>Use Preserve Product or Smart Safe and keep review-before-replace enabled.</p></div>
        <div><strong>Credits after failed safety check</strong><p>Unsafe outputs should not auto-replace images; include the job status if you need billing help.</p></div>
        <div><strong>Debug export</strong><p>Enable debug mode only when requested, then share the safe debug bundle without tokens.</p></div>
      </div>
    </section>
    <section class="portal-card">
      <div class="portal-section-head">
        <div>
          <h2>Gateway Rules support</h2>
          <p>For checkout visibility issues, include WordPress, WooCommerce, PHP and plugin versions, active gateways, the rule, expected behaviour and actual behaviour.</p>
        </div>
        <div class="dashboard-actions">
          <a class="button ghost" href="/docs/payment-gateway-rules-for-woocommerce" data-link>Read Gateway Rules docs</a>
          <a class="button ghost" href="/payment-gateway-rules-for-woocommerce" data-link>Plugin overview</a>
        </div>
      </div>
    </section>
  `;
}

function renderReportsList(scans) {
  if (!scans.length) {
    return `
      <section class="portal-empty-state">
        <h2>No Product Image Health Reports yet</h2>
        <p>Run a free Product Image Health Report from the WooCommerce plugin to see scan history, scores, recommendations and ROI here.</p>
        <a class="button primary" href="/docs/ai-image-studio#product-scan" data-link>Read scan guide</a>
      </section>
    `;
  }

  return `
    <section class="portal-card">
      <div class="portal-section-head">
        <div>
          <h2>Image Health Reports</h2>
          <p>Scan history from connected WooCommerce stores.</p>
        </div>
        <span class="portal-count">${scans.length.toLocaleString()} scans</span>
      </div>
      <div class="portal-table-wrap">
        <table class="portal-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Store</th>
              <th>Products</th>
              <th>Images</th>
              <th>Health</th>
              <th>SEO</th>
              <th>Quality</th>
              <th>Consistency</th>
              <th>Issues</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${scans.map((scan) => `
              <tr>
                <td>${escapeHtml(formatDate(scan.scan_completed_at || scan.created_at))}</td>
                <td>${escapeHtml(scan.store_domain || "WooCommerce store")}</td>
                <td>${numberText(scan.products_scanned)}</td>
                <td>${numberText(scan.images_scanned)}</td>
                <td>${scorePill(scan.product_image_health_score)}</td>
                <td>${scorePill(scan.seo_score)}</td>
                <td>${scorePill(scan.image_quality_score)}</td>
                <td>${scorePill(scan.catalogue_consistency_score)}</td>
                <td>${numberText(scan.issue_count)}</td>
                <td>${statusBadge(scan.status)}</td>
                <td><button class="button ghost compact-button" data-report-open="${escapeHtml(scan.id)}">View Report</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHealthReportDetail(report) {
  const metrics = report.metrics || {};
  const scan = report.scan || {};
  const recommendations = report.recommendations || report.top_recommendations || [];
  const insights = report.insights || report.top_insights || [];
  const categories = report.category_scores || [];
  const topItems = report.top_items_needing_attention || [];
  const issueSummary = report.issue_summary || {};
  const issueTypes = issueSummary.by_issue_type || {};
  const minutesLow = numeric(metrics.estimated_manual_minutes_low);
  const minutesHigh = numeric(metrics.estimated_manual_minutes_high);
  const costLow = numeric(metrics.estimated_cost_saved_low);
  const costHigh = numeric(metrics.estimated_cost_saved_high);
  const priorityFixes = recommendations.filter((item) => ["critical", "high"].includes(String(item.priority || item.severity || ""))).length || recommendations.length;

  return `
    <section class="report-hero premium-report-hero">
      <div>
        <span class="status-badge ready">Report Ready</span>
        <h2>Your Product Image Health Report is ready</h2>
        <p>Optivra scanned your WooCommerce catalogue and found opportunities to improve image SEO, page speed, visual consistency, and product presentation.</p>
      </div>
      <div class="report-hero-score">
        <span>Product Image Health Score</span>
        <strong>${scoreText(metrics.product_image_health_score)}</strong>
      </div>
    </section>

    <section class="report-score-grid">
      ${reportHeroCard("Image SEO Score", metrics.seo_score)}
      ${reportHeroCard("Image Quality Score", metrics.image_quality_score)}
      ${reportHeroCard("Catalogue Consistency Score", metrics.catalogue_consistency_score)}
      ${reportHeroCard("Performance Score", metrics.performance_score)}
      ${reportHeroCard("Product Feed Readiness", metrics.google_shopping_readiness_score)}
      ${reportHeroCard("Estimated Time Saved", `${minutesToHours(minutesLow)}-${minutesToHours(minutesHigh)} hrs`, "time")}
      ${reportHeroCard("Priority Fixes Found", priorityFixes, "count")}
      ${reportHeroCard("Images Scanned", scan.images_scanned, "count")}
    </section>

    <section class="portal-card">
      <div class="portal-section-head">
        <div>
          <h2>Executive Summary</h2>
          <p>${escapeHtml(buildExecutiveSummary(report))}</p>
        </div>
        <button class="button ghost" data-report-export>Export JSON</button>
      </div>
    </section>

    <section class="portal-section">
      <h2>What Optivra Found</h2>
      <div class="insight-grid">${renderInsightCards(insights, metrics)}</div>
    </section>

    <section class="portal-card">
      <div class="portal-section-head"><div><h2>What is holding your score back</h2><p>Ranked by issue volume from the latest scan.</p></div></div>
      <div class="issue-rank-list">${renderIssueRanks(issueTypes)}</div>
    </section>

    <section class="portal-section">
      <h2>Recommended Fixes</h2>
      <div class="recommendation-grid">${renderReportRecommendations(recommendations)}</div>
    </section>

    <section class="portal-card">
      <div class="portal-section-head"><div><h2>Category Breakdown</h2><p>Weakest categories and the improvements likely to matter most.</p></div></div>
      ${renderCategoryBreakdown(categories)}
    </section>

    <section class="portal-card">
      <div class="portal-section-head"><div><h2>Top Images Needing Attention</h2><p>Images with the highest issue severity or review priority.</p></div></div>
      ${renderTopImages(topItems)}
    </section>

    <section class="report-two-column">
      <section class="portal-card">
        <h2>ROI Estimate</h2>
        <div class="roi-grid">
          ${metricTile("Manual hours", `${minutesToHours(minutesLow)}-${minutesToHours(minutesHigh)}`)}
          ${metricTile("Cost saved", `$${formatNumber(costLow)}-$${formatNumber(costHigh)}`)}
          ${metricTile("Hourly rate", `$${formatNumber(metrics.hourly_rate_used || 40)}/hr`)}
        </div>
        <div class="work-breakdown">
          ${metricTile("SEO metadata", formatNumber(metrics.missing_alt_text_count + metrics.weak_alt_text_count))}
          ${metricTile("Optimisation", formatNumber(metrics.oversized_image_count + metrics.huge_dimension_image_count + metrics.missing_webp_count))}
          ${metricTile("Image review", formatNumber(issueSummary.total || 0))}
        </div>
      </section>
      <section class="portal-card">
        <h2>Performance Opportunity</h2>
        <div class="roi-grid">
          ${metricTile("Total image weight", formatBytes(metrics.total_original_bytes))}
          ${metricTile("Estimated optimised", formatBytes(metrics.estimated_optimised_bytes))}
          ${metricTile("Reduction range", `${scoreText(metrics.estimated_reduction_percent_low)}-${scoreText(metrics.estimated_reduction_percent_high)}%`)}
        </div>
        <p class="muted-note">Largest offenders are surfaced in the image table when file-size metadata is available from WooCommerce.</p>
      </section>
    </section>

    <section class="portal-card">
      <div class="portal-section-head"><div><h2>Processing Safety Insights</h2><p>Shown when this report includes processed-image safety data.</p></div></div>
      <div class="safety-grid">
        ${metricTile("Pixel drift warnings", metrics.product_pixel_drift_warning_count)}
        ${metricTile("Low foreground confidence", metrics.low_foreground_confidence_count)}
        ${metricTile("Failed integrity checks", metrics.failed_integrity_check_count)}
        ${metricTile("Safety failures not charged", metrics.failed_safety_checks_not_charged)}
        ${metricTile("Approved images", metrics.images_approved)}
        ${metricTile("Rejected images", metrics.images_rejected)}
      </div>
    </section>

    <section class="portal-card">
      <div class="portal-section-head">
        <div>
          <h2>Export and Share</h2>
          <p>JSON export is available now. PDF and email share controls are prepared for a later release.</p>
        </div>
        <div class="dashboard-actions">
          <button class="button primary" data-report-export>Export JSON</button>
          <button class="button ghost" disabled>PDF coming soon</button>
          <button class="button ghost" disabled>Email coming soon</button>
        </div>
      </div>
    </section>

    <div class="dashboard-actions report-footer-actions">
      <button class="button ghost" data-report-back>Back to scan history</button>
      <a class="button primary" href="/recommendations" data-link>Open Recommendations</a>
    </div>
  `;
}

function buildExecutiveSummary(report) {
  const metrics = report.metrics || {};
  const issueSummary = report.issue_summary || {};
  const health = scoreText(metrics.product_image_health_score);
  const seo = scoreText(metrics.seo_score);
  const performance = scoreText(metrics.performance_score);
  const issues = numeric(issueSummary.total);
  const minutesLow = numeric(metrics.estimated_manual_minutes_low);
  const minutesHigh = numeric(metrics.estimated_manual_minutes_high);
  return `Your catalogue scored ${health}/100 overall, with SEO at ${seo}/100 and performance at ${performance}/100. Optivra found ${formatNumber(issues)} improvement opportunities and estimates that resolving them manually would take about ${minutesToHours(minutesLow)}-${minutesToHours(minutesHigh)} hours. Start with high-priority main-image and SEO issues, then standardise file size, crop, background and feed-readiness fixes.`;
}

function reportHeroCard(label, value, type = "score") {
  return `
    <article class="report-score-card">
      <span>${escapeHtml(label)}</span>
      <strong>${type === "score" ? scoreText(value) : escapeHtml(formatNumber(value))}</strong>
    </article>
  `;
}

function renderInsightCards(insights, metrics) {
  const fallback = [
    ["SEO", `Missing or weak alt text: ${formatNumber(metrics.missing_alt_text_count + metrics.weak_alt_text_count)} images.`, "high"],
    ["Quality", `Images needing quality review: ${formatNumber(metrics.low_resolution_count + metrics.likely_blurry_count + metrics.low_contrast_count)}.`, "medium"],
    ["Consistency", `Aspect ratio and background consistency should be reviewed before large catalogue campaigns.`, "medium"],
    ["Performance", `Oversized image opportunities: ${formatNumber(metrics.oversized_image_count + metrics.huge_dimension_image_count)}.`, "high"],
    ["Completeness", `Products without main images: ${formatNumber(metrics.products_without_main_image || 0)}.`, "critical"],
    ["Product feed readiness", `Google/product feed readiness is an estimate, not a compliance guarantee.`, "info"],
    ["ROI", `Estimated manual work: ${minutesToHours(metrics.estimated_manual_minutes_low)}-${minutesToHours(metrics.estimated_manual_minutes_high)} hours.`, "info"]
  ];
  const rows = insights.length ? insights.map((item) => [item.title || "Catalogue insight", item.body || item.description || "", item.severity || "info"]) : fallback;
  return rows.map(([title, body, severity]) => `
    <article class="insight-card ${severityClass(severity)}">
      <span>${escapeHtml(String(severity || "info"))}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `).join("");
}

function renderIssueRanks(issueTypes) {
  const rows = Object.entries(issueTypes)
    .map(([type, count]) => [type, numeric(count)])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (!rows.length) return `<p class="muted-note">No issue summary is available for this report.</p>`;
  return rows.map(([type, count], index) => `
    <div class="issue-rank-row">
      <span>${index + 1}</span>
      <strong>${escapeHtml(issueLabel(type))}</strong>
      <em>${formatNumber(count)} affected</em>
    </div>
  `).join("");
}

function renderReportRecommendations(recommendations) {
  if (!recommendations.length) {
    return `<section class="portal-empty-state compact-empty"><h2>No recommendations available</h2><p>Run a fresh scan after audit recommendations are enabled for this store.</p></section>`;
  }
  return recommendations.map((item) => `
    <article class="recommendation-card">
      <div class="recommendation-topline">
        ${priorityBadge(item.priority || item.severity || "medium")}
        <span class="action-pill">${escapeHtml(actionLabel(item.action_type))}</span>
      </div>
      <h3>${escapeHtml(item.title || "Recommended fix")}</h3>
      <p>${escapeHtml(item.description || item.body || "")}</p>
      <div class="recommendation-metrics">
        ${metricTile("Issues", item.estimated_images_affected || item.images_affected || 0)}
        ${metricTile("Time saved", `${numeric(item.estimated_minutes_saved_low)}-${numeric(item.estimated_minutes_saved_high)} min`)}
        ${metricTile("Impact", priorityImpact(item.priority || item.severity))}
      </div>
      <div class="dashboard-actions">
        <button class="button primary" data-report-queue-recommendation="${escapeHtml(item.id || "")}" ${item.id ? "" : "disabled"}>Add to Queue</button>
        <button class="button ghost" data-report-review>Review</button>
      </div>
    </article>
  `).join("");
}

function renderAuditQueueJobs(queueJobs) {
  if (!queueJobs.length) {
    return `
      <section class="portal-empty-state">
        <h2>No audit tasks queued yet</h2>
        <p>Add recommended fixes from a Health Report. SEO-only jobs, optimisation jobs, preserve-mode image jobs, and manual review tasks will appear here.</p>
        <a class="button primary" href="/recommendations" data-link>Open Recommendations</a>
      </section>
    `;
  }

  return `
    <section class="portal-card">
      <div class="portal-section-head">
        <div>
          <h2>Product Image Health Report Queue</h2>
          <p>Every task keeps its audit source, action type and safety policy. Image-processing jobs are preserve-mode and require review before replacement.</p>
        </div>
        <span class="portal-count">${queueJobs.length.toLocaleString()} queued tasks</span>
      </div>
      <div class="portal-table-wrap">
        <table class="portal-table">
          <thead><tr><th>Task</th><th>Action</th><th>Kind</th><th>Priority</th><th>Status</th><th>Safety</th><th>Source</th></tr></thead>
          <tbody>
            ${queueJobs.map((job) => `
              <tr>
                <td>
                  <strong>${escapeHtml(job.issue_title || job.recommendation_title || "Audit report task")}</strong>
                  <small>${escapeHtml(job.product_id ? `Product ${job.product_id}` : "Catalogue-level task")}</small>
                </td>
                <td>${escapeHtml(actionLabel(job.action_type))}</td>
                <td>${escapeHtml(String(job.job_kind || "review").replaceAll("_", " "))}</td>
                <td>${priorityBadge(job.priority || "medium")}</td>
                <td>${statusBadge(job.status || "queued")}</td>
                <td>${job.requires_review ? "Review required" : "Automatic"}${job.consumes_credit_when_processed ? " · credit on safe completion" : " · no image credit"}</td>
                <td><span class="action-pill">Health Report</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCategoryBreakdown(categories) {
  if (!categories.length) return `<p class="muted-note">Category scoring is not available for this report yet.</p>`;
  return `
    <div class="portal-table-wrap">
      <table class="portal-table">
        <thead><tr><th>Category</th><th>Health</th><th>SEO</th><th>Quality</th><th>Consistency</th><th>Performance</th><th>Priority</th><th>Top issue</th><th>Action</th></tr></thead>
        <tbody>
          ${categories.slice(0, 30).map((category) => `
            <tr>
              <td>${escapeHtml(category.category_name || "Uncategorised")}</td>
              <td>${scorePill(category.health_score)}</td>
              <td>${scorePill(category.seo_score)}</td>
              <td>${scorePill(category.quality_score)}</td>
              <td>${scorePill(category.consistency_score)}</td>
              <td>${scorePill(category.performance_score)}</td>
              <td>${priorityBadge(category.priority || "medium")}</td>
              <td>${escapeHtml(issueLabel(category.top_issue_type || ""))}</td>
              <td><button class="button ghost compact-button" data-report-review>Review</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTopImages(items) {
  if (!items.length) return `<p class="muted-note">No item-level issues are available for this report.</p>`;
  return `
    <div class="attention-grid">
      ${items.slice(0, 12).map((item) => `
        <article class="attention-card">
          <img src="${escapeHtml(item.image_url || "")}" alt="" loading="lazy" />
          <div>
            <h3>${escapeHtml(item.product_name || "Product image")}</h3>
            <div class="badge-row">
              ${priorityBadge(item.highest_severity || "medium")}
              <span class="action-pill">${formatNumber(item.issue_count)} issues</span>
              <span class="action-pill">${escapeHtml(imageRoleLabel(item.image_role))}</span>
            </div>
            <p>${escapeHtml(item.recommended_action || "Review this image before processing.")}</p>
            <div class="dashboard-actions">
              <button class="button primary" data-report-queue-item>Queue</button>
              <button class="button ghost" data-report-ignore-item>Ignore</button>
              ${item.product_url ? `<a class="button ghost" href="${escapeHtml(item.product_url)}" target="_blank" rel="noopener noreferrer">View product</a>` : ""}
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function sanitizeHealthReportExport(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeHealthReportExport(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const hiddenKeys = new Set([
    "id",
    "store_id",
    "scan_id",
    "audit_item_id",
    "recommendation_id",
    "issue_id",
    "user_id",
    "connected_store_id",
    "metadata",
    "debug",
    "debug_json",
    "validation_json",
    "preserve_debug",
    "raw",
    "sha",
    "checksum",
    "token",
    "api_token"
  ]);

  return Object.entries(value).reduce((clean, [key, item]) => {
    const normalized = String(key).toLowerCase();
    if (
      hiddenKeys.has(normalized) ||
      normalized.endsWith("_id") ||
      normalized.includes("token") ||
      normalized.includes("secret")
    ) {
      return clean;
    }
    clean[key] = sanitizeHealthReportExport(item);
    return clean;
  }, {});
}

function metricTile(label, value) {
  return `<div class="metric-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatNumber(value))}</strong></div>`;
}

function scorePill(value) {
  const score = numeric(value);
  const tone = score >= 80 ? "good" : score >= 60 ? "warn" : "bad";
  return `<span class="score-pill ${tone}">${scoreText(value)}</span>`;
}

function priorityBadge(value) {
  const normalized = severityClass(value || "medium");
  return `<span class="priority-badge ${normalized}">${escapeHtml(String(value || "medium").replaceAll("_", " "))}</span>`;
}

function statusBadge(value) {
  const status = String(value || "unknown").toLowerCase();
  return `<span class="status-badge ${escapeHtml(status)}">${escapeHtml(status.replaceAll("_", " "))}</span>`;
}

function safetyBadge(value) {
  const status = String(value || "not_assessed").toLowerCase();
  const labels = {
    passed: "Passed",
    needs_review: "Needs Review",
    failed: "Failed",
    not_assessed: "Not Assessed"
  };
  const tone = ["passed", "needs_review", "failed", "not_assessed"].includes(status) ? status : "not_assessed";
  return `<span class="status-badge safety-${escapeHtml(tone)}">${escapeHtml(labels[tone] || labels.not_assessed)}</span>`;
}

function formatProcessingMode(value) {
  return value ? String(value).replaceAll("_", " ") : "Not stored";
}

function severityClass(value) {
  const normalized = String(value || "info").toLowerCase();
  return ["critical", "high", "medium", "low", "info"].includes(normalized) ? normalized : "info";
}

function priorityImpact(value) {
  const severity = severityClass(value);
  if (severity === "critical") return "Blocking";
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}

function issueLabel(type) {
  const labels = {
    missing_main_image: "Products missing images",
    product_has_single_image: "Products with a single image",
    missing_alt_text: "Missing alt text",
    weak_alt_text: "Weak alt text",
    generic_filename: "Generic filenames",
    duplicate_filename: "Duplicate filenames",
    oversized_file: "Oversized files",
    huge_dimensions: "Huge dimensions",
    missing_webp: "WebP opportunities",
    cluttered_background: "Cluttered backgrounds",
    inconsistent_background: "Inconsistent backgrounds",
    low_contrast: "Low contrast",
    poor_centering: "Poor centering",
    too_small_in_frame: "Too small in frame",
    too_tightly_cropped: "Too tightly cropped",
    low_resolution: "Low resolution",
    likely_blurry: "Likely blurry",
    over_dark: "Too dark",
    over_bright: "Too bright",
    watermark_or_text_overlay: "Watermark or text overlay",
    inconsistent_aspect_ratio: "Inconsistent aspect ratios",
    google_readiness_warning: "Product feed readiness warnings"
  };
  return labels[type] || String(type || "No top issue").replaceAll("_", " ");
}

function actionLabel(type) {
  const labels = {
    generate_alt_text: "Generate alt text",
    optimise_image: "Optimise image",
    optimize_image: "Optimise image",
    replace_background: "Replace background",
    standardise_background: "Standardise background",
    resize_crop: "Resize or crop",
    convert_webp: "Convert WebP",
    review_manually: "Review manually",
    add_main_image: "Add main image",
    fix_alt_text: "Generate alt text",
    seo_update: "SEO metadata",
    compress_image: "Optimise image",
    preserve_background_replace: "Replace background",
    standard_background_replace: "Standardise background",
    manual_review: "Review manually",
    replace_main_image: "Add main image"
  };
  return labels[type] || "Review manually";
}

function imageRoleLabel(role) {
  const labels = { main: "Main image", gallery: "Gallery", variation: "Variation", category_thumbnail: "Category thumbnail", unknown: "Unknown" };
  return labels[role] || String(role || "Unknown").replaceAll("_", " ");
}

function numeric(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function scoreText(value) {
  return Math.round(numeric(value)).toLocaleString();
}

function numberText(value) {
  return formatNumber(value);
}

function formatNumber(value) {
  if (typeof value === "string" && value.includes("-")) return value;
  const number = numeric(value);
  return Number.isInteger(number) ? number.toLocaleString() : number.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function minutesToHours(value) {
  return (numeric(value) / 60).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatBytes(value) {
  const bytes = numeric(value);
  if (bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toLocaleString(undefined, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

const brandPresetStorageKey = "optivra_brand_style_presets_v1";

function defaultBrandStylePresets() {
  return [
    {
      id: "optivra-light",
      name: "Optivra light studio",
      backgroundType: "optivra-light",
      aspectRatio: "1:1",
      productPadding: "balanced",
      shadow: "subtle",
      outputFormat: "original",
      applyScope: "all",
      categories: []
    },
    {
      id: "feed-white",
      name: "Feed-safe white",
      backgroundType: "white",
      aspectRatio: "1:1",
      productPadding: "balanced",
      shadow: "none",
      outputFormat: "webp",
      applyScope: "all",
      categories: []
    }
  ];
}

function getBrandStylePresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(brandPresetStorageKey) || "[]");
    return Array.isArray(parsed) && parsed.length ? parsed : defaultBrandStylePresets();
  } catch {
    return defaultBrandStylePresets();
  }
}

function saveBrandStylePresets(presets) {
  localStorage.setItem(brandPresetStorageKey, JSON.stringify(presets));
}

function brandPresetWarnings(preset) {
  const warnings = [];
  if (preset.backgroundType === "custom") {
    warnings.push("This background may reduce product contrast for some products.");
    warnings.push("Review custom backgrounds for dark areas, busy texture, text, logos, or product-feed suitability before using them in bulk.");
  }
  if (preset.backgroundType === "transparent") {
    warnings.push("Transparent output is useful for design workflows but may not be suitable for every product-feed style image.");
  }
  if (preset.backgroundType === "soft-grey") {
    warnings.push("Soft grey is usually safe, but dark products should still be reviewed for edge contrast.");
  }
  return warnings;
}

function brandBackgroundLabel(value) {
  return {
    "optivra-light": "Default Optivra light",
    white: "White",
    "soft-grey": "Soft grey",
    custom: "Custom uploaded image",
    transparent: "Transparent"
  }[value] || "Default Optivra light";
}

function loadBackgroundsPage() {
  const root = document.getElementById("backgrounds-root");
  if (!root) return;
  const presets = getBrandStylePresets();
  root.innerHTML = portalShell("Brand Style Presets", "Keep product image backgrounds, padding, ratios and shadows consistent by store or product category.", "backgrounds", `
    <section class="portal-report-hero brand-style-hero">
      <div>
        <p class="eyebrow">Backgrounds</p>
        <h2>Brand style presets for cleaner catalogue consistency</h2>
        <p>Define feed-safe image styles, preview them with a sample product, and save category assignments for future processing and report recommendations.</p>
      </div>
      <div class="hero-score-card">
        <span>Saved presets</span>
        <strong>${escapeHtml(presets.length)}</strong>
        <small>Local workspace settings</small>
      </div>
    </section>
    <section class="brand-preset-grid">
      ${presets.map(renderBrandPresetCard).join("")}
    </section>
    <section class="portal-card brand-preset-builder">
      <div class="section-heading"><h2>Create Brand Style Preset</h2><p>Use conservative ecommerce defaults. Custom upload analysis is intentionally cautious until full visual scoring is available.</p></div>
      <form id="brand-style-form" class="brand-style-form">
        <input type="hidden" name="id" value="" />
        <label>Preset name<input name="name" required placeholder="Main catalogue style" /></label>
        <label>Background type<select name="backgroundType">
          <option value="optivra-light">Default Optivra light</option>
          <option value="white">White</option>
          <option value="soft-grey">Soft grey</option>
          <option value="custom">Custom uploaded image</option>
          <option value="transparent">Transparent</option>
        </select></label>
        <label>Preferred aspect ratio<select name="aspectRatio">
          <option value="1:1">Square 1:1</option>
          <option value="4:5">Portrait 4:5</option>
          <option value="3:4">Portrait 3:4</option>
          <option value="original">Original</option>
        </select></label>
        <label>Product padding<select name="productPadding">
          <option value="tight">Tight</option>
          <option value="balanced" selected>Balanced</option>
          <option value="generous">Generous</option>
        </select></label>
        <label>Shadow<select name="shadow">
          <option value="none">None</option>
          <option value="subtle" selected>Subtle</option>
          <option value="medium">Medium</option>
        </select></label>
        <label>Output format<select name="outputFormat">
          <option value="original">Original</option>
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP if supported</option>
        </select></label>
        <label>Apply to<select name="applyScope">
          <option value="all">All products</option>
          <option value="categories">Selected categories</option>
        </select></label>
        <label>Selected categories<input name="categories" placeholder="Shoes, Bags, Accessories" /></label>
        <div class="brand-warning-panel" data-brand-warning>Choose a clean light background for best product-feed readiness.</div>
        <div class="dashboard-actions"><button class="button primary" type="submit">Save Preset</button><button class="button ghost" type="button" data-brand-reset>Reset demo presets</button></div>
      </form>
    </section>
  `);
}

function renderBrandPresetCard(preset) {
  const warnings = brandPresetWarnings(preset);
  const categories = preset.applyScope === "categories" && preset.categories?.length ? preset.categories.join(", ") : "All products";
  return `
    <article class="portal-card brand-preset-card">
      <div class="card-topline"><div><h3>${escapeHtml(preset.name)}</h3><p>${escapeHtml(categories)}</p></div><span class="status-badge ready">Ready</span></div>
      <div class="brand-style-preview is-${escapeHtml(preset.backgroundType)}"><div class="sample-product"></div></div>
      <div class="brand-preset-meta">
        <span>${escapeHtml(brandBackgroundLabel(preset.backgroundType))}</span>
        <span>${escapeHtml(preset.aspectRatio)}</span>
        <span>${escapeHtml(preset.productPadding)}</span>
        <span>${escapeHtml(preset.shadow)}</span>
        <span>${escapeHtml(preset.outputFormat)}</span>
      </div>
      ${warnings.length ? `<div class="brand-warning-list">${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</div>` : ""}
      <div class="dashboard-actions"><button class="button ghost" data-brand-edit="${escapeHtml(preset.id)}">Edit</button><button class="button ghost" data-brand-delete="${escapeHtml(preset.id)}">Delete</button></div>
    </article>
  `;
}

async function loadSettingsPage() {
  const root = document.getElementById("settings-root") || document.querySelector('[data-page="/settings"] .portal-placeholder-root');
  if (!root) return;
  if (!token()) {
    root.innerHTML = portalShell("Image Studio Settings", "Log in to manage scan scheduling and recurring report settings.", "settings", `
      <section class="portal-empty-state"><h2>Login required</h2><p>Scheduled scans are connected to your Optivra account and WooCommerce stores.</p><a class="button primary" href="/login" data-link>Login</a></section>
    `);
    return;
  }

  root.innerHTML = portalShell("Image Studio Settings", "Manage recurring Product Image Health scans and monthly report groundwork.", "settings", renderPortalLoading("Loading settings..."));
  try {
    const account = await api("/account/dashboard");
    const sites = Array.isArray(account.connected_sites) ? account.connected_sites : [];
    const store = sites[0] || null;
    let schedule = null;
    let monthly = null;
    if (store?.id) {
      const [schedulePayload, monthlyPayload] = await Promise.all([
        api(`/api/image-studio/audit-schedule?store_id=${encodeURIComponent(store.id)}`).catch(() => ({ schedule: null })),
        api(`/api/image-studio/monthly-report/latest?store_id=${encodeURIComponent(store.id)}`).catch(() => ({ monthly_report: null, summary: null }))
      ]);
      schedule = schedulePayload.schedule || null;
      monthly = monthlyPayload.monthly_report || monthlyPayload.summary || null;
    }

    root.innerHTML = portalShell("Image Studio Settings", "Manage recurring Product Image Health scans and monthly report groundwork.", "settings", `
      ${store ? "" : renderStoreConnectionPanel(account)}
      <section class="portal-card">
        <div class="portal-section-head"><div><h2>Scheduled Product Image Health scans</h2><p>The backend stores schedule intent. The WooCommerce plugin executes the scan via WP-Cron because it has direct product and media access.</p></div><span class="status-badge ${schedule?.frequency && schedule.frequency !== "off" ? "ready" : "needs-review"}">${escapeHtml(schedule?.frequency || "off")}</span></div>
        ${store ? `
          <form id="audit-schedule-form" class="brand-style-form">
            <input type="hidden" name="store_id" value="${escapeHtml(store.id)}" />
            <label>Store<input value="${escapeHtml(store.domain || store.id)}" disabled /></label>
            <label>Frequency<select name="frequency">
              <option value="off" ${schedule?.frequency === "off" || !schedule ? "selected" : ""}>Off</option>
              <option value="weekly" ${schedule?.frequency === "weekly" ? "selected" : ""}>Weekly</option>
              <option value="monthly" ${schedule?.frequency === "monthly" ? "selected" : ""}>Monthly</option>
            </select></label>
            <label>Scan mode<select name="scan_mode">
              <option value="updated" ${schedule?.scan_mode !== "full" ? "selected" : ""}>Scan new/updated products only</option>
              <option value="full" ${schedule?.scan_mode === "full" ? "selected" : ""}>Full catalogue scan</option>
            </select></label>
            <label>Email report<select name="email_report">
              <option value="false" ${schedule?.email_report ? "" : "selected"}>No</option>
              <option value="true" ${schedule?.email_report ? "selected" : ""}>Yes</option>
            </select></label>
            <label>Monthly report summary<select name="monthly_report_enabled">
              <option value="true" ${schedule?.monthly_report_enabled !== false ? "selected" : ""}>Enabled</option>
              <option value="false" ${schedule?.monthly_report_enabled === false ? "selected" : ""}>Disabled</option>
            </select></label>
            <div class="brand-warning-panel">Plugin support required: recurring scans run from WooCommerce admin load or WP-Cron. The backend will not try to scrape private product data.</div>
            <div class="dashboard-actions"><button class="button primary" type="submit">Save Schedule</button><a class="button ghost" href="/reports" data-link>View Reports</a></div>
          </form>
        ` : `<section class="portal-empty-state"><h2>Connect a store first</h2><p>Generate a Site API Token and connect the WooCommerce plugin before enabling scheduled scans.</p></section>`}
      </section>
      <section class="portal-card">
        <div class="portal-section-head"><div><h2>Monthly report groundwork</h2><p>Prepared summary fields for recurring value reporting. Email delivery can be connected later without changing scan data.</p></div></div>
        ${monthly ? `
          <div class="metric-card-grid">
            ${metricTile("Previous score", monthly.previous_health_score ?? monthly.previous_score ?? "-")}
            ${metricTile("Current score", monthly.current_health_score ?? monthly.current_score ?? "-")}
            ${metricTile("Score improvement", monthly.score_improvement ?? 0)}
            ${metricTile("Issues found", monthly.issues_found ?? 0)}
            ${metricTile("Issues resolved", monthly.issues_resolved ?? 0)}
            ${metricTile("Images processed", monthly.images_processed ?? 0)}
          </div>
        ` : `<p class="muted-note">Monthly summaries will appear after completed scheduled scans.</p>`}
      </section>
    `);
  } catch (error) {
    root.innerHTML = portalShell("Image Studio Settings", "Manage recurring Product Image Health scans and monthly report groundwork.", "settings", `
      <section class="portal-empty-state"><h2>Settings could not load</h2><p>${escapeHtml(error.message)}</p></section>
    `);
  }
}

function renderPortalPlaceholder(path) {
  const titles = {
    "/recommendations": "Recommendations",
    "/queue": "Queue",
    "/analytics": "Analytics",
    "/backgrounds": "Backgrounds",
    "/seo-tools": "SEO Tools",
    "/settings": "Settings"
  };
  const active = path === "/seo-tools" ? "seo" : path.replace("/", "");
  const root = document.getElementById(`${active.replace("-", "_")}-root`) || document.querySelector(`[data-page="${path}"] .portal-placeholder-root`);
  if (!root) return;
  root.innerHTML = portalShell(titles[path] || "Portal", "This workspace is connected to the Product Image Health Report experience.", active, `
    <section class="portal-empty-state">
      <h2>${escapeHtml(titles[path] || "Workspace")} is being expanded</h2>
      <p>The premium report is available now. This workspace will become the focused operational view for the same backend report and queue data.</p>
      <a class="button primary" href="/reports" data-link>Open Health Reports</a>
    </section>
  `);
}

async function loadBilling() {
  const page = document.querySelector('[data-page="/account/billing"]');
  if (!token()) {
    if (page) {
      page.innerHTML = `
        <div class="page-band prose">
          <p class="eyebrow">Billing</p>
          <h1>Login required</h1>
          <p>Log in to manage your Optivra Image Studio plan, credits and billing portal.</p>
          <a class="button primary" href="/login" data-link>Login</a>
        </div>
      `;
    } else {
      setText("billing-plan", "Login required");
    }
    return;
  }

  if (page) {
    page.innerHTML = portalShell("Billing & Credits", "Manage your Optivra Image Studio plan, credits and Stripe billing portal.", "billing", renderBillingContent());
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

function loadSupportPage() {
  const page = document.querySelector('[data-page="/support"]');
  if (!page) return;

  if (token()) {
    page.innerHTML = portalShell("Support", "Get help with Image Studio, Gateway Rules, billing, setup and product image processing.", "support", renderSupportContent());
    return;
  }

  page.innerHTML = `
    <div class="page-band prose">
      <p class="eyebrow">Support</p>
      <h1>Get help with Optivra</h1>
      <p class="lead">Optivra does not automatically replace product images unless your settings allow it. You can review outputs before publishing.</p>
      ${renderSupportContent()}
    </div>
  `;
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
    closeHeaderAccountMenu();
    updateAdminVisibility();
    updateAuthActions();
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
  updateAuthActions();
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
  const url = new URL(location.href);
  const requestedPlugin = url.searchParams.get("plugin");
  if (url.searchParams.get("download") === "1" && requestedPlugin) {
    window.setTimeout(() => openPluginDownloadModal(requestedPlugin), 50);
  }
}

function pluginReleaseBySlug(slug) {
  return slug === "optivra-gateway-rules" ? gatewayRulesRelease : pluginRelease;
}

function openPluginDownloadModal(slug = "optivra-image-studio", target = null) {
  const modal = document.getElementById("plugin-download-modal");
  const form = document.getElementById("plugin-download-form");
  const success = document.getElementById("plugin-download-success");
  const message = document.getElementById("plugin-download-message");
  const hidden = document.getElementById("download-plugin-slug");
  const title = document.getElementById("download-modal-title");
  const emailInput = form?.querySelector("input[name='email']");
  const normalized = pluginFromTarget({ dataset: { pluginDownload: slug }, getAttribute: () => "" });
  const release = pluginReleaseBySlug(normalized);
  if (!modal || !form || !hidden) return;
  hidden.value = normalized;
  if (title) title.textContent = `Get ${release.name}`;
  if (message) message.textContent = "";
  if (success) success.hidden = true;
  form.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("download-modal-open");
  window.setTimeout(() => {
    emailInput?.focus({ preventScroll: true });
  }, 0);
  const params = { ...(target ? downloadParamsForTarget(target) : { plugin_slug: normalized, plugin_version: release.version, download_type: "zip", gated: true }), plugin_slug: normalized };
  trackEvent("plugin_download_click", params);
  trackEvent("plugin_download_modal_open", params);
}

function closePluginDownloadModal() {
  const modal = document.getElementById("plugin-download-modal");
  if (modal) modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("download-modal-open");
}

function currentCampaignParams() {
  const attribution = attributionState(location.pathname);
  return {
    utm_source: attribution.lastTouch?.source || "",
    utm_medium: attribution.lastTouch?.medium || "",
    utm_campaign: attribution.lastTouch?.campaign || "",
    utm_content: attribution.lastTouch?.content || "",
    utm_term: attribution.lastTouch?.term || ""
  };
}

document.querySelectorAll("[data-download-close]").forEach((node) => {
  node.addEventListener("click", closePluginDownloadModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const modal = document.getElementById("plugin-download-modal");
  if (!modal || modal.getAttribute("aria-hidden") === "true") return;
  closePluginDownloadModal();
});

document.getElementById("plugin-download-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const button = form.querySelector("button[type='submit']");
  const message = document.getElementById("plugin-download-message");
  const pluginSlug = String(formData.get("plugin_slug") || "optivra-image-studio");
  const release = pluginReleaseBySlug(pluginSlug);
  const originalText = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Preparing download...";
    }
    if (message) message.textContent = "";
    trackEvent("plugin_download_request_submit", { plugin_slug: pluginSlug, plugin_version: release.version, gated: true, funnel_stage: "conversion" });
    const body = await api("/api/plugins/download-request", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        name: formData.get("name"),
        store_url: formData.get("store_url"),
        plugin_slug: pluginSlug,
        consent_product_updates: formData.get("consent_product_updates") === "on",
        consent_marketing: formData.get("consent_marketing") === "on",
        consent_feedback: formData.get("consent_feedback") === "on",
        source_page: location.pathname,
        referrer: document.referrer,
        ...currentCampaignParams()
      })
    });
    const success = document.getElementById("plugin-download-success");
    const direct = document.getElementById("plugin-download-direct");
    const setup = document.getElementById("plugin-download-setup");
    const copy = document.getElementById("plugin-download-success-copy");
    if (direct) direct.href = body.download_url;
    if (setup) setup.href = body.setup_guide_url || "/docs";
    if (copy) copy.textContent = body.email_queued ? "Your download should start automatically. We have also queued an email with the link." : "Your download should start automatically. Email delivery is not configured yet, so keep this direct link handy.";
    if (success) success.hidden = false;
    form.hidden = true;
    trackEvent("plugin_download_started", { plugin_slug: pluginSlug, plugin_version: body.version, download_type: "zip", gated: true, funnel_stage: "conversion" });
    window.location.href = body.download_url;
    window.setTimeout(() => {
      api("/api/plugins/download-complete", {
        method: "POST",
        body: JSON.stringify({ event_id: body.event_id })
      }).catch(() => undefined);
      trackEvent("plugin_download_completed", { plugin_slug: pluginSlug, plugin_version: body.version, download_type: "zip", gated: true, funnel_stage: "conversion" });
    }, 1800);
  } catch (error) {
    if (message) message.textContent = error.message;
    trackEvent("plugin_download_failed", { plugin_slug: pluginSlug, plugin_version: release.version, error_category: "download_request", funnel_stage: "conversion" });
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
});

function loadFeedbackPage() {
  const url = new URL(location.href);
  const token = url.searchParams.get("token") || "";
  const plugin = url.searchParams.get("plugin") || "";
  const tokenNode = document.getElementById("feedback-token");
  const pluginSelect = document.querySelector("#plugin-feedback-form [name='plugin_slug']");
  if (tokenNode) tokenNode.value = token;
  if (pluginSelect && plugin) pluginSelect.value = pluginFromTarget({ dataset: { pluginDownload: plugin }, getAttribute: () => "" });
}

async function loadUnsubscribePage() {
  const url = new URL(location.href);
  const token = url.searchParams.get("token") || "";
  const tokenNode = document.getElementById("unsubscribe-token");
  const summary = document.getElementById("unsubscribe-summary");
  if (tokenNode) tokenNode.value = token;
  if (!token) {
    if (summary) summary.textContent = "This unsubscribe link is missing a token. Contact support if you need help.";
    return;
  }
  try {
    const body = await api(`/api/plugins/unsubscribe?token=${encodeURIComponent(token)}`);
    if (summary) summary.textContent = `Email preferences for ${body.email} and ${body.plugin_slug}.`;
  } catch (error) {
    if (summary) summary.textContent = error.message;
  }
}

document.getElementById("plugin-unsubscribe-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const message = document.getElementById("plugin-unsubscribe-message");
  const button = form.querySelector("button[type='submit']");
  const originalText = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Updating...";
    }
    const body = await api("/api/plugins/unsubscribe", {
      method: "POST",
      body: JSON.stringify({
        token: data.get("token"),
        scope: data.get("scope"),
        reason: data.get("reason")
      })
    });
    if (message) message.textContent = body.message || "Preferences updated.";
  } catch (error) {
    if (message) message.textContent = error.message;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
});

document.getElementById("plugin-feedback-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const message = document.getElementById("plugin-feedback-message");
  const reviewCta = document.getElementById("plugin-feedback-review-cta");
  const reviewLink = document.getElementById("plugin-feedback-public-review");
  const button = form.querySelector("button[type='submit']");
  const originalText = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }
    if (message) message.textContent = "";
    if (reviewCta) reviewCta.hidden = true;
    const body = await api("/api/plugins/feedback", {
      method: "POST",
      body: JSON.stringify({
        token: data.get("token"),
        email: data.get("email"),
        plugin_slug: data.get("plugin_slug"),
        rating: data.get("rating"),
        feedback_type: data.get("feedback_type"),
        message: data.get("message"),
        public_display_name: data.get("public_display_name"),
        permission_to_use_testimonial: data.get("permission_to_use_testimonial") === "on"
      })
    });
    if (message) message.textContent = body.message || "Thanks for your feedback.";
    if (body.show_public_review_cta && reviewCta && reviewLink) {
      reviewLink.href = body.public_review_url || "/support";
      reviewCta.hidden = false;
    }
    trackEvent("plugin_feedback_submit", { plugin_slug: data.get("plugin_slug"), rating: data.get("rating") || 0, funnel_stage: "retention" });
    form.reset();
  } catch (error) {
    if (message) message.textContent = error.message;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
});

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
    const [overviewBody, storesBody, eventsBody, siteBody, downloadSummaryBody, downloadEventsBody, feedbackBody] = await Promise.all([
      api(`/api/admin/plugin-analytics/overview?range=${encodeURIComponent(range)}`),
      api("/api/admin/plugin-analytics/stores"),
      api("/api/admin/plugin-analytics/events"),
      api(`/api/admin/site-analytics/overview?range=${encodeURIComponent(range)}`),
      api("/api/admin/plugins/downloads/summary"),
      api("/api/admin/plugins/downloads/events"),
      api("/api/admin/plugins/feedback")
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
    renderPluginDownloadAdmin(downloadSummaryBody.summary, downloadEventsBody.events || [], feedbackBody.feedback || []);

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

function renderPluginDownloadAdmin(summary, events, feedback) {
  if (!summary) return;
  const metrics = document.getElementById("admin-plugin-download-metrics");
  if (metrics) {
    const totals = summary.totals || {};
    metrics.innerHTML = [
      ["Total downloads", totals.downloads],
      ["Completed", totals.completed],
      ["Unique downloaders", totals.unique_downloaders],
      ["Feedback", totals.feedback_count],
      ["Average rating", Number(totals.average_rating || 0).toFixed(1)]
    ].map(([label, value]) => `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></div>`).join("");
  }
  const renderAdminRows = (id, rows, formatter) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML = rows?.length
      ? `<div class="dash-list">${rows.slice(0, 12).map((row) => `<div class="dash-item">${formatter(row)}</div>`).join("")}</div>`
      : `<p>No data yet.</p>`;
  };
  renderAdminRows("admin-plugin-downloads-by-plugin", summary.downloads_by_plugin || [], (row) => `${escapeHtml(row.plugin_slug)}<br><small>${escapeHtml(row.count)} downloads</small>`);
  renderAdminRows("admin-plugin-downloads-by-version", summary.downloads_by_version || [], (row) => `${escapeHtml(row.plugin_slug)} ${escapeHtml(row.plugin_version)}<br><small>${escapeHtml(row.count)} downloads</small>`);
  renderAdminRows("admin-plugin-downloads-by-source", summary.downloads_by_utm || [], (row) => `${escapeHtml(row.source || "direct")} ${row.campaign ? `- ${escapeHtml(row.campaign)}` : ""}<br><small>${escapeHtml(row.count)} downloads</small>`);
  renderAdminRows("admin-plugin-feedback-summary", feedback || [], (row) => `${escapeHtml(row.plugin_slug)} ${row.rating ? `- ${escapeHtml(row.rating)}/5` : ""}<br><small>${escapeHtml(row.feedback_type)} - ${escapeHtml(formatDate(row.created_at))}</small>`);
  renderAdminRows("admin-plugin-download-event-rows", events || [], (row) => `
    <strong>${escapeHtml(row.email_normalized || "-")}</strong><br>
    <small>${escapeHtml(row.plugin_slug)} ${escapeHtml(row.plugin_version)} - ${escapeHtml(row.download_status)} - ${escapeHtml(formatDate(row.created_at))}</small>
  `);
  renderAdminRows("admin-plugin-feedback-rows", feedback || [], (row) => `
    <strong>${escapeHtml(row.email_normalized || "-")} ${row.rating ? `- ${escapeHtml(row.rating)}/5` : ""}</strong><br>
    <small>${escapeHtml(row.plugin_slug)} - ${escapeHtml(row.feedback_type)} - ${escapeHtml(formatDate(row.created_at))}</small>
    <p>${escapeHtml(row.message || "")}</p>
  `);
}

document.addEventListener("submit", async (event) => {
  const scheduleForm = event.target.closest?.("#audit-schedule-form");
  if (scheduleForm) {
    event.preventDefault();
    const form = new FormData(scheduleForm);
    const button = scheduleForm.querySelector("button[type='submit']");
    const original = button?.textContent || "Save Schedule";
    try {
      if (button) {
        button.disabled = true;
        button.textContent = "Saving...";
      }
      await api("/api/image-studio/audit-schedule", {
        method: "PUT",
        body: JSON.stringify({
          store_id: form.get("store_id"),
          frequency: form.get("frequency"),
          scan_mode: form.get("scan_mode"),
          email_report: form.get("email_report") === "true",
          monthly_report_enabled: form.get("monthly_report_enabled") !== "false",
          scan_options: {
            source: "portal_settings",
            plugin_executes_scan: true
          }
        })
      });
      trackEvent("image_studio_feature_click", { cta_location: "scheduled_scan_save", funnel_stage: "retention" });
      await loadSettingsPage();
    } catch (error) {
      if (button) button.textContent = error.message;
      window.setTimeout(() => {
        if (button) button.textContent = original;
      }, 2500);
    } finally {
      if (button) button.disabled = false;
    }
    return;
  }

  const brandForm = event.target.closest?.("#brand-style-form");
  if (brandForm) {
    event.preventDefault();
    const form = new FormData(brandForm);
    const preset = {
      id: String(form.get("id") || form.get("name") || `preset-${Date.now()}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `preset-${Date.now()}`,
      name: String(form.get("name") || "Untitled preset").trim(),
      backgroundType: String(form.get("backgroundType") || "optivra-light"),
      aspectRatio: String(form.get("aspectRatio") || "1:1"),
      productPadding: String(form.get("productPadding") || "balanced"),
      shadow: String(form.get("shadow") || "subtle"),
      outputFormat: String(form.get("outputFormat") || "original"),
      applyScope: String(form.get("applyScope") || "all"),
      categories: String(form.get("categories") || "").split(",").map((item) => item.trim()).filter(Boolean)
    };
    const presets = getBrandStylePresets();
    const next = presets.filter((item) => item.id !== preset.id);
    next.push(preset);
    saveBrandStylePresets(next);
    trackEvent("image_studio_feature_click", { cta_location: "brand_style_preset_save", funnel_stage: "retention" });
    loadBackgroundsPage();
    return;
  }

  const formNode = event.target.closest?.("#site-form");
  if (!formNode) return;
  event.preventDefault();
  const form = new FormData(formNode);
  const output = formNode.querySelector("#new-token") || document.getElementById("new-token");
  const button = formNode.querySelector("button[type='submit']");
  const originalText = button?.textContent || "Generate Site API Token";
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Generating...";
    }
    if (output) output.textContent = "Generating a new token...";
    const body = await api("/sites/connect", {
      method: "POST",
      body: JSON.stringify({ domain: form.get("domain") })
    });
    if (output) output.textContent = `New site token for ${body.site.domain}:\n${body.api_token}\n\nCopy this token now. For safety, Optivra will not show it again.`;
    trackConversion("docs_api_token_interest", { cta_location: "site_connect", funnel_stage: "retention" });
  } catch (error) {
    if (output) output.textContent = error.message;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
});

document.addEventListener("click", async (event) => {
  const brandEdit = event.target.closest("[data-brand-edit]");
  if (brandEdit) {
    event.preventDefault();
    const preset = getBrandStylePresets().find((item) => item.id === brandEdit.getAttribute("data-brand-edit"));
    const form = document.getElementById("brand-style-form");
    if (preset && form) {
      form.elements.id.value = preset.id;
      form.elements.name.value = preset.name;
      form.elements.backgroundType.value = preset.backgroundType;
      form.elements.aspectRatio.value = preset.aspectRatio;
      form.elements.productPadding.value = preset.productPadding;
      form.elements.shadow.value = preset.shadow;
      form.elements.outputFormat.value = preset.outputFormat;
      form.elements.applyScope.value = preset.applyScope;
      form.elements.categories.value = (preset.categories || []).join(", ");
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  const brandDelete = event.target.closest("[data-brand-delete]");
  if (brandDelete) {
    event.preventDefault();
    const id = brandDelete.getAttribute("data-brand-delete");
    const next = getBrandStylePresets().filter((item) => item.id !== id);
    saveBrandStylePresets(next.length ? next : defaultBrandStylePresets());
    loadBackgroundsPage();
    return;
  }

  if (event.target.closest("[data-brand-reset]")) {
    event.preventDefault();
    saveBrandStylePresets(defaultBrandStylePresets());
    loadBackgroundsPage();
    return;
  }

  const queueRecommendation = event.target.closest("[data-report-queue-recommendation]");
  if (queueRecommendation) {
    event.preventDefault();
    const recommendationId = queueRecommendation.getAttribute("data-report-queue-recommendation");
    const report = window.optivraCurrentReport || {};
    const scanId = report.scan?.id || sessionStorage.getItem("optivraSelectedReportId") || "";
    if (!recommendationId || !scanId) return;
    const originalText = queueRecommendation.textContent;
    try {
      queueRecommendation.disabled = true;
      queueRecommendation.textContent = "Adding...";
      const result = await api(`/api/image-studio/audits/${encodeURIComponent(scanId)}/queue-recommendation`, {
        method: "POST",
        body: JSON.stringify({
          recommendation_id: recommendationId,
          background_preset: "optivra-default"
        })
      });
      queueRecommendation.textContent = result.queued_count ? "Queued" : "Already queued";
      queueRecommendation.classList.remove("primary");
      queueRecommendation.classList.add("ghost");
      trackEvent("image_studio_feature_click", { cta_location: "portal_audit_queue", funnel_stage: "retention" });
    } catch (error) {
      queueRecommendation.disabled = false;
      queueRecommendation.textContent = error.message || originalText;
      window.setTimeout(() => { queueRecommendation.textContent = originalText; }, 2500);
    }
    return;
  }

  const reportOpen = event.target.closest("[data-report-open]");
  if (reportOpen) {
    event.preventDefault();
    const scanId = reportOpen.getAttribute("data-report-open");
    if (scanId) {
      sessionStorage.setItem("optivraSelectedReportId", scanId);
      history.pushState({}, "", "/reports?view=detail");
      routeTo("/reports");
      trackEvent("image_studio_feature_click", { cta_location: "portal_report", funnel_stage: "retention" });
    }
    return;
  }

  if (event.target.closest("[data-report-back]")) {
    event.preventDefault();
    sessionStorage.removeItem("optivraSelectedReportId");
    history.pushState({}, "", "/reports");
    routeTo("/reports");
    return;
  }

  if (event.target.closest("[data-report-export]")) {
    event.preventDefault();
    const report = window.optivraCurrentReport || {};
    const blob = new Blob([JSON.stringify(sanitizeHealthReportExport(report), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `optivra-image-health-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (event.target.closest("[data-dashboard-reload]")) {
    event.preventDefault();
    await loadDashboard();
    return;
  }

  if (event.target.closest("[data-analytics-reload]")) {
    event.preventDefault();
    await loadAnalyticsTrends();
    return;
  }

  if (event.target.closest("[data-recommendations-reload]")) {
    event.preventDefault();
    await loadPortalRecommendations();
    return;
  }

  if (event.target.closest("[data-queue-reload]")) {
    event.preventDefault();
    await loadAuditQueuePage();
    return;
  }
});

document.addEventListener("click", async (event) => {
  const portalButton = event.target.closest("#portal-button, #portal-button-secondary");
  if (portalButton) {
    event.preventDefault();
    await openPortal();
    return;
  }

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
updateAuthActions();
loadCurrentUser().finally(() => routeTo(location.pathname));
