# How to show Stripe for international customers

This setup is useful when domestic customers use one gateway and international customers use Stripe.

1. Go to **WooCommerce > Gateway Rules**.
2. Add a rule named `Show Stripe for USD`.
3. Set **Match type** to `Active currency`.
4. Enter the currency codes that should use Stripe, such as `USD, EUR, GBP`.
5. Set **Action** to `Show only selected gateways`.
6. Select your Stripe gateway in **Target gateways**.
7. Save the rule.
8. Test checkout after switching your storefront to an international currency.

You can also use billing or shipping country rules instead of currency rules if that better matches your store setup.
