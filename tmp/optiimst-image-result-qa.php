<?php
$plugin = Optiimst_Plugin::instance();
$settings = $plugin->get_settings();

function optiimst_qa_find_queueable_item(Optiimst_Plugin $plugin): array {
	for ($offset = 0; $offset < 200; $offset += 25) {
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
				return $item;
			}
		}
	}

	return [];
}

function optiimst_qa_image_stats(string $file): array {
	$stats = [
		'exists' => file_exists($file),
		'file' => $file,
		'bytes' => file_exists($file) ? filesize($file) : 0,
		'width' => 0,
		'height' => 0,
		'mime' => '',
		'avg_luma' => null,
		'luma_stddev' => null,
	];

	if (! $stats['exists']) {
		return $stats;
	}

	$size = @getimagesize($file);
	if (is_array($size)) {
		$stats['width'] = (int) ($size[0] ?? 0);
		$stats['height'] = (int) ($size[1] ?? 0);
		$stats['mime'] = (string) ($size['mime'] ?? '');
	}

	if (! function_exists('imagecreatefromstring')) {
		return $stats;
	}

	$data = file_get_contents($file);
	$image = is_string($data) ? @imagecreatefromstring($data) : false;
	if (! $image) {
		return $stats;
	}

	$width = imagesx($image);
	$height = imagesy($image);
	$step_x = max(1, (int) floor($width / 64));
	$step_y = max(1, (int) floor($height / 64));
	$count = 0;
	$sum = 0.0;
	$sum_sq = 0.0;

	for ($y = 0; $y < $height; $y += $step_y) {
		for ($x = 0; $x < $width; $x += $step_x) {
			$rgb = imagecolorat($image, $x, $y);
			$r = ($rgb >> 16) & 0xFF;
			$g = ($rgb >> 8) & 0xFF;
			$b = $rgb & 0xFF;
			$luma = (0.2126 * $r) + (0.7152 * $g) + (0.0722 * $b);
			$sum += $luma;
			$sum_sq += $luma * $luma;
			$count++;
		}
	}

	imagedestroy($image);

	if ($count > 0) {
		$avg = $sum / $count;
		$variance = max(0, ($sum_sq / $count) - ($avg * $avg));
		$stats['avg_luma'] = round($avg, 2);
		$stats['luma_stddev'] = round(sqrt($variance), 2);
	}

	return $stats;
}

function optiimst_qa_build_options(array $settings, array $job, array $scenario): array {
	$strict = ! empty($scenario['strict']);
	$background_preset = (string) ($scenario['background_preset'] ?? 'optivra-default');
	$scale_mode = (string) ($scenario['scale_mode'] ?? 'auto');
	$shadow_mode = (string) ($scenario['shadow_mode'] ?? 'under');
	$lighting_mode = (string) ($scenario['lighting_mode'] ?? 'auto');
	$processing_mode = (string) ($scenario['processing_mode'] ?? 'seo_product_feed_preserve');

	if (! $strict && 'seo_product_feed_preserve' === $processing_mode) {
		$processing_mode = 'standard_ecommerce_cleanup';
	}

	$options = [
		'background' => $background_preset,
		'settings' => [
			'preserveProductExactly' => $strict,
			'preserveProductIntent' => $strict,
			'preserveFallbackFromStrictMode' => false,
			'processingMode' => $processing_mode,
			'promptVersion' => 'ecommerce_preserve_v2',
			'autoFailIfProductAltered' => $strict,
			'autoFixCropSpacing' => true,
			'preserveDarkDetail' => $strict,
			'requireReviewBeforeReplace' => true,
			'auditReportSource' => true,
			'auditActionType' => (string) ($job['audit_action_type'] ?? 'replace_background'),
			'maxRetries' => 2,
			'output' => [
				'size' => 1024,
				'aspectRatio' => '1:1',
			],
			'background' => [
				'source' => 'preset',
				'preset' => $background_preset,
				'customBackgroundUrl' => null,
				'customBackgroundId' => null,
			],
			'framing' => [
				'mode' => $scale_mode,
				'smartScaling' => true,
				'padding' => 8,
				'targetCoverage' => 86,
				'useTargetCoverage' => false,
				'preserveTransparentEdges' => ! empty($settings['preserve_transparent_edges']),
			],
			'shadow' => [
				'mode' => $shadow_mode,
				'strength' => 'medium',
				'opacity' => 23,
				'blur' => 22,
				'offsetX' => 0,
				'offsetY' => 0,
				'spread' => 100,
				'softness' => 60,
				'color' => '#000000',
			],
			'lighting' => [
				'enabled' => true,
				'mode' => $lighting_mode,
				'brightness' => 0,
				'contrast' => 0,
				'highlightRecovery' => true,
				'shadowLift' => true,
				'neutralizeTint' => true,
				'strength' => 'medium',
			],
			'seo' => [
				'generateFilename' => true,
				'generateAltText' => true,
				'generateTitle' => true,
				'generateCaption' => true,
				'generateDescription' => true,
				'onlyFillMissing' => true,
				'overrideExisting' => false,
				'brandKeywordSuffix' => '',
			],
		],
		'job_overrides' => [
			'edgeToEdge' => [
				'enabled' => false,
				'left' => false,
				'right' => false,
				'top' => false,
				'bottom' => false,
			],
		],
	];

	if ('auto' !== $scale_mode) {
		$scale_map = [
			'tight' => 92,
			'balanced' => 86,
			'loose' => 78,
			'close-up' => 96,
			'wide' => 72,
			'tall' => 82,
		];
		if (isset($scale_map[$scale_mode])) {
			$options['scale_percent'] = $scale_map[$scale_mode];
		}
	}

	return $options;
}

