# Implementation Notes

## Optivra API integration

`server/services/optivra.ts` calls:

```text
POST {OPTIVRA_API_URL}/images/process
Authorization: Bearer {OPTIVRA_API_KEY}
```

If `OPTIVRA_API_URL` or `OPTIVRA_API_KEY` is missing, the worker uses the source image URL as a stub generated image. This keeps dev-store workflow testable before the image API is connected.

## Publishing behaviour

The app always requires merchant approval before publishing.

- `add_extra` creates Shopify product media from the generated image URL.
- `replace_main` creates Shopify product media, then attempts to move that media to the first product media position.

Original Shopify product media is not deleted in v1.

## Security notes

- Shopify access tokens are encrypted with AES-256-GCM.
- Webhooks validate `X-Shopify-Hmac-Sha256`.
- Worker does not process jobs for uninstalled shops.
- Compliance webhooks acknowledge customer data requests/redaction. The app does not store customer/order data.

## Billing notes

The app is free beta in v1. Billing placeholders are database-only. Shopify App Store versions must use Shopify Billing API for paid plans.
