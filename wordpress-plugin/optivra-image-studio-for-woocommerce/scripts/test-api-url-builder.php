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
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- WordPress fallback for this standalone CLI script.
	function wp_parse_url(string $url, int $component = -1) {
		if (-1 === $component) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url -- Standalone fallback used when WordPress is not loaded.
			return parse_url($url);
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url -- Standalone fallback used when WordPress is not loaded.
		return parse_url($url, $component);
	}
}

if (! function_exists('untrailingslashit')) {
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- WordPress fallback for this standalone CLI script.
	function untrailingslashit(string $text): string {
		return rtrim($text, '/');
	}
}

if (! function_exists('esc_url_raw')) {
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- WordPress fallback for this standalone CLI script.
	function esc_url_raw(string $url): string {
		return trim($url);
	}
}

if (! function_exists('esc_html')) {
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- WordPress fallback for this standalone CLI script.
	function esc_html(string $text): string {
		return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
	}
}

require_once dirname(__DIR__) . '/includes/class-catalogue-image-studio-saas-client.php';

/**
 * Run the API URL builder smoke test.
 *
 * @return bool
 */
function optiimst_image_studio_run_api_url_builder_test(): bool {
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
		$base     = (string) $case['base'];
		$endpoint = (string) $case['endpoint'];
		$expected = (string) $case['expected'];
		$result   = Optiimst_SaaSClient::build_api_url_for_base($base, $endpoint);
		if ($result === $expected && false === strpos($result, '/api/api/')) {
			echo 'PASS: ' . esc_html($endpoint) . PHP_EOL;
			continue;
		}

		$all_passed = false;
		echo 'FAIL: expected ' . esc_html($expected) . ' got ' . esc_html($result) . PHP_EOL;
	}

	if ($all_passed) {
		echo 'All URL builder cases passed.' . PHP_EOL;
	}

	return $all_passed;
}

if (! optiimst_image_studio_run_api_url_builder_test()) {
	exit(1);
}