$item = optiimst_qa_find_queueable_item($plugin);
if (empty($item)) {
	echo wp_json_encode(['ok' => false, 'error' => 'No queueable image found.']);
	return;
}

$job_id = $plugin->jobs()->queue_from_audit_payload($item);
$job = $plugin->jobs()->find($job_id);
$source_attachment_id = (int) ($job['attachment_id'] ?? 0);
$source_file = (string) get_attached_file($source_attachment_id);

$scenarios = [
	[
		'id' => 'strict_on_preserve_white_auto',
		'strict' => true,
		'processing_mode' => 'seo_product_feed_preserve',
		'background_preset' => 'white',
		'scale_mode' => 'auto',
		'shadow_mode' => 'under',
		'lighting_mode' => 'product-only',
	],
	[
		'id' => 'strict_off_standard_softwhite_balanced',
		'strict' => false,
		'processing_mode' => 'standard_ecommerce_cleanup',
		'background_preset' => 'soft-white',
		'scale_mode' => 'balanced',
		'shadow_mode' => 'behind',
		'lighting_mode' => 'whole-image',
	],
	[
		'id' => 'strict_on_premium_cool_tight',
		'strict' => true,
		'processing_mode' => 'premium_studio_background',
		'background_preset' => 'cool-studio',
		'scale_mode' => 'tight',
		'shadow_mode' => 'under',
		'lighting_mode' => 'auto',
	],
	[
		'id' => 'strict_off_premium_warm_wide',
		'strict' => false,
		'processing_mode' => 'premium_studio_background',
		'background_preset' => 'warm-studio',
		'scale_mode' => 'wide',
		'shadow_mode' => 'behind',
		'lighting_mode' => 'auto',
	],
];

$results = [];
foreach ($scenarios as $scenario) {
	$job = $plugin->jobs()->find($job_id);
	$options = optiimst_qa_build_options($settings, $job ?: [], $scenario);
	$result = $plugin->processor()->process($job_id, $options);
	$updated = $plugin->jobs()->find($job_id);

	if (is_wp_error($result)) {
		$results[] = [
			'id' => $scenario['id'],
			'ok' => false,
			'error_code' => $result->get_error_code(),
			'error_message' => $result->get_error_message(),
			'job' => $updated,
		];
		continue;
	}

	$processed_attachment_id = (int) ($updated['processed_attachment_id'] ?? 0);
	$processed_file = $processed_attachment_id ? (string) get_attached_file($processed_attachment_id) : '';
	$safety = optiimst_get_preservation_safety(is_array($updated) ? $updated : []);
	$diagnostics = [];
	if (! empty($updated['processing_diagnostics'])) {
		$decoded = json_decode((string) $updated['processing_diagnostics'], true);
		$diagnostics = is_array($decoded) ? $decoded : [];
	}

	$results[] = [
		'id' => $scenario['id'],
		'ok' => true,
		'scenario' => $scenario,
		'job_id' => $job_id,
		'processed_attachment_id' => $processed_attachment_id,
		'processed_file' => $processed_file,
		'processing_mode_recorded' => (string) ($updated['processing_mode'] ?? ''),
		'safety_status' => (string) ($updated['safety_status'] ?? ''),
		'safety_label' => (string) ($safety['label'] ?? ''),
		'safety_blocking' => ! empty($safety['blocking']),
		'safety_requires_review' => ! empty($safety['requires_review']),
		'validation' => $diagnostics['output_validation'] ?? $diagnostics['outputValidation'] ?? [],
		'preserve_debug' => $diagnostics['preserve_debug'] ?? $diagnostics['preserveDebug'] ?? [],
		'stats' => optiimst_qa_image_stats($processed_file),
	];
}

echo wp_json_encode(
	[
		'ok' => true,
		'source' => [
			'product_id' => (int) ($item['product_id'] ?? 0),
			'attachment_id' => $source_attachment_id,
			'file' => $source_file,
			'stats' => optiimst_qa_image_stats($source_file),
		],
		'results' => $results,
	],
	JSON_PRETTY_PRINT
);
