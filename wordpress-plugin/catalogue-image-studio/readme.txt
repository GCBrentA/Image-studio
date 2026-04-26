=== Optivra Image Studio for WooCommerce ===
Contributors: optivra
Tags: woocommerce, product images, image optimization, ai images, seo, product photography
Requires at least: 6.3
Tested up to: 6.9.1
Requires PHP: 8.0
Requires Plugins: woocommerce
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI-powered product image optimisation, background replacement, review workflow, and SEO metadata for WooCommerce.

== Description ==

Optivra Image Studio connects WooCommerce stores to Optivra's external SaaS image processing service for WooCommerce product image optimisation, AI product image enhancement, background replacement, queue-based review workflows, and product-aware SEO metadata suggestions.

An Optivra account is required for image processing. The plugin includes store connection, scanning, queue management, review and approval workflow tools, and Media Library publishing. Image processing uses credits from your Optivra account.

= Features =

* Connect a WooCommerce store with an Optivra Site API Token.
* Scan WooCommerce featured and gallery product images.
* Queue selected product images for processing.
* Apply AI-powered background replacement and product image optimisation through Optivra Image Studio.
* Review before approval so product images are not replaced automatically.
* Import approved processed images into the WordPress Media Library.
* Replace featured images and gallery images only after approval.
* Revert product images to the original attachment.
* Generate product-aware SEO filenames, alt text, titles, captions, and descriptions.
* Use image framing, scaling, shadow, lighting, and background settings.
* View credits, plan status, and billing links from your Optivra account.

= External service disclosure =

This plugin connects your WooCommerce store to Optivra's external image processing service. When you connect, test the connection, scan, process, or review images, selected product/image data may be sent to Optivra for background replacement, optimisation, SEO metadata generation, and review workflow support.

Data sent to Optivra may include product IDs, product titles, product image URLs, image slot information, selected image processing settings, and selected SEO metadata fields. Optivra returns processed image URLs, credit usage information, and suggested SEO metadata.

The plugin does not include Stripe secret keys, Supabase service role keys, or private backend credentials. Payment and account management happen on Optivra-hosted pages.

Service links:

* Terms of Service: https://www.optivra.app/terms
* Privacy Policy: https://www.optivra.app/privacy
* Data Processing: https://www.optivra.app/docs/ai-image-studio
* Support: https://www.optivra.app/support

== Installation ==

1. Install and activate WooCommerce.
2. Upload the plugin folder to `/wp-content/plugins/` or install the plugin zip from Plugins > Add New.
3. Activate "Optivra Image Studio for WooCommerce".
4. Go to WooCommerce > Optivra Image Studio.
5. Paste your Optivra Site API Token and click Connect.
6. Scan your catalogue, queue images, process selected images, then review and approve results.

== Frequently Asked Questions ==

= Do I need an Optivra account? =

Yes. An Optivra account and Site API Token are required for image processing. The plugin uses credits from your Optivra account.

= Does the plugin process images inside WordPress? =

No. The plugin sends selected image URLs and related product context to Optivra's external service. Optivra processes the image and returns a processed image URL and SEO metadata suggestions.

= Are images replaced automatically? =

By default, no. Processed images wait in Review & Approve until an administrator approves them. Original images are kept for rollback.

= Does the plugin send private keys to the browser? =

No. The plugin stores only the Optivra Site API Token in WordPress options and does not include Stripe secret keys, Supabase service role keys, or Optivra backend secrets.

= What WooCommerce images are supported? =

The plugin scans featured product images and gallery images. Category thumbnails can be enabled from settings where supported.

= Can I edit SEO metadata before approval? =

Yes. Filename, alt text, title, caption, and description suggestions can be edited before approval.

== Screenshots ==

1. Settings and store connection screen.
2. Scan Catalogue screen with product image filters.
3. Queue screen for selected image jobs.
4. Review & Approve screen with before and after previews.
5. SEO metadata fields for processed images.
6. Billing and credits display.

== Changelog ==

= 1.0.0 =
* Initial WordPress.org-ready release.
* Added Optivra account connection, product image scanning, queue workflow, review and approval, Media Library import, and product-aware SEO metadata generation.

== Upgrade Notice ==

= 1.0.0 =
Initial public release. An Optivra account and Site API Token are required for image processing.
