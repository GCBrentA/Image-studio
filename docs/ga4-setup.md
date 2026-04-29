# Optivra GA4 Setup

## Environment Variables

Used by the public site and backend:

- `VITE_GA4_MEASUREMENT_ID=G-G7MDYM36YE`
- `GA4_MEASUREMENT_ID=G-G7MDYM36YE`
- `GOOGLE_TAG_ID=GT-5RMBV8JV`
- `GOOGLE_SITE_VERIFICATION`
- `GA4_MEASUREMENT_PROTOCOL_SECRET`
- `VITE_GTM_ID`
- `VITE_ANALYTICS_DEBUG=true`

Optional values may be blank. Missing Measurement Protocol secrets cause server events to skip safely.

## Verify Events

1. Deploy with the GA4 measurement ID.
2. Open GA4 Realtime and browse the home, Image Studio, pricing, downloads, docs, and blog pages.
3. In development, set `VITE_ANALYTICS_DEBUG=true` and check the browser console for sanitized event names and params.
4. Use GA4 DebugView with Tag Assistant or debug mode to confirm `page_view`, route-specific views, CTA clicks, checkout starts, and download clicks.
5. Confirm server events after setting `GA4_MEASUREMENT_PROTOCOL_SECRET`: `server_checkout_success`, `server_plugin_download_completed`, and Shopify install events.

## Conversion Toggles

Recommended GA4 conversions:

- `plugin_download_completed`
- `server_plugin_download_completed`
- `contact_form_success`
- `pricing_cta_click`
- `checkout_started`
- `checkout_success_landing`
- `server_checkout_success`
- `shopify_install_success`
- `server_shopify_install_success`

Optional conversions:

- `docs_copy_code_click`
- `image_studio_download_click`

## Custom Dimensions

Create event-scoped custom dimensions:

- `route_group`
- `cta_location`
- `plugin_slug`
- `plan_name`
- `funnel_stage`
- `first_touch_source`
- `first_touch_medium`
- `first_touch_campaign`
- `last_touch_source`
- `last_touch_medium`
- `last_touch_campaign`
- `content_type`
- `content_slug`

## Audiences

- Viewed pricing but did not checkout
- Downloaded plugin
- Viewed Image Studio page
- Read blog and clicked product CTA
- Viewed docs install guide
- Checkout started but not completed

## Reports

- Acquisition by campaign
- Landing page conversion rate
- Blog assisted conversions
- Download funnel
- Pricing funnel
- Shopify install funnel

## Privacy

Analytics sanitization strips emails, phone-like values, keys/secrets/tokens, licence keys, Stripe IDs, OpenAI keys, uploaded image URLs, raw error stacks, and URLs with query strings before events leave the browser or backend.

