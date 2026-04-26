# Image Studio

Image Studio contains the Optivra image-processing SaaS backend and the standalone WooCommerce plugin, Catalogue Image Studio.

## Repository Layout

```text
src/                         Node/Express backend
prisma/                      Prisma schema
src/config/                  Backend runtime config
wordpress-plugin/
  catalogue-image-studio/    Sellable WooCommerce plugin
```

## Backend Requirements

- Node.js 20+
- npm
- A Supabase PostgreSQL database

## Backend Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Update `.env.local` with your Supabase PostgreSQL connection strings and API secrets. Keep the file in plain dotenv `KEY=value` format:

   ```env
   DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   DIRECT_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   SUPABASE_URL=https://[PROJECT-REF].supabase.co
   SUPABASE_ANON_KEY=replace-with-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=replace-with-supabase-service-role-key
   JWT_SECRET=replace-with-a-long-random-secret
   API_TOKEN_SALT=replace-with-a-long-random-secret
   APP_URL=http://localhost:3000
   API_BASE_URL=http://localhost:3000
   ```

   Stripe and OpenAI keys can be left blank for local health checks and database-only work. Routes that need the database return a `503` configuration error when `DATABASE_URL` is missing.

4. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Check the API:

   ```bash
   curl http://localhost:3000/health
   ```

## Scripts

- `npm run dev` - start the local development server with watch mode
- `npm run build` - generate Prisma Client and compile TypeScript into `dist`
- `npm start` - run the compiled production server
- `npm run typecheck` - run TypeScript without emitting files
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - create and apply a local development migration
- `npm run prisma:deploy` - apply committed migrations in production
- `npm run prisma:status` - inspect migration status for the configured database
- `npm run prisma:studio` - open Prisma Studio

## Runtime Environment

### Local `.env` Setup

Copy `.env.example` to `.env.local` and fill in values using `KEY=value` lines only. Do not paste shell exports, comments after values, JSON, or platform-specific labels into `.env.local`.

The app loads `.env` first and `.env.local` second, so local overrides can live in `.env.local`. Both `.env` and `.env.local` are gitignored. Startup validation reports missing variable names only; it does not print secret values.

### Render Environment Variables

In Render, add the same variables from `.env.example` under the service Environment settings.

Build Command:

```bash
npm install && npm run build
```

Start Command:

```bash
npm run start
```

`npm run start` runs `dist/server.js`. If Render starts a runtime bundle without that compiled file, the start preflight rebuilds once before launching the server.

### Supabase Connection Strings

In Supabase, open Project Settings, then Database, then Connection string. Use the pooled PostgreSQL connection string for `DATABASE_URL`, which is best for app runtime connections. Use the direct/session connection string for `DIRECT_URL` when running migrations or tools that need a non-pooled connection.

Keep `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase API settings. Never commit real Supabase, Stripe, OpenAI, or JWT secret values.

### Supabase Storage

Create these private Supabase Storage buckets:

- `original-images`
- `processed-images`
- `debug-cutouts`

The backend uploads downloaded source images to `original-images`, background-removal cutouts to `debug-cutouts`, and final generated product images to `processed-images`. The WooCommerce plugin receives only a signed URL for the processed image. The Supabase service role key stays server-side in Render as `SUPABASE_SERVICE_ROLE_KEY` and is never returned to clients.

Image jobs store storage object paths plus upload timestamps and `storage_cleanup_after`, so a future cleanup job can safely remove old artifacts. Optional retention settings:

```env
STORAGE_SIGNED_URL_EXPIRES_SECONDS=604800
IMAGE_STORAGE_RETENTION_DAYS=30
```

### Stripe Billing Variables

Create monthly recurring Stripe Prices for:

- Starter: `$19/month`
- Growth: `$69/month`
- Pro: `$159/month`
- Agency: `$429/month`

Create one-time Stripe Prices for:

- `100` credits: `$19`
- `300` credits: `$49`
- `1000` credits: `$129`

Set the matching Render environment variables:

```env
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_PRO=
STRIPE_PRICE_AGENCY=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
APP_BASE_URL=
BILLING_CURRENCY=usd
STRIPE_CREDIT_PACK_100_PRICE_ID=
STRIPE_CREDIT_PACK_300_PRICE_ID=
STRIPE_CREDIT_PACK_1000_PRICE_ID=
```

Configure the Stripe webhook URL as:

```text
https://your-render-service.onrender.com/api/stripe/webhook
```

Subscribe the webhook endpoint to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, and `customer.updated`.

## Database Migrations

Local development uses Prisma Migrate Dev. After setting `DATABASE_URL` in `.env.local`, create and apply local schema changes with:

```bash
npm run prisma:migrate -- --name init_optivra_schema
```

Render and production Supabase databases use Prisma Migrate Deploy. Run migrations manually before deploy with:

```bash
npx prisma migrate deploy
```

Do not use `prisma db push` in production.

Regenerate Prisma Client after schema changes:

```bash
npm run prisma:generate
```

## Health Check

`GET /health` responds with:

```json
{
  "status": "ok",
  "service": "image-studio",
  "timestamp": "2026-04-25T00:00:00.000Z",
  "database": "configured"
}
```

## SaaS Website

The Express app serves the Optivra website from `public/site` at `/`, `/plugins`, `/catalogue-image-studio`, `/pricing`, `/login`, `/dashboard`, `/docs`, `/support`, `/terms`, `/privacy`, and `/refund-policy`.

The dashboard uses account JWT authentication and calls `/account/dashboard`, `/sites/connect`, `/api/billing/create-checkout-session`, and `/api/billing/create-portal-session` for real account, site, credit, and billing data.

## Account and Site Connection

Create an account:

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "email": "owner@example.com",
  "password": "choose-a-long-password"
}
```

