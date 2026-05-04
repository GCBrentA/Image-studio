<?php
global $wpdb;

$plugin = Optiimst_Plugin::instance();
$table = optiimst_table_name();
$exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
$columns = $exists ? $wpdb->get_results("DESCRIBE {$table}", ARRAY_A) : [];
$first = [];
for ($offset = 0; $offset < 100; $offset += 25) {
	$batch = $plugin->scanner()->collect_audit_batch(
		[
			'scan_scope'                  => 'all',
			'include_main_images'         => true,
			'include_gallery_images'      => true,
			'include_variation_images'    => true,
			'include_category_thumbnails' => true,
			'scan_limit'                  => 25,
		],
		$offset,
		25
	);
	foreach (($batch['items'] ?? []) as $item) {
		if (is_array($item) && ! empty($item['product_id']) && ! empty($item['image_id'])) {
			$first = $item;
			break 2;
		}
	}
}
$job_id = $first ? $plugin->jobs()->queue_from_audit_payload($first) : 0;

echo wp_json_encode(
	[
		'table'      => $table,
		'exists'     => (bool) $exists,
		'columns'    => array_map(static function ($row) {
			return $row['Field'] ?? '';
		}, is_array($columns) ? $columns : []),
		'first'      => [
			'product_id' => $first['product_id'] ?? null,
			'image_id'   => $first['image_id'] ?? null,
			'image_role' => $first['image_role'] ?? null,
			'gallery_index' => $first['gallery_index'] ?? null,
		],
		'job_id'     => $job_id,
		'last_error' => $wpdb->last_error,
	]
);
