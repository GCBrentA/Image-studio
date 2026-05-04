<?php
$cache = optiimst_get_option('optiimst_report_summary_cache', []);
$items = optiimst_get_option('optiimst_latest_audit_items', []);
$progress = optiimst_get_option('optiimst_scan_progress', []);
echo wp_json_encode(
	[
		'cache_keys' => is_array($cache) ? array_keys($cache) : [],
		'cache_latest_keys' => isset($cache['latest']) && is_array($cache['latest']) ? array_keys($cache['latest']) : [],
		'cache_latest_raw_keys' => isset($cache['latest']['raw']) && is_array($cache['latest']['raw']) ? array_keys($cache['latest']['raw']) : [],
		'cache_latest_products_count' => isset($cache['latest']['products']) && is_array($cache['latest']['products']) ? count($cache['latest']['products']) : null,
		'cache_latest_local_count' => isset($cache['latest']['_local_scan_items']) && is_array($cache['latest']['_local_scan_items']) ? count($cache['latest']['_local_scan_items']) : null,
		'cache_latest_raw_products_count' => isset($cache['latest']['raw']['products']) && is_array($cache['latest']['raw']['products']) ? count($cache['latest']['raw']['products']) : null,
		'cache_latest_raw_local_count' => isset($cache['latest']['raw']['_local_scan_items']) && is_array($cache['latest']['raw']['_local_scan_items']) ? count($cache['latest']['raw']['_local_scan_items']) : null,
		'items_keys' => is_array($items) ? array_keys($items) : [],
		'items_count' => isset($items['items']) && is_array($items['items']) ? count($items['items']) : null,
		'items_scan_id' => $items['scan_id'] ?? '',
		'progress' => is_array($progress) ? [
			'status' => $progress['status'] ?? '',
			'products_scanned' => $progress['products_scanned'] ?? null,
			'images_scanned' => $progress['images_scanned'] ?? null,
			'total_products' => $progress['total_products'] ?? null,
		] : [],
	]
);