Log in:

```http
POST /auth/login
Content-Type: application/json
```

Both auth endpoints return a JWT as `token`. Use that JWT to connect a WooCommerce site:

```http
POST /sites/connect
Authorization: Bearer account-jwt
Content-Type: application/json
```

```json
{
  "domain": "store.example.com"
}
```

The response includes `api_token`. Store that value in the WooCommerce plugin settings. It is shown only once; the backend stores only a hash.

## Billing

Create a subscription checkout session with an account JWT:

```http
POST /api/billing/create-checkout-session
Authorization: Bearer account-jwt
Content-Type: application/json
```

```json
{
  "plan": "starter"
}
```

Valid plans are `starter`, `growth`, `pro`, and `agency`.

Create a credit pack checkout session:

```json
{
  "type": "credit_pack",
  "pack": "credits_300"
}
```

Valid packs are `credits_100`, `credits_300`, and `credits_1000`.

Both checkout calls return:

```json
{
  "id": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

Open the Stripe customer portal:

```http
POST /api/billing/create-portal-session
Authorization: Bearer account-jwt
```

The Stripe webhook stores processed event IDs to prevent duplicate processing. Plan credits are reset from paid subscription invoices with `billing_reason` of `subscription_create` or `subscription_cycle`.

Check site usage with the site API token:

```http
GET /usage
Authorization: Bearer site-api-token
```

Response:

```json
{
  "plan": "starter",
  "credits_remaining": 20,
  "credits_total": 20,
  "low_credit_thresholds": [
    {
      "percent": 50,
      "reached": false,
      "credits_remaining_at_threshold": 10
    },
    {
      "percent": 80,
      "reached": false,
      "credits_remaining_at_threshold": 4
    },
    {
      "percent": 95,
      "reached": false,
      "credits_remaining_at_threshold": 1
    },
    {
      "percent": 0,
      "reached": false,
      "credits_remaining_at_threshold": 0
    }
  ],
  "subscription_status": "trialing"
}
```

Free trials start with 20 credits. Monthly plan resets add one credit ledger entry for the plan amount: Starter 20, Growth 100, Pro 500, and Agency 1500. The low-credit thresholds indicate when an account has used at least 50%, 80%, 95%, or all available credits.

## Image Processing

`POST /images/process` validates a connected-site API token, checks credits, downloads the source image, uploads the original to Supabase Storage, sends a normalized source image to the OpenAI Image API for a transparent product cutout, stores a debug cutout, composites the cutout onto a branded background with smart scaling and a soft shadow, stores the final `2000x2000` WebP in Supabase Storage, deducts one credit, and returns a signed processed image URL with suggested SEO metadata.

Exact duplicate source images are detected by SHA-256 hash. If the same user has already completed a matching job, the backend returns a fresh signed URL for the existing processed image and does not deduct another credit.

Send the API token as either:

```http
Authorization: Bearer your-api-token
```

or:

```http
x-api-token: your-api-token
```

Store `ConnectedSite.api_token_hash` as the SHA-256 hex hash of the raw token.

Request:

```json
{
  "image_url": "https://example.com/product.jpg",
  "background": "#ffffff",
  "scale_percent": 82
}
```

Response:

```json
{
  "status": "completed",
  "duplicate": false,
  "processed_url": "https://example.supabase.co/storage/v1/object/sign/processed-images/user/job/processed.webp?token=...",
  "credits_remaining": 19,
  "low_credit_thresholds": [
    {
      "percent": 50,
      "reached": false,
      "credits_remaining_at_threshold": 10
    },
    {
      "percent": 80,
      "reached": false,
      "credits_remaining_at_threshold": 4
    },
    {
      "percent": 95,
      "reached": false,
      "credits_remaining_at_threshold": 1
    },
    {
      "percent": 0,
      "reached": false,
      "credits_remaining_at_threshold": 0
    }
  ],
  "seo_metadata": {
    "seo_filename": "example-product-a1b2c3d4e5.webp",
    "alt_text": "Example Product on a clean branded ecommerce background",
    "title": "Example Product | store.example.com",
    "caption": "Example Product product image",
    "description": "Optimized 2000x2000 WebP product image for store.example.com.",
    "file_name": "example-product-a1b2c3d4e5.webp",
    "keywords": ["example", "product", "ecommerce", "webp"]
  }
}
```

Credits are deducted only after successful processing and Supabase Storage upload. Failed downloads, invalid images, OpenAI cutout failures, compositing errors, and storage errors do not deduct credits. Credit deductions are recorded in the credit ledger and are rejected when they would make the balance negative.

## WooCommerce Plugin

The plugin lives in:

```text
wordpress-plugin/catalogue-image-studio
```

To install locally, copy or symlink that folder into a WordPress install under `wp-content/plugins/catalogue-image-studio`, then activate `Catalogue Image Studio` from WordPress admin.

In WooCommerce admin, open Catalogue Image Studio, paste the Render API base URL and the site API token returned by `POST /sites/connect`, save settings, then use Test Connection to verify `/usage`.

The plugin provides reusable classes for:

- Product image scanning
- SaaS backend API calls
- Image processing workflow coordination
- Saving processed images to the media library
- Approve, reject, and revert workflows
