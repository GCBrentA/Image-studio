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
   cp .env.example .env
   ```

3. Update `.env` with your Supabase PostgreSQL connection string and API secrets:

   ```env
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public"
   JWT_SECRET="replace-with-a-long-random-secret"
   STRIPE_SECRET_KEY="sk_test_replace_me"
   OPENAI_API_KEY="sk-replace-me"
   ```

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

## Database Migrations

After setting `DATABASE_URL` in `.env`, create and apply the initial Optivra SaaS schema migration:

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

`GET /health` responds with service status, uptime, timestamp, and environment.

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
