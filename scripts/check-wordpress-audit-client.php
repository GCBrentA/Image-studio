<?php
declare(strict_types=1);

define('ABSPATH', __DIR__);
define('OPTIIMST_VERSION', 'test');

class WP_Error {
	private string $code;
	private string $message;
	private array $data;

	public function __construct(string $code = '', string $message = '', array $data = []) {
		$this->code = $code;
		$this->message = $message;
		$this->data = $data;
	}

	public function get_error_message(): string {
		return $this->message;
	}

	public function add_data(array $data): void {
		$this->data = array_merge($this->data, $data);
	}
}

class Optiimst_Logger {
	public function info(string $message, array $context = []): void {}
	public function warning(string $message, array $context = []): void {}
	public function error(string $message, array $context = []): void {}
}

$GLOBALS['optivra_test_options'] = [];

function esc_url_raw($url) { return (string) $url; }
function wp_parse_url($url) { return parse_url((string) $url); }
function untrailingslashit($value) { return rtrim((string) $value, '/'); }
function trailingslashit($value) { return rtrim((string) $value, '/') . '/'; }
function sanitize_text_field($value) { return is_scalar($value) ? trim((string) $value) : ''; }
function sanitize_textarea_field($value) { return is_scalar($value) ? trim((string) $value) : ''; }
function sanitize_key($value) { return strtolower(preg_replace('/[^a-z0-9_\-]/', '', (string) $value)); }
function wp_json_encode($value) { return json_encode($value); }
function is_wp_error($value): bool { return $value instanceof WP_Error; }
function __($text, $domain = null) { return $text; }
function get_option($key, $default = false) { return $GLOBALS['optivra_test_options'][$key] ?? $default; }
function update_option($key, $value, $autoload = null): bool { $GLOBALS['optivra_test_options'][$key] = $value; return true; }
function optiimst_get_option(string $option, $default = false) { return get_option($option, $default); }
function optiimst_update_option(string $option, $value, $autoload = null): bool { return update_option($option, $value, $autoload); }
function wp_generate_uuid4(): string { return getenv('OPTIVRA_TEST_INSTALL_ID') ?: 'audit-client-test-install'; }
function site_url(): string { return 'http://localhost'; }
function home_url(): string { return 'http://localhost'; }
function admin_url(): string { return 'http://localhost/wp-admin/'; }
function get_bloginfo($show = ''): string { return '6.6'; }

function optivra_test_http_request(string $method, string $url, array $args) {
	$headers = [];
	foreach (($args['headers'] ?? []) as $name => $value) {
		$headers[] = $name . ': ' . $value;
	}

	if (function_exists('curl_init')) {
		$handle = curl_init($url);
		curl_setopt($handle, CURLOPT_CUSTOMREQUEST, $method);
		curl_setopt($handle, CURLOPT_HTTPHEADER, $headers);
		curl_setopt($handle, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($handle, CURLOPT_TIMEOUT, (int) ($args['timeout'] ?? 30));
		if (isset($args['body'])) {
			curl_setopt($handle, CURLOPT_POSTFIELDS, (string) $args['body']);
		}
		$body = curl_exec($handle);
		if (false === $body) {
			$error = curl_error($handle);
			curl_close($handle);
			return new WP_Error('http_request_failed', $error ?: 'HTTP request failed');
		}
		$status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
		curl_close($handle);

		return [
			'response' => ['code' => $status],
			'body' => (string) $body,
		];
	}

	$context = stream_context_create([
		'http' => [
			'method' => $method,
			'header' => implode("\r\n", $headers),
			'content' => (string) ($args['body'] ?? ''),
			'ignore_errors' => true,
			'timeout' => (int) ($args['timeout'] ?? 30),
		],
	]);

	$body = @file_get_contents($url, false, $context);
	if (false === $body) {
		return new WP_Error('http_request_failed', 'HTTP request failed');
	}

	$status = 0;
	foreach (($http_response_header ?? []) as $header) {
		if (preg_match('#^HTTP/\S+\s+(\d{3})#', $header, $matches)) {
			$status = (int) $matches[1];
			break;
		}
	}

	return [
		'response' => ['code' => $status],
		'body' => $body,
	];
}

function wp_remote_get($url, array $args = []) { return optivra_test_http_request('GET', (string) $url, $args); }
function wp_remote_post($url, array $args = []) { return optivra_test_http_request('POST', (string) $url, $args); }
function wp_remote_retrieve_response_code($response): int { return (int) ($response['response']['code'] ?? 0); }
function wp_remote_retrieve_body($response): string { return (string) ($response['body'] ?? ''); }

require __DIR__ . '/../wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-saas-client.php';

$base = getenv('OPTIVRA_TEST_API_BASE_URL') ?: '';
$token = getenv('OPTIVRA_TEST_API_TOKEN') ?: '';
if ('' === $base || '' === $token) {
	fwrite(STDERR, "OPTIVRA_TEST_API_BASE_URL and OPTIVRA_TEST_API_TOKEN are required.\n");
	exit(1);
}

$client = new Optiimst_SaaSClient($base, $token, new Optiimst_Logger());
$usage = $client->get_usage();
if (is_wp_error($usage)) {
	fwrite(STDERR, "Usage failed: " . $usage->get_error_message() . "\n");
	exit(1);
}

$start = $client->start_image_audit('11111111-2222-4333-8444-555555555555', ['source' => 'php-client-test']);
if (is_wp_error($start)) {
	fwrite(STDERR, "Start failed: " . $start->get_error_message() . "\n");
	exit(1);
}

$scan_id = is_array($start) && isset($start['scan_id']) ? (string) $start['scan_id'] : '';
if ('' === $scan_id) {
	fwrite(STDERR, "Start did not return a scan_id.\n");
	exit(1);
}

$audit_items = [];
for ($i = 0; $i < 100; $i++) {
	$audit_items[] = [
		'product_id' => '1002-' . $i,
		'product_name' => 'PHP Client Test Product ' . $i,
		'product_url' => 'http://localhost/product/php-client-test-product-' . $i,
		'image_id' => '2002-' . $i,
		'image_url' => 'http://localhost/wp-content/uploads/php-client-test-product-' . $i . '.jpg',
		'image_role' => 0 === $i % 3 ? 'main' : 'gallery',
		'filename' => 'php-client-test-product-' . $i . '.jpg',
		'mime_type' => 'image/jpeg',
		'width' => 1200,
		'height' => 1200,
		'file_size_bytes' => 204800,
		'alt_text' => 0 === $i % 2 ? 'PHP client test product ' . $i : '',
	];
}

$items = $client->submit_image_audit_items($scan_id, $audit_items);
if (is_wp_error($items)) {
	fwrite(STDERR, "Items failed: " . $items->get_error_message() . "\n");
	exit(1);
}

$complete = $client->complete_image_audit($scan_id);
if (is_wp_error($complete)) {
	fwrite(STDERR, "Complete failed: " . $complete->get_error_message() . "\n");
	exit(1);
}

echo json_encode([
	'ok' => true,
	'usage_store_id' => $usage['store_id'] ?? null,
	'scan_id' => $scan_id,
	'status' => $complete['status'] ?? 'completed',
], JSON_PRETTY_PRINT) . "\n";
