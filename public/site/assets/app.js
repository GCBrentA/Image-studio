const pages = Array.from(document.querySelectorAll("[data-page]"));
const navLinks = Array.from(document.querySelectorAll("[data-link]"));
const tokenKey = "optivra_token";
const PRODUCT_NAME = "Optivra Image Studio";
const PRODUCT_NAME_WOOCOMMERCE = "Optivra Image Studio for WooCommerce";
const PRODUCT_TAGLINE = "AI-powered product image optimisation for WooCommerce.";
const pluginRelease = {
  name: "Optivra Image Studio for WooCommerce",
  version: "1.0.0",
  zipPath: "/downloads/optivra-image-studio-for-woocommerce-1.0.0.zip",
  fileSize: "60.9 KB",
  sha256: "0BA7953FF2F17DBF411A51E5BBE6FA670B28D816332D49AA00E02783E89D4D97",
  wordpressOrgStatus: "WordPress.org review pending",
  updatedAt: "2026-04-27"
};
let currentUser = null;
let currentUserLoaded = false;

function token() {
  return localStorage.getItem(tokenKey) || "";
}

function setToken(value) {
  localStorage.setItem(tokenKey, value);
}

function routeTo(path) {
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
    normalized = "/resources";
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
  if (normalized === "/admin/plugin-analytics") {
    loadAdminAnalytics();
  }
}

function pageTitle(path) {
  const names = {
    "/": `${PRODUCT_NAME} | Optivra`,
    "/plugins": "Plugins | Optivra",
    "/optivra-image-studio": "Optivra Image Studio | WooCommerce Product Image Optimisation",
    "/catalogue-image-studio": "Optivra Image Studio | WooCommerce Product Image Optimisation",
    "/pricing": "Pricing | Optivra",
    "/downloads": `Download ${PRODUCT_NAME_WOOCOMMERCE} | Optivra`,
    "/resources": "WooCommerce Image SEO Resources | Optivra",
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
    "/support": "Support | Optivra",
    "/terms": "Terms | Optivra",
    "/privacy": "Privacy | Optivra",
    "/refund-policy": "Refund Policy | Optivra"
  };
  return names[path] || names["/"];
}

function pageDescription(path) {
  const descriptions = {
    "/": "AI-powered ecommerce tools for WooCommerce stores, starting with Optivra Image Studio for product image optimisation.",
    "/optivra-image-studio": "Optimise WooCommerce product images with AI-powered background replacement, review workflows, and SEO-friendly image metadata.",
    "/pricing": "Compare Optivra Image Studio plans, monthly credits, and credit packs for WooCommerce product image optimisation.",
    "/downloads": "Download Optivra Image Studio for WooCommerce and install the plugin manually while WordPress.org review is pending.",
    "/docs/ai-image-studio": "Learn how to use Optivra Image Studio to scan, process, review, approve, and optimise WooCommerce product images.",
    "/resources": "WooCommerce image SEO article outlines covering alt text, product image metadata, background replacement, and AI product photography.",
    "/support": "Contact Optivra support for Optivra Image Studio setup, billing, plugin, and product image processing help."
  };
  return descriptions[path] || descriptions["/"];
}

function updateMetadata(path) {
  const description = document.querySelector('meta[name="description"]');
  const canonical = document.querySelector('link[rel="canonical"]');
  if (description) description.setAttribute("content", pageDescription(path));
  if (canonical) canonical.setAttribute("href", `https://www.optivra.app${path === "/" ? "/" : path}`);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (!link) return;
  const href = link.getAttribute("href");
  if (!href || href.startsWith("http")) return;
  event.preventDefault();
  history.pushState({}, "", href);
  routeTo(location.pathname);
});

function trackConversion(eventName, properties = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...properties });
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, properties);
  }
  if (typeof window.plausible === "function") {
    window.plausible(eventName, { props: properties });
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-analytics], [data-download-zip], [data-plan], [data-pack]");
  if (!target) return;

  const explicitEvent = target.dataset.analytics;
  if (explicitEvent) {
    trackConversion(explicitEvent, { path: location.pathname });
    return;
  }

  if (target.matches("[data-download-zip]")) {
    trackConversion("download_plugin_clicked", { path: location.pathname });
  } else if (target.matches("[data-plan]")) {
    trackConversion("pricing_plan_clicked", { plan: target.dataset.plan, path: location.pathname });
  } else if (target.matches("[data-pack]")) {
    trackConversion("buy_credits_clicked", { pack: target.dataset.pack, path: location.pathname });
  }
});

window.addEventListener("popstate", () => routeTo(location.pathname));

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
  await submitAuth("/auth/login");
});
document.getElementById("register-button")?.addEventListener("click", async () => {
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
    node.setAttribute("href", pluginRelease.zipPath);
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
    const [overviewBody, storesBody, eventsBody] = await Promise.all([
      api("/api/admin/plugin-analytics/overview"),
      api("/api/admin/plugin-analytics/stores"),
      api("/api/admin/plugin-analytics/events")
    ]);
    const cards = overviewBody.overview?.cards || {};
    setText("admin-connected-stores", cards.connected_stores ?? "-");
    setText("admin-active-stores", cards.active_stores_7d ?? "-");
    setText("admin-new-stores", cards.new_stores_7d ?? "-");
    setText("admin-processed", cards.images_processed_7d ?? "-");
    setText("admin-credits", cards.credits_consumed_7d ?? "-");
    setText("admin-failure-rate", formatPercent(cards.processing_failure_rate));
    setText("admin-approval-rate", formatPercent(cards.approval_rate));
    setText("admin-subscriptions", cards.active_subscriptions ?? "-");
    setText("admin-mrr", `$${Number(cards.mrr_usd || 0).toLocaleString()} USD`);

    renderList("admin-event-counts", overviewBody.event_counts_30d || [], (item) => `${escapeHtml(item.event_type)}<br><small>${escapeHtml(item.count)}</small>`);

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
