<?php
declare(strict_types=1);

define('ABSPATH', __DIR__);

if (! function_exists('esc_url_raw')) {
	function esc_url_raw($url) {
		return (string) $url;
	}
}

if (! function_exists('wp_parse_url')) {
	function wp_parse_url($url) {
		return parse_url((string) $url);
	}
}

if (! function_exists('untrailingslashit')) {
	function untrailingslashit($value) {
		return rtrim((string) $value, '/');
	}
}

require __DIR__ . '/../wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-saas-client.php';

$cases = [
	[
		'https://www.optivra.app/',
		'/api/image-studio/audits/start',
		'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'https://www.optivra.app/api',
		'/api/image-studio/audits/start',
		'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'https://www.optivra.app/api/',
		'api/image-studio/audits/start',
		'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'https://www.optivra.app',
		'api/image-studio/audits/start',
		'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'https://www.optivra.app/api',
		'/usage',
		'https://www.optivra.app/api/usage',
	],
	[
		'https://www.optivra.app/api/image-studio',
		'/api/image-studio/audits/start',
		'https://www.optivra.app/api/image-studio/audits/start',
	],
	[
		'https://www.optivra.app/api/image-studio/',
		'audits/start',
		'https://www.optivra.app/api/image-studio/audits/start',
	],
];

foreach ($cases as [$base, $endpoint, $expected]) {
	$actual = Catalogue_Image_Studio_SaaSClient::build_api_url_for_base($base, $endpoint);
	if ($actual !== $expected) {
		fwrite(STDERR, sprintf("URL assertion failed\nBase: %s\nEndpoint: %s\nExpected: %s\nActual: %s\n", $base, $endpoint, $expected, $actual));
		exit(1);
	}
	if (false !== strpos($actual, '/api/api/')) {
		fwrite(STDERR, sprintf("Duplicated /api/api detected: %s\n", $actual));
		exit(1);
	}
}

$token = 'cis_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO';
$token_cases = [
	$token,
	"New site token for jarvis-test.local:\n" . $token . "\n\nCopy this token now.",
	'  ' . $token . '  ',
];

foreach ($token_cases as $token_case) {
	$actual = Catalogue_Image_Studio_SaaSClient::normalize_api_token($token_case);
	if ($actual !== $token) {
		fwrite(STDERR, sprintf("Token normalisation assertion failed\nExpected: %s\nActual: %s\n", $token, $actual));
		exit(1);
	}
}

echo "WordPress plugin API URL checks passed.\n";
