const pages = Array.from(document.querySelectorAll("[data-page]"));
const navLinks = Array.from(document.querySelectorAll("[data-link]"));
const tokenKey = "optivra_token";

function token() {
  return localStorage.getItem(tokenKey) || "";
}

function setToken(value) {
  localStorage.setItem(tokenKey, value);
}

function routeTo(path) {
  const normalized = path === "" ? "/" : path;
  const page = pages.find((node) => node.dataset.page === normalized) || pages[0];
  pages.forEach((node) => node.classList.toggle("active", node === page));
  navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === normalized));
  document.title = pageTitle(normalized);
  if (normalized === "/dashboard") {
    loadDashboard();
  }
  if (normalized === "/account/billing" || normalized === "/billing/success") {
    loadBilling();
  }
}

function pageTitle(path) {
  const names = {
    "/": "Optivra | Optimise your store. Increase impact.",
    "/plugins": "Plugins | Optivra",
    "/catalogue-image-studio": "Catalogue Image Studio | Optivra",
    "/pricing": "Pricing | Optivra",
    "/login": "Login | Optivra",
    "/dashboard": "Dashboard | Optivra",
    "/account/billing": "Billing | Optivra",
    "/billing/success": "Billing Success | Optivra",
    "/billing/cancel": "Billing Cancelled | Optivra",
    "/docs": "Docs | Optivra",
    "/support": "Support | Optivra",
    "/terms": "Terms | Optivra",
    "/privacy": "Privacy | Optivra",
    "/refund-policy": "Refund Policy | Optivra"
  };
  return names[path] || names["/"];
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

document.getElementById("site-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const body = await api("/sites/connect", {
      method: "POST",
      body: JSON.stringify({ domain: form.get("domain") })
    });
    document.getElementById("new-token").textContent = `New site token for ${body.site.domain}:\n${body.api_token}`;
    await loadDashboard();
  } catch (error) {
    document.getElementById("new-token").textContent = error.message;
  }
});

document.addEventListener("click", async (event) => {
  const planButton = event.target.closest("[data-plan]");
  const packButton = event.target.closest("[data-pack]");
  if (planButton) {
    await checkout({ type: "subscription", plan: planButton.dataset.plan });
  }
  if (packButton) {
    await checkout({ type: "credit_pack", pack: packButton.dataset.pack });
  }
});

async function checkout(payload) {
  if (!token()) {
    history.pushState({}, "", "/login");
    routeTo("/login");
    return;
  }
  const body = await api("/api/billing/create-checkout-session", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  location.href = body.url;
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

routeTo(location.pathname);
