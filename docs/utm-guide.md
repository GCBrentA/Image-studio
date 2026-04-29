# Optivra UTM Guide

Use lowercase snake_case values. Keep campaign names stable so GA4, first-party analytics, and Search Console reporting line up.

Example:

```text
utm_source=facebook
utm_medium=social
utm_campaign=image_studio_launch
utm_content=woocommerce_group_post
utm_term=ai_product_images
```

Recommended campaign names:

| Campaign | Use for |
| --- | --- |
| `image_studio_launch` | Image Studio announcement traffic |
| `free_gateway_plugin` | Payment Gateway Rules plugin promotion |
| `woo_facebook_group` | WooCommerce Facebook community posts |
| `image_seo_blog` | Content campaigns around image SEO guides |
| `plugin_marketplace` | Marketplace/profile referral campaigns |
| `shopify_app_launch` | Shopify app install promotion |
| `retargeting_image_studio` | Retargeting traffic for product/pricing visitors |

Attribution behaviour:

- First-touch attribution is stored once and attached to later conversion events.
- Last-touch attribution updates only when a new campaign or external referrer appears.
- Internal navigation does not overwrite acquisition source.
- Direct traffic does not wipe an existing campaign during the same visitor history.
- Never include names, emails, phone numbers, licence keys, checkout IDs, or uploaded image URLs in UTM values.

