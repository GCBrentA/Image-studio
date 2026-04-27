# Shopify Dev Dashboard Setup

Use these production values for the Optivra Image Studio Shopify app.

## App URLs

App URL:

```text
https://shopify.optivra.app/
```

Allowed redirection URL:

```text
https://shopify.optivra.app/auth/callback
```

OAuth begin route for development store testing:

```text
https://shopify.optivra.app/auth?shop=your-dev-store.myshopify.com
```

## Scopes

```text
read_products,write_products,read_files,write_files
```

## Webhooks

```text
app/uninstalled        -> https://shopify.optivra.app/webhooks/app/uninstalled
customers/data_request -> https://shopify.optivra.app/webhooks/customers/data_request
customers/redact       -> https://shopify.optivra.app/webhooks/customers/redact
shop/redact            -> https://shopify.optivra.app/webhooks/shop/redact
```

## Render

Create the web service from the `shopify-app` root directory.

```text
Service type: Web Service
Root directory: shopify-app
Build command: npm install && npm run build
Start command: npm run start
Health check path: /health
```

Create the worker from the same root directory.

```text
Service type: Background Worker
Root directory: shopify-app
Build command: npm install && npm run build
Start command: npm run worker
```

Required environment variables:

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

Optional:

```text
WORKER_POLL_MS=10000
```

## Test Checklist

1. Open `https://shopify.optivra.app/health`.
2. Confirm the Shopify Dev Dashboard URLs match this guide.
3. Install the app on a Shopify development store.
4. Confirm OAuth starts at `/auth` and returns through `/auth/callback`.
5. Confirm the encrypted token and shop session are stored.
6. Confirm the embedded routes load: `/`, `/products`, `/queue`, `/settings`.
7. Trigger `app/uninstalled` and confirm the shop is marked disconnected.
8. Trigger the compliance webhooks and confirm each returns `200`.
