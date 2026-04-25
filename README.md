# Image Studio

Image Studio contains the Optivra image-processing SaaS backend and the standalone WooCommerce plugin, Catalogue Image Studio.

## Repository Layout

```text
src/                         Node/Express backend
prisma/                      Prisma schema
config/                      Backend runtime config
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
- `npm run build` - compile TypeScript into `dist`
- `npm start` - run the compiled production server
- `npm run typecheck` - run TypeScript without emitting files
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - create and apply a local Prisma migration
- `npm run prisma:studio` - open Prisma Studio

## Runtime Environment

### Local `.env` Setup

Copy `.env.example` to `.env.local` and fill in values using `KEY=value` lines only. Do not paste shell exports, comments after values, JSON, or platform-specific labels into `.env.local`.

The app loads `.env` first and `.env.local` second, so local overrides can live in `.env.local`. Both `.env` and `.env.local` are gitignored. Startup validation reports missing variable names only; it does not print secret values.

### Render Environment Variables

In Render, add the same variables from `.env.example` under the service Environment settings. Use these commands:

```bash
npm install && npm run build
```

Start command:

```bash
npm run start
```

### Supabase Connection Strings

In Supabase, open Project Settings, then Database, then Connection string. Use the pooled PostgreSQL connection string for `DATABASE_URL`, which is best for app runtime connections. Use the direct/session connection string for `DIRECT_URL` when running migrations or tools that need a non-pooled connection.

Keep `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase API settings. Never commit real Supabase, Stripe, OpenAI, or JWT secret values.

## Database Migrations

After setting `DATABASE_URL` in `.env.local`, create and apply the initial Image Studio schema migration:

```bash
npm run prisma:migrate -- --name init_optivra_schema
```

For deployed Supabase environments, apply committed migrations with:

```bash
npx prisma migrate deploy
```

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

## Image Processing

`POST /images/process` validates a connected-site API token, checks credits, downloads the source image, sends it through the configured background-removal service, composes a product image with Sharp, saves it under `storage/processed-images`, deducts one credit, and returns the processed image URL.

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
  "processed_url": "http://localhost:3000/processed-images/example.png",
  "credits_remaining": 79
}
```

Credits are deducted only after successful processing. Failed downloads, invalid images, background-removal failures, and Sharp processing errors do not deduct credits.

## WooCommerce Plugin

The plugin lives in:

```text
wordpress-plugin/catalogue-image-studio
```

To install locally, copy or symlink that folder into a WordPress install under `wp-content/plugins/catalogue-image-studio`, then activate `Catalogue Image Studio` from WordPress admin.

The plugin provides reusable classes for:

- Product image scanning
- SaaS backend API calls
- Image processing workflow coordination
- Saving processed images to the media library
- Approve, reject, and revert workflows
