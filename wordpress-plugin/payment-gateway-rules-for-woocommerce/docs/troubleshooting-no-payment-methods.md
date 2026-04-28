# Troubleshooting: no payment methods are showing

If checkout shows no payment methods, work through this list.

## 1. Check the safety fallback

The default fallback is **Restore all gateways**. This prevents a rule from accidentally hiding every payment gateway.

Go to **WooCommerce > Gateway Rules** and confirm the fallback setting is still enabled unless you intentionally changed it.

## 2. Check enabled WooCommerce gateways

Go to **WooCommerce > Settings > Payments** and confirm at least one payment gateway is enabled.

## 3. Check rule action

The action **Show only selected gateways** removes every gateway except the ones selected in that rule. Make sure the target gateway is installed and enabled.

## 4. Check country and currency values

Country codes should be two-letter ISO codes, such as `AU`, `US`, and `GB`.

Currency codes should be three-letter ISO codes, such as `AUD`, `USD`, and `GBP`.

## 5. Use the debug/test panel

The debug/test panel shows:

- billing country
- shipping country
- active currency
- cart total
- matched rules
- final visible gateways

Use those values to confirm the rule is matching what you expect.
