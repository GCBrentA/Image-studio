export type AnalyticsSource = "client" | "server" | "both";

export type AnalyticsEventDefinition = {
  event_name: string;
  description: string;
  recommendedParams: string[];
  requiredParams: string[];
  optionalParams: string[];
  source: AnalyticsSource;
  conversionCandidate: boolean;
};

export type AnalyticsEventGroup = {
  group: string;
  events: AnalyticsEventDefinition[];
};

const baseParams = [
  "page_path",
  "clean_url",
  "page_title",
  "route_group",
  "referrer_domain",
  "device_type",
  "viewport_size",
  "session_engagement_id",
  "first_touch_source",
  "first_touch_medium",
  "first_touch_campaign",
  "first_touch_content",
  "first_touch_term",
  "last_touch_source",
  "last_touch_medium",
  "last_touch_campaign",
  "last_touch_content",
  "last_touch_term",
  "landing_page",
  "entry_route_group",
  "visitor_type",
  "environment"
];

const productParams = ["product_name", "product_slug", "plugin_name", "plan_name", "plan_interval", "price_visible", "currency", "cta_location", "cta_text", "funnel_stage"];
const downloadParams = ["plugin_slug", "plugin_version", "download_location", "download_type", "gated", "result", "error_category"];
const contentParams = ["content_type", "content_slug", "content_category", "content_title", "reading_depth", "estimated_read_time", "cta_location"];

const event = (
  event_name: string,
  description: string,
  source: AnalyticsSource,
  recommendedParams: string[] = [],
  requiredParams: string[] = [],
  optionalParams: string[] = [],
  conversionCandidate = false
): AnalyticsEventDefinition => ({
  event_name,
  description,
  recommendedParams: [...baseParams, ...recommendedParams],
  requiredParams,
  optionalParams,
  source,
  conversionCandidate
});

