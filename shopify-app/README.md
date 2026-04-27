# Optivra Image Studio Shopify App

Hosted embedded Shopify app for scanning product images, queueing AI background generation jobs, reviewing generated images, and publishing approved results back to Shopify.

This app is intentionally separate from the WooCommerce plugin. The WooCommerce plugin was used only as a workflow reference.

## Stack

- Shopify OAuth embedded app
- React + TypeScript + Vite
- Shopify Polaris UI
- Shopify Admin GraphQL API
- Node/Express backend
- Supabase Postgres
- Render web service + worker service
- Existing Optivra image generation API

## Required Shopify scopes

```text
read_products,write_products,read_files,write_files
```

## Environment variables

Copy `.env.example` to `.env` for local development.

```text
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=https://shopify.optivra.app
SCOPES=read_products,write_products,read_files,write_files
NODE_ENV=production
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPTIVRA_API_URL=
OPTIVRA_API_KEY=
ENCRYPTION_SECRET=
```

`ENCRYPTION_SECRET` is used to encrypt Shopify access tokens before storing them.

## Database setup

Run the SQL migration in Supabase:

```text
supabase/migrations/202604270001_shopify_image_studio.sql
```

It creates:

- `shops`
- `shopify_products_cache`
- `image_jobs`
- `image_job_events`
- `app_settings`
- `credit_events`
- `billing_events`

## Local Shopify setup

1. Create a Shopify Partner app.
2. Set app URL to your tunnel or local URL.
3. Set redirect URL:
   `https://your-url/auth/callback`
4. Configure scopes:
   `read_products,write_products,read_files,write_files`
5. Configure mandatory webhooks:
   - `/webhooks/app/uninstalled`
   - `/webhooks/customers/data_request`
   - `/webhooks/customers/redact`
   - `/webhooks/shop/redact`
6. Run:

```bash
npm install
npm run dev
```

Install URL:

```text
https://your-url/auth?shop=your-dev-store.myshopify.com
```

## Production Shopify Dev Dashboard setup

Use the dedicated Shopify app subdomain. Do not use the main Optivra website root domain for the Shopify app.

```text
App URL:
https://shopify.optivra.app/

Allowed redirection URL:
https://shopify.optivra.app/auth/callback

Scopes:
read_products,write_products,read_files,write_files

OAuth begin URL for testing:
https://shopify.optivra.app/auth?shop=your-dev-store.myshopify.com

Embedded app routes:
https://shopify.optivra.app/
https://shopify.optivra.app/products
https://shopify.optivra.app/queue
https://shopify.optivra.app/settings

Webhook endpoints:
app/uninstalled -> https://shopify.optivra.app/webhooks/app/uninstalled
customers/data_request -> https://shopify.optivra.app/webhooks/customers/data_request
customers/redact -> https://shopify.optivra.app/webhooks/customers/redact
shop/redact -> https://shopify.optivra.app/webhooks/shop/redact
```

## Render deployment

Create separate Render services from the `shopify-app` root directory, or use `shopify-app/render.yaml`.

Web service:

```text
Service Type: Web Service
Root Directory: shopify-app
Build Command: npm install && npm run build
Start Command: npm run start
Health Check: /health
```

Worker service:

```text
Service Type: Background Worker
Root Directory: shopify-app
Build Command: npm install && npm run build
Start Command: npm run worker
```

Required Render environment variables:

```text
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL=https://shopify.optivra.app
SCOPES=read_products,write_products,read_files,write_files
NODE_ENV=production
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPTIVRA_API_URL
OPTIVRA_API_KEY
ENCRYPTION_SECRET
```

`PORT` is supplied by Render for the web service. `WORKER_POLL_MS` is optional for the worker and defaults to `10000`.

Production health check:

```text
https://shopify.optivra.app/health
```

## Production install test

After deployment:

1. Open `https://shopify.optivra.app/health` and confirm it returns JSON status `ok`.
2. Set the Shopify Dev Dashboard app URL and redirect URL shown above.
3. Install the app on a development store with `https://shopify.optivra.app/auth?shop=your-dev-store.myshopify.com`.
4. Confirm OAuth redirects to `/auth/callback` and stores the encrypted access token/session.
5. Confirm the embedded app opens in Shopify Admin.
6. Confirm `/products`, `/queue`, and `/settings` render inside the embedded app.
7. Send or trigger `app/uninstalled` and confirm the HMAC verifies and the shop is marked disconnected.
8. Send Shopify compliance webhook test payloads and confirm each endpoint returns `200`.

## Workflow

1. Merchant installs through Shopify OAuth.
2. App stores encrypted access token and shop record.
3. Merchant scans products.
4. App caches product title/status/main image/media ID.
5. Merchant queues selected images.
6. Worker sends source image URL and settings to Optivra image API.
7. App stores generated image URL and marks job ready for review.
8. Merchant approves/rejects/regenerates.
9. Merchant publishes approved result as additional media or moves it to the primary media position.

## Billing

Billing is disabled for v1 free beta. `billing_events` exists only as a placeholder for future Shopify Billing API integration.

Do not use off-platform billing in the Shopify App Store version.

## Compliance

Implemented webhook endpoints:

- `app/uninstalled`
- `customers/data_request`
- `customers/redact`
- `shop/redact`

Processing stops for uninstalled shops because worker queries exclude `shops.uninstalled_at is not null`.

## Still needed before Shopify App Store submission

- Replace placeholder local session cookie handling with Shopify App Bridge session token validation.
- Complete deeper App Bridge session token validation for all embedded API requests.
- Confirm the GraphQL media publish mutations against the target Shopify API version.
- Add a real Shopify Billing API flow before charging merchants.
- Add automated tests for OAuth, webhook HMAC verification, product scan, job queue, worker processing, and publishing.
- Complete privacy policy/legal pages with final merchant-facing language.
- Run Shopify CLI validation and submit through the Shopify Partner Dashboard.
