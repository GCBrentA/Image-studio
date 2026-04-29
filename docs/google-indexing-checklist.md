# Google Indexing Checklist

1. Open Google Search Console and add the `https://www.optivra.app` property.
2. Set `GOOGLE_SITE_VERIFICATION` in production, deploy, then verify the meta tag.
3. Submit `https://www.optivra.app/sitemap.xml`.
4. Confirm `https://www.optivra.app/robots.txt` references the sitemap and does not block public pages.
5. Use URL Inspection for important pages: home, Image Studio, pricing, downloads, docs, support, and core blog posts.
6. Request indexing after publishing or materially changing a page.
7. Check Page indexing for excluded URLs and confirm private pages such as `/admin`, `/dashboard`, `/account`, and checkout result pages remain noindexed.
8. Connect GA4 and Search Console under GA4 Admin so acquisition reports include organic search query data.
9. Review Search Console Performance weekly for queries with impressions but low CTR.
10. Improve titles/descriptions for pages with high impressions and low CTR, then inspect and request indexing again.

SEO checks already supported in the app:

- `sitemap.xml` exists.
- `robots.txt` references the sitemap.
- Public routes render canonical tags, titles, descriptions, Open Graph, and Twitter metadata.
- Private account, admin, and billing result pages render `noindex,nofollow`.
- Search Console verification renders only when `GOOGLE_SITE_VERIFICATION` is populated.