export const analyticsEventMap: AnalyticsEventGroup[] = [
  {
    group: "general_website_traffic",
    events: [
      event("page_view", "A sanitized virtual or initial page view.", "both", [], ["page_path", "route_group"]),
      event("nav_click", "Primary navigation link click.", "client", ["cta_location", "cta_text"]),
      event("footer_click", "Footer navigation or CTA click.", "client", ["cta_location", "cta_text"]),
      event("hero_cta_click", "Hero area call-to-action click.", "client", ["cta_location", "cta_text", "funnel_stage"]),
      event("scroll_depth_25", "Visitor reached 25% page scroll depth.", "client", ["reading_depth"]),
      event("scroll_depth_50", "Visitor reached 50% page scroll depth.", "client", ["reading_depth"]),
      event("scroll_depth_75", "Visitor reached 75% page scroll depth.", "client", ["reading_depth"]),
      event("scroll_depth_90", "Visitor reached 90% page scroll depth.", "client", ["reading_depth"]),
      event("time_on_page_30s", "Visitor remained on a page for 30 seconds.", "client"),
      event("time_on_page_60s", "Visitor remained on a page for 60 seconds.", "client"),
      event("time_on_page_120s", "Visitor remained on a page for 120 seconds.", "client"),
      event("outbound_click", "Click to an external domain.", "client", ["cta_location", "cta_text"]),
      event("file_download", "Browser file download click.", "client", downloadParams),
      event("error_viewed", "User-visible safe error category shown.", "client", ["error_category"])
    ]
  },
  {
    group: "home_page",
    events: [
      event("home_page_view", "Home page viewed.", "client", [], ["page_path"]),
      event("home_hero_cta_click", "Home hero CTA clicked.", "client", productParams, [], [], true),
      event("home_product_card_click", "Home product card clicked.", "client", productParams),
      event("home_pricing_cta_click", "Home pricing CTA clicked.", "client", productParams, [], [], true),
      event("home_download_cta_click", "Home download CTA clicked.", "client", [...productParams, ...downloadParams], [], [], true),
      event("home_docs_cta_click", "Home docs CTA clicked.", "client", contentParams)
    ]
  },
  {
    group: "optivra_image_studio",
    events: [
      event("image_studio_page_view", "Image Studio product page viewed.", "client", productParams, ["page_path"]),
      event("image_studio_hero_cta_click", "Image Studio hero CTA clicked.", "client", productParams, [], [], true),
      event("image_studio_feature_view", "Image Studio feature section viewed.", "client", productParams),
      event("image_studio_feature_click", "Image Studio feature interaction.", "client", productParams),
      event("image_studio_before_after_view", "Before/after section viewed.", "client", productParams),
      event("image_studio_demo_view", "Demo or documentation video/section viewed.", "client", productParams),
      event("image_studio_pricing_click", "Image Studio pricing CTA clicked.", "client", productParams, [], [], true),
      event("image_studio_download_click", "Image Studio download CTA clicked.", "client", [...productParams, ...downloadParams], [], [], true),
      event("image_studio_docs_click", "Image Studio docs CTA clicked.", "client", contentParams),
      event("image_studio_faq_expand", "Image Studio FAQ expanded.", "client", ["content_slug"]),
      event("image_studio_preserve_mode_interest", "Preserve mode feature interest.", "client", productParams),
      event("image_studio_background_generation_interest", "Background generation feature interest.", "client", productParams),
      event("image_studio_seo_feature_interest", "SEO feature interest.", "client", productParams),
      event("image_studio_bulk_processing_interest", "Bulk processing feature interest.", "client", productParams)
    ]
  },
  {
    group: "downloads",
    events: [
      event("downloads_page_view", "Downloads page viewed.", "client", downloadParams, ["page_path"]),
      event("plugin_download_click", "Plugin download CTA clicked.", "both", downloadParams, ["plugin_slug"], [], true),
      event("plugin_download_started", "Plugin download started.", "both", downloadParams, ["plugin_slug"]),
      event("plugin_download_completed", "Plugin download completed.", "both", downloadParams, ["plugin_slug"], [], true),
      event("plugin_download_failed", "Plugin download failed.", "both", downloadParams, ["plugin_slug", "error_category"]),
      event("download_email_capture_start", "Download email capture started.", "client", downloadParams),
      event("download_email_capture_submit", "Download email capture submitted without PII.", "client", downloadParams),
      event("download_email_capture_error", "Download email capture failed with safe category.", "client", downloadParams),
      event("download_version_selected", "Download version selected.", "client", downloadParams),
      event("download_changelog_view", "Download changelog viewed.", "client", downloadParams)
    ]
  },
  {
    group: "pricing",
    events: [
      event("pricing_page_view", "Pricing page viewed.", "client", productParams, ["page_path"]),
      event("pricing_plan_view", "Pricing plan viewed.", "client", productParams, ["plan_name"]),
      event("pricing_plan_expand", "Pricing plan expanded.", "client", productParams, ["plan_name"]),
      event("pricing_plan_compare", "Pricing comparison interaction.", "client", productParams),
      event("pricing_cta_click", "Pricing CTA clicked.", "client", productParams, ["plan_name"], [], true),
      event("pricing_faq_expand", "Pricing FAQ expanded.", "client", ["content_slug"]),
      event("pricing_monthly_selected", "Monthly billing selected.", "client", productParams),
      event("pricing_yearly_selected", "Yearly billing selected.", "client", productParams),
      event("checkout_started", "Checkout start requested.", "both", productParams, ["plan_name"], [], true),
      event("checkout_redirected", "User redirected to checkout provider.", "client", productParams, ["plan_name"]),
      event("checkout_success_landing", "Checkout success landing page viewed.", "both", productParams, [], [], true),
      event("checkout_cancelled", "Checkout cancellation landing page viewed.", "client", productParams),
      event("checkout_error", "Checkout start or redirect failed with safe category.", "both", [...productParams, "error_category"], ["error_category"])
    ]
  },
  {
    group: "docs",
    events: [
      event("docs_page_view", "Docs page viewed.", "client", contentParams, ["page_path"]),
      event("docs_section_view", "Docs section viewed.", "client", contentParams),
      event("docs_search", "Docs search performed without raw query PII.", "client", ["content_type"]),
      event("docs_install_step_view", "Install step viewed.", "client", contentParams, [], [], true),
      event("docs_copy_code_click", "Docs code copied.", "client", contentParams, [], [], true),
      event("docs_support_click", "Docs support CTA clicked.", "client", contentParams),
      event("docs_previous_next_click", "Docs previous/next clicked.", "client", contentParams),
      event("docs_plugin_setup_interest", "Plugin setup docs interest.", "client", contentParams),
      event("docs_api_token_interest", "API token docs interest.", "client", contentParams)
    ]
  },
  {
    group: "blog",
    events: [
      event("blog_index_view", "Blog index viewed.", "client", contentParams),
      event("blog_post_view", "Blog post viewed.", "client", contentParams, ["content_slug"]),
      event("blog_scroll_75", "Blog post reached 75% depth.", "client", contentParams, ["content_slug"]),
      event("blog_cta_click", "Blog CTA clicked.", "client", contentParams, [], [], true),
      event("blog_related_post_click", "Related blog post clicked.", "client", contentParams),
      event("blog_category_click", "Blog category clicked.", "client", contentParams),
      event("blog_author_click", "Blog author link clicked.", "client", contentParams),
      event("blog_exit_to_product", "Blog visitor clicked to product page.", "client", contentParams, [], [], true),
      event("blog_exit_to_download", "Blog visitor clicked to downloads.", "client", contentParams, [], [], true),
      event("blog_exit_to_pricing", "Blog visitor clicked to pricing.", "client", contentParams, [], [], true)
    ]
  },
  {
    group: "support_contact",
    events: [
      event("support_page_view", "Support page viewed.", "client", [], ["page_path"]),
      event("contact_form_start", "Contact form started.", "client", ["cta_location"]),
      event("contact_form_submit", "Contact form submitted without PII.", "client", ["cta_location"]),
      event("contact_form_success", "Contact form completed.", "client", ["cta_location"], [], [], true),
      event("contact_form_error", "Contact form failed with safe category.", "client", ["cta_location", "error_category"]),
      event("support_email_click", "Support email link clicked.", "client", ["cta_location"]),
      event("support_docs_click", "Support docs CTA clicked.", "client", ["cta_location"])
    ]
  },
  {
    group: "shopify_app_auth",
    events: [
      event("shopify_install_started", "Shopify install was initiated.", "server", ["funnel_stage"], [], [], true),
      event("shopify_install_success", "Shopify install completed.", "server", ["funnel_stage"], [], [], true),
      event("shopify_install_error", "Shopify install failed with safe category.", "server", ["error_category"]),
      event("shopify_oauth_started", "Shopify OAuth started.", "server", ["funnel_stage"]),
      event("shopify_oauth_callback_success", "Shopify OAuth callback succeeded.", "server", ["funnel_stage"]),
      event("shopify_oauth_callback_error", "Shopify OAuth callback failed with safe category.", "server", ["error_category"]),
      event("shopify_embedded_app_loaded", "Shopify embedded app loaded.", "client", ["route_group"])
    ]
  },
  {
    group: "server_backend_events",
    events: [
      event("server_plugin_download_completed", "Server confirmed a plugin download completed.", "server", downloadParams, ["plugin_slug"], [], true),
      event("server_checkout_success", "Server confirmed checkout success from webhook.", "server", productParams, [], [], true),
      event("server_checkout_failed", "Server observed checkout failure with safe category.", "server", [...productParams, "error_category"], ["error_category"]),
      event("server_shopify_install_success", "Server confirmed Shopify install success.", "server", ["funnel_stage"], [], [], true),
      event("server_shopify_install_error", "Server observed Shopify install failure.", "server", ["error_category"]),
      event("server_webhook_received", "Webhook received from a trusted provider.", "server", ["webhook_provider", "webhook_type"]),
      event("server_webhook_error", "Webhook processing failed with safe category.", "server", ["webhook_provider", "error_category"]),
      event("server_api_error", "API request failed with safe category.", "server", ["route_group", "status_code", "error_category"])
    ]
  }
];

export const approvedAnalyticsEvents = new Set(
  analyticsEventMap.flatMap((group) => group.events.map((item) => item.event_name))
);

export const conversionCandidateEvents = new Set(
  analyticsEventMap.flatMap((group) => group.events.filter((item) => item.conversionCandidate).map((item) => item.event_name))
);

export const analyticsFunnels = {
  image_studio_interest: ["page_view", "image_studio_page_view", "image_studio_feature_click", "image_studio_pricing_click", "pricing_cta_click", "checkout_started", "checkout_success_landing"],
  free_plugin_download: ["downloads_page_view", "plugin_download_click", "plugin_download_started", "plugin_download_completed"],
  docs_to_install: ["docs_page_view", "docs_install_step_view", "docs_copy_code_click", "plugin_download_click", "plugin_download_completed"],
  blog_to_product: ["blog_post_view", "blog_cta_click", "image_studio_page_view", "pricing_cta_click", "checkout_started"],
  shopify_install: ["shopify_install_started", "shopify_oauth_started", "shopify_oauth_callback_success", "shopify_install_success"]
} as const;

export const funnelStages = ["awareness", "interest", "consideration", "intent", "conversion", "retention"] as const;

