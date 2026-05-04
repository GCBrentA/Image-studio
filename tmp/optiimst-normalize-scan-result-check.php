<?php
$plugin = Optiimst_Plugin::instance();
$admin = new Optiimst_Admin($plugin);
$cache = optiimst_get_option('optiimst_report_summary_cache', []);
$latest = isset($cache['latest']) && is_array($cache['latest']) ? $cache['latest'] : [];
$get_payload = new ReflectionMethod(Optiimst_Admin::class, 'get_report_payload');
$get_payload->setAccessible(true);
$normalize = new ReflectionMethod(Optiimst_Admin::class, 'normalize_scan_result');
$normalize->setAccessible(true);
$payload = $get_payload->invoke($admin, $latest);
$result = $normalize->invoke($admin, $payload, $latest);
$products = isset($result['products']) && is_array($result['products']) ? $result['products'] : [];
echo wp_json_encode(
	[
		'payload_keys' => is_array($payload) ? array_keys($payload) : [],
		'payload_products' => isset($payload['products']) && is_array($payload['products']) ? count($payload['products']) : null,
		'payload_local' => isset($payload['_local_scan_items']) && is_array($payload['_local_scan_items']) ? count($payload['_local_scan_items']) : null,
		'normalized_products' => count($products),
		'first' => $products[0] ?? null,
	]
);
