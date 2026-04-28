=== Payment Gateway Rules for WooCommerce ===
Contributors: optivra
Tags: woocommerce, payments, payment gateways, checkout, rules
Requires at least: 6.3
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Show or hide WooCommerce payment gateways by country, currency, and cart total rules.

== Description ==

Payment Gateway Rules for WooCommerce is a free WooCommerce admin tool for controlling which payment gateways appear at checkout.

Create rules that show or hide installed WooCommerce payment gateways based on:

* Customer billing country
* Customer shipping country
* Active store currency
* Cart total conditions
* One or more selected payment gateways
* Rule priority/order

The plugin is designed for store owners who need practical checkout control without custom code. It works with installed WooCommerce payment gateways such as Stripe, PayPal, WooPayments, Square, bank transfer, cheque, and cash on delivery, depending on the gateways active on your store.

= Free plugin, no account required =

This is a complete free plugin. It does not require an external account, does not make external API calls, does not include telemetry, and does not send store data to Optivra or any third party.

= Safety fallback =

If a misconfigured rule would hide every available payment gateway, the default safety setting restores all gateways so checkout is not accidentally broken. Store owners can change this behaviour and show an admin-only warning instead.

= Debug/test panel =

The admin page includes a diagnostic panel showing detected billing country, shipping country, currency, cart total, matched rules, and final visible gateways.

== Installation ==

1. Upload the plugin ZIP through Plugins > Add New > Upload Plugin.
2. Activate the plugin.
3. Make sure WooCommerce is installed and active.
4. Go to WooCommerce > Gateway Rules.
5. Create your first rule and save.
6. Test checkout with the countries, currencies, cart totals, and payment gateways you use.

== Frequently Asked Questions ==

= Does this plugin connect to an external service? =

No. Payment Gateway Rules for WooCommerce runs inside WordPress and WooCommerce. It does not make external API calls and does not send telemetry.

= Does it work if WooCommerce is inactive? =

The plugin activates without a fatal error and shows an admin notice. Rules only run when WooCommerce is active.

= What happens if my rules hide all payment gateways? =

By default, the plugin restores all gateways to protect checkout. You can change the fallback setting to keep gateways hidden and show an admin-only warning.

= Can I show Square only for Australia? =

Yes. Create a billing or shipping country rule for AU, select Square as the target gateway, and choose "Show only selected gateways".

= Can I hide a gateway for high-value carts? =

Yes. Create a cart total rule, choose greater than, enter the amount, select the gateway, and choose "Hide selected gateways".

= Does it support multi-currency plugins? =

The plugin reads the active WooCommerce currency using WooCommerce APIs. Compatibility depends on whether your currency plugin correctly updates WooCommerce's active currency.

== Screenshots ==

1. Rules list and safety settings.
2. Create/edit rule controls.
3. Debug/test panel.
4. Checkout example with filtered gateways.

== Changelog ==

= 1.0.0 =
* Initial public release.
* Add billing country, shipping country, currency, and cart total gateway rules.
* Add safe all-hidden fallback.
* Add debug/test panel.
* Add uninstall cleanup option.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
