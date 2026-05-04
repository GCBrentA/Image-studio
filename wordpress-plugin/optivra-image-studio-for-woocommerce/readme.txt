=== Optivra Image Studio for WooCommerce ===
Contributors: optivra
Tags: woocommerce, ai product images, background replacement, product image seo, image review workflow
Requires at least: 6.3
Tested up to: 6.9
Requires PHP: 8.0
Requires Plugins: woocommerce
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI product image studio for WooCommerce with product-preserve background replacement, health scans, review queues, and SEO recommendations.

== Description ==

Optivra Image Studio for WooCommerce connects your store to Optivra Image Studio, an external service for WooCommerce-native product image workflows. It focuses on product-preserve background replacement, lighting enhancement, product image health scanning, review queues, and SEO-focused image recommendations rather than generic compression or resizing.

An Optivra account and Site API Token are required. Processing uses credits from your Optivra account. Billing is handled through Optivra-hosted pages and Stripe, not inside WordPress. This plugin does not include Stripe secret keys, Supabase service role keys, or private backend credentials.

= Features =

* Connect a WooCommerce store with an Optivra Site API Token.
* Scan WooCommerce featured, gallery, variation, and supported category product images for image health issues.
* Queue selected product images for processing.
* Process images through Optivra Image Studio for product-preserve background replacement and lighting enhancement.
* Review before approval so product images are not replaced automatically.
* Import approved processed images into the WordPress Media Library.
* Replace featured images and gallery images only after approval.
* Revert product images to the original attachment where history is available.
* Generate product-aware SEO filenames, alt text, titles, captions, and descriptions.
* Use image framing, scaling, shadow, lighting, and background settings with credit-aware processing controls.
* View credits, plan status, and billing links from your Optivra account.

== External Service Disclosure ==

Optivra Image Studio connects your WooCommerce store to Optivra's external image processing service. When you scan or process images, selected product image data, image URLs, product names, categories, and related metadata may be sent to Optivra for image background replacement, optimisation, review workflow support, and SEO metadata generation. An Optivra account and Site API Token are required.

No product or image data is sent until you connect your Site API Token and intentionally start scanning or processing.

Service details:

* Service name: Optivra Image Studio
* Service URL: https://www.optivra.app
* Documentation: https://www.optivra.app/docs/ai-image-studio
* Support: support@optivra.app
* Support page: https://www.optivra.app/support
* Privacy Policy: https://www.optivra.app/privacy
* Terms of Service: https://www.optivra.app/terms

Data sent to Optivra may include product IDs, product names, product image URLs, image slot information, categories, selected image processing settings, and selected SEO metadata fields. Optivra returns processed image URLs, credit usage information, and suggested SEO metadata.

After you connect your store with a Site API Token, Optivra Image Studio sends operational data required to provide the service, such as plugin version, WordPress/WooCommerce/PHP versions, store connection status, credit balance, scan counts, queue counts, processing status, and error diagnostics. This helps display account status, manage credits, process images, and provide support. The plugin does not send API tokens, passwords, order details, payment details, secret keys, or WordPress user lists as analytics data.

== Installation ==

1. Install and activate WooCommerce.
2. Upload the plugin zip from Plugins > Add New > Upload Plugin.
3. Activate "Optivra Image Studio for WooCommerce".
4. Go to WooCommerce > Optivra Image Studio.
5. Paste your Optivra Site API Token and click Connect.
6. Scan your catalogue, queue images, process selected images, then review and approve results.

If WooCommerce is not active, the plugin displays an admin notice and does not attempt to scan or process product images.

== Usage ==

1. Connect your store using the Site API Token from your Optivra account.
2. Open Scan Catalogue and choose the product images you want to optimise.
3. Add selected images to the queue.
4. Process queued images using your Optivra credits.
5. Review before and after previews.
6. Edit SEO filename, alt text, title, caption, or description if needed.
7. Approve images to import the processed file into the Media Library and replace the chosen WooCommerce image slot.

Scanning does not use credits. Credits are used when images are processed by Optivra Image Studio.

== Frequently Asked Questions ==

= Do I need an Optivra account? =

Yes. An Optivra account and Site API Token are required for image processing. The plugin uses credits from your Optivra account.

= What external service does this plugin use? =

The plugin connects to Optivra Image Studio at https://www.optivra.app. Selected product image data is sent only after you connect your Site API Token and start scanning or processing.

= Does the plugin process images inside WordPress? =

No. The plugin sends selected image URLs and related product context to Optivra's external service. Optivra processes the image and returns a processed image URL and SEO metadata suggestions.

= Does scanning use credits? =

No. Scanning finds existing WooCommerce product images. Credits are used when an image is processed.

= Are images replaced automatically? =

By default, no. Processed images wait in Review & Approve until an administrator approves them. Original images are kept for rollback where replacement history is available.

= Can I edit SEO metadata before approval? =

Yes. Filename, alt text, title, caption, and description suggestions can be edited before approval.

= Does the plugin include Stripe or Supabase secret keys? =

No. Billing is handled through Optivra-hosted pages and Stripe. The WordPress plugin does not include Stripe secret keys, Supabase service role keys, or Optivra backend secrets.

= What WooCommerce images are supported? =

The plugin scans featured product images and gallery images. Category thumbnails can be enabled from settings where supported.

= Where can I get support? =

Contact support@optivra.app or visit https://www.optivra.app/support.

== Screenshots ==

1. Settings and store connection screen.
2. Scan Catalogue screen with product image filters.
3. Queue screen for selected image jobs.
4. Review & Approve screen with before and after previews.
5. SEO metadata fields and credits display.

== Changelog ==

= 1.0.0 =
* Initial WordPress.org-ready release.
* Added Optivra account connection, product image scanning, queue workflow, review and approval, Media Library import, and product-aware SEO metadata generation.

== Upgrade Notice ==

= 1.0.0 =
Initial public release. An Optivra account and Site API Token are required for image processing.
