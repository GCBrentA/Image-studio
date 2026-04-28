# How to show Square only for Australia

Use this recipe when Australian customers should see Square, while other customers see different gateways.

1. Go to **WooCommerce > Gateway Rules**.
2. Add a new rule named `Show Square for Australia`.
3. Set **Enabled** to on.
4. Set **Match type** to `Billing country` or `Shipping country`.
5. Select `Australia (AU)` in **Countries**.
6. Set **Action** to `Show only selected gateways`.
7. Select your Square gateway in **Target gateways**.
8. Set priority to `10`.
9. Save the rule.
10. Test checkout using an Australian billing or shipping address.

If you also need a separate international rule, create a second rule that matches the relevant countries or currencies and shows your international gateway.
