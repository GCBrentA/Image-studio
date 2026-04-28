# Developer hooks

Payment Gateway Rules for WooCommerce provides a small set of filters for developers.

## pgrfw_rule_context

Filters the checkout context before rules are evaluated.

```php
add_filter( 'pgrfw_rule_context', function ( $context ) {
	$context['custom_value'] = 'example';
	return $context;
} );
```

## pgrfw_rule_matches

Filters whether a rule matches.

```php
add_filter( 'pgrfw_rule_matches', function ( $matches, $rule, $context ) {
	return $matches;
}, 10, 3 );
```

## pgrfw_available_gateways_after_rules

Filters available gateways after saved rules have been applied.

```php
add_filter( 'pgrfw_available_gateways_after_rules', function ( $gateways, $context, $matched_rules ) {
	return $gateways;
}, 10, 3 );
```

These hooks should not be used to bypass gateway compliance requirements from your payment provider.
