# WordPress.org Submission Notes

Plugin: Optivra Image Studio for WooCommerce

## Package Contents

The production plugin zip should contain only the plugin folder and runtime files:

- `catalogue-image-studio/`
- PHP plugin files
- `assets/admin.css`
- `readme.txt`
- `LICENSE`

Excluded from the release zip:

- `.git`
- `node_modules`
- local `.env` files
- logs
- repository tests
- backend source/build artifacts
- private API keys or service credentials

## External Service Disclosure

The plugin requires an Optivra account and Site API Token. It connects WooCommerce stores to Optivra's external image processing service.

When a user connects, tests the connection, scans, processes, or reviews images, selected product/image data may be sent to Optivra for background replacement, optimisation, SEO metadata generation, and review workflow support.

Service links used in the plugin/readme:

- Terms: https://www.optivra.app/terms
- Privacy: https://www.optivra.app/privacy
- Data Processing: https://www.optivra.app/docs/ai-image-studio
- Support: https://www.optivra.app/support

## SVN Structure

After WordPress.org approval, prepare the SVN repository as:

```text
trunk/
tags/
  1.0.0/
assets/
```

Initial release steps:

1. Commit plugin runtime files to `trunk/`.
2. Copy the same plugin files to `tags/1.0.0/`.
3. Commit WordPress.org graphics to `assets/`.
4. Confirm `readme.txt` has `Stable tag: 1.0.0`.
5. Confirm the plugin header has `Version: 1.0.0`.
6. Do not commit secrets, local configuration, logs, or backend credentials.

## Required Assets

Place these in the WordPress.org SVN `assets/` directory:

- `icon-128x128.png`
- `icon-256x256.png`
- `banner-772x250.png`
- `banner-1544x500.png`
- `screenshot-1.png`
- `screenshot-2.png`
- `screenshot-3.png`
- `screenshot-4.png`
- `screenshot-5.png`
- `screenshot-6.png`

## Final Review Checklist

- Clean install tested.
- WooCommerce inactive tested.
- WooCommerce active tested.
- API token connection tested.
- Scanning tested.
- Queue tested.
- Review and approve tested.
- No PHP warnings in `debug.log`.
- No browser console errors.
- External calls disclosed before connection.
- Forms are nonce-protected.
- Outputs are escaped.
- Inputs are sanitised.
