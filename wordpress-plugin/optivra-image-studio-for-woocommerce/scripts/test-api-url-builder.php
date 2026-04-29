<?php
/**
 * Lightweight URL builder verification for the Optivra API client.
 *
 * Run from repo with:
 * php wordpress-plugin/optivra-image-studio-for-woocommerce/scripts/test-api-url-builder.php
 */

if (! defined('ABSPATH')) {
	define('ABSPATH', __DIR__ . '/');
}

if (! function_exists('wp_parse_url')) {
	function wp_parse_url(string $url, int $component = -1) {
		if (-1 === $component) {
			return parse_url($url);
		}

		return parse_url($url, $component);
	}
}

if (! function_exists('untrailingslashit')) {
	function untrailingslashit(string $text): string {
		return rtrim($text, '/');
	}
}

if (! function_exists('esc_url_raw')) {
	function esc_url_raw(string $url): string {
		return trim($url);
	}
}

require_once dirname(__DIR__) . '/includes/class-catalogue-image-studio-saas-client.php';

$cases = [
	[
		'base'     => 'https://www.optivra.app',
		'endpoint' => '/api/image-studio/audits/start',
		'expected' => 'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'base'     => 'https://www.optivra.app/api',
		'endpoint' => '/api/image-studio/audits/start',
		'expected' => 'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'base'     => 'https://www.optivra.app/api/',
		'endpoint' => 'image-studio/audits/start',
		'expected' => 'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'base'     => 'https://www.optivra.app/',
		'endpoint' => 'api/image-studio/audits/start',
		'expected' => 'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'base'     => 'https://www.optivra.app/api',
		'endpoint' => '/api/api/image-studio/audits/start',
		'expected' => 'https://www.optivra.app/api/image-studio/audits/start',
	],
];

$all_passed = true;
foreach ($cases as $case) {
	$base = (string) $case['base'];
	$endpoint = (string) $case['endpoint'];
	$expected = (string) $case['expected'];
	$result = Catalogue_Image_Studio_SaaSClient::build_api_url_for_base($base, $endpoint);
	if ($result === $expected && false === strpos($result, '/api/api/')) {
		echo 'PASS: ' . $endpoint . PHP_EOL;
		continue;
	}

	$all_passed  = false;
	echo 'FAIL: expected ' . $expected . ' got ' . $result . PHP_EOL;
}

if (! $all_passed) {
	exit(1);
}

echo 'All URL builder cases passed.' . PHP_EOL;
