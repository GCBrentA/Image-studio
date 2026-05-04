<?php
$plugin = Optiimst_Plugin::instance();
$settings = $plugin->get_settings();
$count = $plugin->scanner()->count_audit_products(['scan_limit' => 5]);
$items = [];
for ($offset = 0; $offset < 100; $offset += 25) {
	$batch = $plugin->scanner()->collect_audit_batch(
		[
			'scan_scope'                  => 'all',
			'include_main_images'         => true,
			'include_gallery_images'      => true,
			'include_variation_images'    => true,
			'include_category_thumbnails' => true,
			'checks'                      => ['seo', 'performance', 'consistency'],
			'scan_limit'                  => 25,
		],
		$offset,
		25
	);
	$items = array_merge($items, isset($batch['items']) && is_array($batch['items']) ? $batch['items'] : []);
	if (! empty($items)) {
		$queueable = array_filter(
			$items,
			static function ($item): bool {
				return is_array($item) && ! empty($item['product_id']) && ! empty($item['image_id']);
			}
		);
		if (! empty($queueable)) {
			break;
		}
	}
}
$queued_id = 0;
foreach ($items as $item) {
	if (! is_array($item)) {
		continue;
	}
	$payload = isset($item['queuePayload']) && is_array($item['queuePayload']) ? $item['queuePayload'] : [];
	if (empty($payload) && ! empty($item['product_id']) && ! empty($item['image_id'])) {
		$payload = $item;
	}
	if (! empty($payload['product_id']) && ! empty($payload['image_id'])) {
		$queued_id = $plugin->jobs()->queue_from_audit_payload($payload);
		break;
	}
}

$queued_jobs = $plugin->jobs()->query(['status' => 'queued'], 5, 0);
$client = new Optiimst_SaaSClient('', '', new Optiimst_Logger());
$usage = $client->get_usage();

echo wp_json_encode(
	[
		'settings_loaded'    => is_array($settings) && isset($settings['api_base_url']),
		'audit_product_count'=> $count,
		'audit_items'        => count($items),
		'queued_job_id'      => $queued_id,
		'queued_count'       => count($queued_jobs),
		'no_token_graceful'  => is_wp_error($usage),
		'no_token_code'      => is_wp_error($usage) ? $usage->get_error_code() : '',
	]
);
