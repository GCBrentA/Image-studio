# Optivra GA4 Conversion Candidates

These events are safe to mark as GA4 conversions. Do not send PII with any event.

| Event name | Why it matters | GA4 conversion | Suggested value | Funnel |
| --- | --- | --- | --- | --- |
| `plugin_download_completed` | Confirms a plugin download completed. | Yes | 1 | Free plugin download, docs-to-install |
| `server_plugin_download_completed` | Server-confirmed download completion. | Yes | 1 | Free plugin download |
| `contact_form_success` | Lead or support intent. | Yes | 1 | Support/contact |
| `pricing_cta_click` | Buying intent before checkout. | Yes | 1 | Image Studio interest, blog-to-product |
| `checkout_started` | High-intent commercial action. | Yes | Plan value where known | Image Studio interest |
| `checkout_success_landing` | Client-side checkout success landing. | Yes | Plan value where known | Image Studio interest |
| `server_checkout_success` | Server-confirmed paid conversion from webhook. | Yes | Plan value where known | Image Studio interest |
| `shopify_install_success` | Shopify app install completed. | Yes | 1 | Shopify install |
| `server_shopify_install_success` | Server-confirmed Shopify install. | Yes | 1 | Shopify install |
| `docs_copy_code_click` | Install or setup progress. | Optional | 1 | Docs-to-install |
| `image_studio_download_click` | Image Studio download intent. | Optional | 1 | Free plugin download |

Recommended non-conversion events for analysis: `page_view`, `image_studio_page_view`, `downloads_page_view`, `pricing_page_view`, `blog_post_view`, `docs_page_view`, `scroll_depth_75`, `time_on_page_60s`, `nav_click`, and `footer_click`.

