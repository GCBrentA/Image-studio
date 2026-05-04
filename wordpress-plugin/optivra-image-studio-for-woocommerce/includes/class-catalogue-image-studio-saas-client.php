<?php
/**
 * Client for the external image processing backend.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Optiimst_SaaSClient {
	private string $api_base_url;

	private string $api_token;

	private Optiimst_Logger $logger;

	public function __construct(string $api_base_url, string $api_token, Optiimst_Logger $logger) {
		$this->api_base_url = self::normalize_api_base_url($api_base_url);
		$this->api_token    = self::normalize_api_token($api_token);
		$this->logger       = $logger;
	}

	public static function normalize_api_token(string $api_token): string {
		$token = trim($api_token);
		if (preg_match('/cis_[A-Za-z0-9_-]{20,}/', $token, $matches)) {
			return (string) $matches[0];
		}

		return $token;
	}

	/**
	 * Safely join the configured API base URL and an endpoint path.
	 *
	 * The recommended base URL is the site origin, for example https://www.optivra.app.
	 * This helper also supports older overrides that include /api without creating /api/api.
	 */
	public static function normalize_api_base_url(string $api_base_url): string {
		$base = self::strip_trailing_api_segment(trim(esc_url_raw($api_base_url)));

		if ('' === $base) {
			return '';
		}

		$base_parts = wp_parse_url($base);
		if (false === $base_parts || empty($base_parts['scheme']) || empty($base_parts['host'])) {
			return untrailingslashit($base);
		}

		$base_path = isset($base_parts['path']) ? (string) $base_parts['path'] : '';
		$base_path = strtolower(trim($base_path, '/'));
		if ('' !== $base_path) {
			$segments = array_values(array_filter(explode('/', $base_path), 'strlen'));
			$api_index = array_search('api', $segments, true);
			if (false !== $api_index) {
				$segments = array_slice($segments, 0, (int) $api_index);
			}
			$base_path = '' === implode('/', $segments) ? '' : '/' . implode('/', $segments);
		}

		$normalized_base = $base_parts['scheme'] . '://' . $base_parts['host'];
		if (isset($base_parts['port']) && '' !== (string) $base_parts['port']) {
			$normalized_base .= ':' . (string) $base_parts['port'];
		}

		return untrailingslashit($normalized_base . $base_path);
	}

	public static function is_local_api_base_url(string $api_base_url): bool {
		$base = self::normalize_api_base_url($api_base_url);
		if ('' === $base) {
			return false;
		}

		$parts = wp_parse_url($base);
		if (false === $parts || empty($parts['host'])) {
			return false;
		}

		$host = strtolower((string) $parts['host']);

		return 'localhost' === $host || '::1' === $host || 0 === strpos($host, '127.');
	}

	public static function build_api_url_for_base(string $api_base_url, string $endpoint): string {
		$base = self::normalize_api_base_url($api_base_url);
		$base = untrailingslashit(trim($base));
		$base_api_tail = self::get_api_base_api_tail($api_base_url);

		$endpoint = trim((string) $endpoint);
		$endpoint_parts = wp_parse_url($endpoint);
		$endpoint_path = isset($endpoint_parts['path']) ? (string) $endpoint_parts['path'] : '';
		$query = isset($endpoint_parts['query']) ? '?' . trim((string) $endpoint_parts['query']) : '';
		$fragment = isset($endpoint_parts['fragment']) ? '#' . trim((string) $endpoint_parts['fragment']) : '';

		$normalized_endpoint_path = self::normalize_api_endpoint_path($endpoint_path);
		$endpoint_segments = array_values(array_filter(explode('/', trim($normalized_endpoint_path, '/')), 'strlen'));
		if (! empty($base_api_tail) && array_slice($endpoint_segments, 0, count($base_api_tail)) === $base_api_tail) {
			$endpoint_segments = array_slice($endpoint_segments, count($base_api_tail));
		}
		$final_segments = array_merge(['api'], $base_api_tail, $endpoint_segments);
		$final_path = '/' . implode('/', $final_segments) . $query . $fragment;

		if ('' === $base) {
			return $final_path;
		}

		return $base . $final_path;
	}

	/**
	 * Return path segments that were configured after /api in older API base URLs.
	 *
	 * This keeps legacy overrides such as https://www.optivra.app/api/image-studio
	 * working without creating /api/image-studio/api/image-studio.
	 *
	 * @return array<int,string>
	 */
	private static function get_api_base_api_tail(string $api_base_url): array {
		$base = trim(esc_url_raw($api_base_url));
		if ('' === $base) {
			return [];
		}

		$base_parts = wp_parse_url($base);
		if (false === $base_parts || empty($base_parts['path'])) {
			return [];
		}

		$segments = array_values(array_filter(explode('/', strtolower(trim((string) $base_parts['path'], '/'))), 'strlen'));
		$api_index = array_search('api', $segments, true);
		if (false === $api_index) {
			return [];
		}

		$tail = array_slice($segments, (int) $api_index + 1);
		while (! empty($tail) && 'api' === $tail[0]) {
			array_shift($tail);
		}

		return $tail;
	}

	private function normalize_request_url(string $path, string $method): string {
		$url = $this->build_api_url($path);
		if (! self::has_duplicate_api_segment($url)) {
			return $url;
		}

		$before = $url;
		$url = self::normalize_api_url_string($url);
		if (self::has_duplicate_api_segment($url)) {
			$this->logger->error(
				'Optivra API URL normalisation could not remove duplicate /api segment.',
				[
					'method'        => strtoupper($method),
					'endpoint_path' => $path,
					'original_url'  => $before,
				]
			);
			return $before;
		}

		$this->logger->warning(
			'Optivra API URL normalized to remove duplicate /api segment.',
			[
				'method'           => strtoupper($method),
				'endpoint_path'    => $path,
				'base_url'         => $this->api_base_url,
				'original_url'     => $before,
				'normalized_url'   => $url,
				'auth_token_present' => '' !== $this->api_token,
			]
		);

		return $url;
	}

	private static function has_duplicate_api_segment(string $url): bool {
		$parts = wp_parse_url($url);
		if (! is_array($parts) || empty($parts['path'])) {
			return false;
		}

		$path = (string) $parts['path'];
		$segments = array_values(array_filter(explode('/', strtolower(trim((string) $path, '/'))), 'strlen'));
		if (count($segments) < 2) {
			return false;
		}

		return 'api' === $segments[0] && 'api' === $segments[1];
	}

	private static function normalize_api_endpoint_path(string $endpoint_path): string {
		$endpoint_path = preg_replace('#/+#', '/', '/' . ltrim((string) $endpoint_path, '/'));
		$segments = array_values(array_filter(explode('/', trim((string) $endpoint_path, '/')), 'strlen'));
		while (! empty($segments) && 'api' === strtolower((string) $segments[0])) {
			array_shift($segments);
		}
		if (empty($segments)) {
			return '';
		}

		return '/' . implode('/', $segments);
	}

	private static function normalize_api_url_string(string $url): string {
		$parts = wp_parse_url($url);
		if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
			return str_replace('/api/api/', '/api/', preg_replace('#/api/api$#', '/api', $url));
		}

		$path = isset($parts['path']) ? (string) $parts['path'] : '';
		$path = self::normalize_api_base_path_and_api_segment($path);

		$normalized = $parts['scheme'] . '://' . $parts['host'];
		if (isset($parts['port']) && '' !== (string) $parts['port']) {
			$normalized .= ':' . (string) $parts['port'];
		}
		$normalized .= $path;
		if (isset($parts['query']) && '' !== (string) $parts['query']) {
			$normalized .= '?' . (string) $parts['query'];
		}
		if (isset($parts['fragment']) && '' !== (string) $parts['fragment']) {
			$normalized .= '#' . (string) $parts['fragment'];
		}

		return $normalized;
	}

	private static function normalize_api_base_path_and_api_segment(string $path): string {
		$path = self::strip_double_slashes((string) $path);
		$segments = array_values(array_filter(explode('/', trim((string) $path, '/')), 'strlen'));
		if (empty($segments)) {
			return '/api';
		}

		// Ensure we keep non-API base path segments while collapsing duplicated API prefixes.
		if ('api' === strtolower((string) $segments[0])) {
			while (! empty($segments) && 'api' === strtolower((string) $segments[0])) {
				array_shift($segments);
			}
			array_unshift($segments, 'api');
		}

		return '/' . implode('/', $segments);
	}

	private static function strip_double_slashes(string $path): string {
		return (string) preg_replace('#/+#', '/', '/' . ltrim((string) $path, '/'));
	}

	private static function strip_trailing_api_segment(string $value): string {
		$value = untrailingslashit(trim($value));
		if ('' === $value) {
			return '';
		}

		while ('/api' === strtolower(substr($value, -4))) {
			$value = substr($value, 0, -4);
			$value = untrailingslashit($value);
		}

		return $value;
	}

	/**
	 * Send an image URL to the backend for processing.
	 *
	 * @param string              $image_url Image URL.
	 * @param array<string,mixed> $options Options.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function process_image(string $image_url, array $options = []) {
		if ('' === $this->api_base_url || '' === $this->api_token) {
			return new WP_Error(
				'optiimst_missing_api_settings',
				__('Paste your Site API Token to connect this store.', 'optivra-image-studio-for-woocommerce')
			);
		}

		$url = $this->normalize_request_url('/images/process', 'POST');
		$response = wp_remote_post(
			$url,
			[
				'timeout' => 240,
				'headers' => [
					'Authorization' => 'Bearer ' . $this->api_token,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
				] + $this->get_site_headers(),
				'body'    => wp_json_encode(
					array_filter(
						[
							'image_url'      => $image_url,
							'image_data'     => $options['image_data'] ?? null,
							'image_filename' => $options['image_filename'] ?? null,
							'image_mime_type' => $options['image_mime_type'] ?? null,
							'background'     => $options['background'] ?? null,
							'scale_percent'  => $options['scale_percent'] ?? null,
							'background_image_url' => $options['background_image_url'] ?? null,
							'background_image_data' => $options['background_image_data'] ?? null,
							'background_image_filename' => $options['background_image_filename'] ?? null,
							'background_image_mime_type' => $options['background_image_mime_type'] ?? null,
							'settings'       => $options['settings'] ?? null,
							'jobOverrides'   => $options['job_overrides'] ?? null,
						],
						static function ($value): bool {
							return null !== $value && '' !== $value;
						}
					)
				),
			]
		);
		$this->log_http_request('POST', $url, is_wp_error($response) ? null : (int) wp_remote_retrieve_response_code($response));

		if (is_wp_error($response)) {
			$this->logger->error('Image processing API request failed.', ['message' => $response->get_error_message()]);
			return $response;
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		$body        = (string) wp_remote_retrieve_body($response);
		$decoded     = json_decode($body, true);

		if (! is_array($decoded)) {
			return new WP_Error(
				'optiimst_invalid_api_response',
				sprintf(
					/* translators: 1: status code, 2: API base URL */
					__('The image processing API returned an unexpected response (HTTP %1$d) from %2$s. Check the API Base URL in Advanced Settings.', 'optivra-image-studio-for-woocommerce'),
					$status_code,
					$this->api_base_url
				)
			);
		}

		if ($status_code < 200 || $status_code >= 300) {
			$message = $this->get_error_message($decoded, __('Image processing failed.', 'optivra-image-studio-for-woocommerce'));
			$error_data = ['status_code' => $status_code];
			if (isset($decoded['preserve_debug']) && is_array($decoded['preserve_debug'])) {
				$error_data['preserve_debug'] = $decoded['preserve_debug'];
			}
			return new WP_Error('optiimst_api_error', $message, $error_data);
		}

		if (empty($decoded['processed_url'])) {
			return new WP_Error('optiimst_missing_processed_url', __('The image processing API did not return a processed image URL.', 'optivra-image-studio-for-woocommerce'));
		}

		if (! empty($decoded['processed_url']) && is_string($decoded['processed_url'])) {
			$decoded['processed_url'] = $this->normalize_processed_url($decoded['processed_url']);
		}

		return $decoded;
	}

	/**
	 * Get account usage for the configured site token.
	 *
	 * @return array<string,mixed>|\WP_Error
	 */
	public function get_usage() {
		if ('' === $this->api_base_url || '' === $this->api_token) {
			return new WP_Error(
				'optiimst_missing_api_settings',
				__('Paste your Site API Token to connect this store.', 'optivra-image-studio-for-woocommerce')
			);
		}

		$url = $this->normalize_request_url('/usage', 'GET');
		$response = wp_remote_get(
			$url,
			[
				'timeout' => 20,
				'headers' => [
					'Authorization' => 'Bearer ' . $this->api_token,
					'Accept'        => 'application/json',
				] + $this->get_site_headers(),
			]
		);
		$this->log_http_request('GET', $url, is_wp_error($response) ? null : (int) wp_remote_retrieve_response_code($response));

		if (is_wp_error($response)) {
			$this->logger->error('Usage API request failed.', ['message' => $response->get_error_message()]);
			return $response;
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		$body        = (string) wp_remote_retrieve_body($response);
		$decoded     = json_decode($body, true);

		if (! is_array($decoded)) {
			return new WP_Error(
				'optiimst_invalid_api_response',
				sprintf(
					/* translators: 1: status code, 2: API base URL */
					__('The image processing API returned an unexpected response (HTTP %1$d) from %2$s. Check the API Base URL in Advanced Settings.', 'optivra-image-studio-for-woocommerce'),
					$status_code,
					$this->api_base_url
				)
			);
		}

		if ($status_code < 200 || $status_code >= 300) {
			$message = $this->get_error_message($decoded, __('Connection test failed.', 'optivra-image-studio-for-woocommerce'));
			return new WP_Error('optiimst_api_error', $message, ['status_code' => $status_code]);
		}

		return $decoded;
	}

	/**
	 * Start a free Product Image Health Report audit scan.
	 *
	 * @param string              $store_id Store identifier returned by the backend usage endpoint, when available.
	 * @param array<string,mixed> $scan_options Sanitized scan options.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function start_image_audit(string $store_id, array $scan_options = []) {
		$payload = [
			'source'       => 'woocommerce',
			'scan_options' => $scan_options,
		];

		$store_id = trim($store_id);
		if ('' !== $store_id) {
			$payload['store_id'] = $store_id;
		}

		return $this->request_json(
			'POST',
			'/api/image-studio/audits/start',
			$payload,
			30,
			true
		);
	}

	/**
	 * Submit a batch of scanned image metadata.
	 *
	 * @param string                    $scan_id Remote scan ID.
	 * @param array<int,array<string,mixed>> $items Metadata items.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function submit_image_audit_items(string $scan_id, array $items) {
		return $this->request_json(
			'POST',
			'/api/image-studio/audits/' . rawurlencode($scan_id) . '/items',
			[
				'items' => array_values($items),
			],
			120,
			true
		);
	}

	/**
	 * Complete a Product Image Health Report audit scan.
	 *
	 * @param string $scan_id Remote scan ID.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function complete_image_audit(string $scan_id) {
		return $this->request_json(
			'POST',
			'/api/image-studio/audits/' . rawurlencode($scan_id) . '/complete',
			[],
			180,
			true
		);
	}

	/**
	 * Fetch the latest Product Image Health Report summary.
	 *
	 * @param string $store_id Store identifier validated by the backend token.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function get_latest_image_audit(string $store_id) {
		$store_id = trim($store_id);

		return $this->request_json(
			'GET',
			'' === $store_id ? '/api/image-studio/audits/latest' : '/api/image-studio/audits/latest?store_id=' . rawurlencode($store_id),
			[],
			20
		);
	}

	/**
	 * Fetch a full Product Image Health Report.
	 *
	 * @param string $scan_id Remote scan ID.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function get_image_audit(string $scan_id) {
		return $this->request_json(
			'GET',
			'/api/image-studio/audits/' . rawurlencode($scan_id),
			[],
			25
		);
	}

	public function get_image_audit_schedule(string $store_id) {
		return $this->request_json(
			'GET',
			'/api/image-studio/audit-schedule?store_id=' . rawurlencode($store_id),
			[],
			20
		);
	}

	public function save_image_audit_schedule(string $store_id, array $schedule) {
		return $this->request_json(
			'PUT',
			'/api/image-studio/audit-schedule',
			[
				'store_id'                => $store_id,
				'frequency'               => $schedule['frequency'] ?? 'off',
				'scan_mode'               => $schedule['scan_mode'] ?? 'updated',
				'email_report'            => ! empty($schedule['email_report']),
				'monthly_report_enabled'  => ! empty($schedule['monthly_report_enabled']),
				'scan_options'            => $schedule['scan_options'] ?? [],
			],
			25
		);
	}

	public function acknowledge_image_audit_schedule(string $store_id, array $payload = []) {
		return $this->request_json(
			'POST',
			'/api/image-studio/audit-schedule/ack',
			array_merge(['store_id' => $store_id], $payload),
			20
		);
	}

	public function get_latest_monthly_image_audit_report(string $store_id) {
		return $this->request_json(
			'GET',
			'/api/image-studio/monthly-report/latest?store_id=' . rawurlencode($store_id),
			[],
			20
		);
	}

	/**
	 * Fetch paginated audit issues.
	 *
	 * @param string              $scan_id Remote scan ID.
	 * @param array<string,mixed> $query Query filters.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function get_image_audit_issues(string $scan_id, array $query = []) {
		return $this->request_json(
			'GET',
			'/api/image-studio/audits/' . rawurlencode($scan_id) . '/issues' . $this->build_query_string($query),
			[],
			25
		);
	}

	/**
	 * Fetch paginated audit items.
	 *
	 * @param string              $scan_id Remote scan ID.
	 * @param array<string,mixed> $query Query filters.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function get_image_audit_items(string $scan_id, array $query = []) {
		return $this->request_json(
			'GET',
			'/api/image-studio/audits/' . rawurlencode($scan_id) . '/items' . $this->build_query_string($query),
			[],
			25
		);
	}

	/**
	 * Ignore selected audit issues.
	 *
	 * @param string     $scan_id Remote scan ID.
	 * @param array<int,string> $issue_ids Issue IDs.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function ignore_image_audit_issues(string $scan_id, array $issue_ids) {
		return $this->request_json(
			'POST',
			'/api/image-studio/audits/' . rawurlencode($scan_id) . '/issues/ignore',
			[
				'issue_ids' => array_values($issue_ids),
			],
			30
		);
	}

	/**
	 * Queue selected audit issues.
	 *
	 * @param string     $scan_id Remote scan ID.
	 * @param array<int,string> $issue_ids Issue IDs.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function queue_image_audit_issues(string $scan_id, array $issue_ids, array $options = []) {
		return $this->request_json(
			'POST',
			'/api/image-studio/audits/' . rawurlencode($scan_id) . '/issues/queue',
			array_merge(
				[
				'issue_ids' => array_values($issue_ids),
				],
				$options
			),
			30
		);
	}

	/**
	 * Ask the backend to create queue jobs from an audit recommendation.
	 *
	 * @param string $scan_id Remote scan ID.
	 * @param string $recommendation_id Remote recommendation ID.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function queue_audit_recommendation(string $scan_id, string $recommendation_id, array $options = []) {
		return $this->request_json(
			'POST',
			'/api/image-studio/audits/' . rawurlencode($scan_id) . '/queue-recommendation',
			array_merge(
				[
					'recommendation_id' => $recommendation_id,
				],
				$options
			),
			30
		);
	}

	/**
	 * Send a small operational event after the store is connected.
	 *
	 * @param string              $event_type Event type.
	 * @param array<string,mixed> $metadata Event metadata.
	 * @param array<string,mixed> $settings Plugin settings.
	 * @return void
	 */
	public function send_event(string $event_type, array $metadata = [], array $settings = []): void {
		if ('' === $this->api_base_url || '' === $this->api_token || empty($settings['send_operational_diagnostics'])) {
			return;
		}

		$allowed = [
			'plugin_connected',
			'connection_tested',
			'settings_saved',
			'scan_started',
			'scan_completed',
			'queue_created',
			'image_queued',
			'processing_started',
			'processing_completed',
			'processing_failed',
			'preview_failed',
			'image_approved',
			'image_rejected',
			'seo_generated',
			'credits_low',
			'buy_credits_clicked',
			'credit_checkout_started',
			'credit_checkout_completed',
			'subscription_checkout_started',
			'subscription_checkout_completed',
			'billing_portal_opened',
			'plugin_version_seen',
		];

		if (! in_array($event_type, $allowed, true)) {
			return;
		}

		$url = $this->normalize_request_url('/api/plugin/events', 'POST');
		$response = wp_remote_post(
			$url,
			[
				'timeout'  => 5,
				'blocking' => false,
				'headers'  => [
					'Authorization' => 'Bearer ' . $this->api_token,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
				] + $this->get_site_headers(),
				'body'     => wp_json_encode(
					[
						'eventType'          => $event_type,
						'pluginVersion'      => defined('OPTIIMST_VERSION') ? OPTIIMST_VERSION : '1.0.0',
						'wordpressVersion'   => get_bloginfo('version'),
						'woocommerceVersion' => defined('WC_VERSION') ? WC_VERSION : '',
						'phpVersion'         => PHP_VERSION,
						'metadata'           => $this->sanitize_event_metadata($metadata),
					]
				),
			]
		);
		if (! empty($settings['debug_mode'])) {
			$this->log_http_request('POST', $url, is_wp_error($response) ? null : (int) wp_remote_retrieve_response_code($response));
		}

		if (is_wp_error($response) && ! empty($settings['debug_mode'])) {
			$this->logger->error('Operational diagnostics event could not be sent.', ['message' => $response->get_error_message()]);
		}
	}

	/**
	 * @param array<string,mixed> $metadata Raw metadata.
	 * @return array<string,mixed>
	 */
	private function sanitize_event_metadata(array $metadata): array {
		$blocked = ['token', 'api_token', 'authorization', 'password', 'secret', 'signed_url', 'image_url', 'processed_url'];
		$output = [];

		foreach ($metadata as $key => $value) {
			$key = sanitize_key((string) $key);

			if ('' === $key || in_array($key, $blocked, true) || false !== strpos($key, 'token') || false !== strpos($key, 'secret')) {
				continue;
			}

			if (is_scalar($value) || null === $value) {
				$output[$key] = is_string($value) ? sanitize_text_field($value) : $value;
			}
		}

		return $output;
	}

	private function build_api_url(string $endpoint): string {
		return self::build_api_url_for_base($this->api_base_url, $endpoint);
	}

	/**
	 * @param array<string,mixed> $query Query params.
	 */
	private function build_query_string(array $query): string {
		$filtered = [];
		foreach ($query as $key => $value) {
			$key = sanitize_key((string) $key);
			if ('' === $key || null === $value || '' === $value || is_array($value) || is_object($value)) {
				continue;
			}
			$filtered[$key] = is_bool($value) ? ($value ? '1' : '0') : (string) $value;
		}

		return empty($filtered) ? '' : '?' . http_build_query($filtered, '', '&', PHP_QUERY_RFC3986);
	}

	private function debug_mode_enabled(): bool {
		$settings = optiimst_get_option('optiimst_settings', []);
		$settings = is_array($settings) ? $settings : [];

		return ! empty($settings['debug_mode']);
	}

	private function log_http_request(string $method, string $url, ?int $status_code, array $context = []): void {
		if (! $this->debug_mode_enabled()) {
			return;
		}

		$context = $this->sanitize_debug_context($context);
		$context = array_merge(
			[
				'method'             => strtoupper($method),
				'url'                => $url,
				'status'             => null === $status_code ? 'network_error' : $status_code,
				'auth_token_present' => '' !== $this->api_token,
			],
			$context
		);

		$this->logger->info(
			'Optivra API request.',
			$context
		);
	}

	private function sanitize_debug_context(array $context): array {
		$blocked = ['authorization', 'api_token', 'token', 'password', 'secret', 'key'];
		$output = [];

		foreach ($context as $key => $value) {
			$key = sanitize_key((string) $key);
			if ('' === $key || in_array($key, $blocked, true) || false !== strpos($key, 'token') || false !== strpos($key, 'secret')) {
				if ('auth_token_present' === $key) {
					$output[$key] = (bool) $value;
				}
				continue;
			}

			if (is_bool($value) || is_int($value) || is_float($value) || null === $value) {
				$output[$key] = $value;
				continue;
			}

			if (is_scalar($value)) {
				$output[$key] = sanitize_textarea_field(substr((string) $value, 0, 1500));
			}
		}

		return $output;
	}

	private function sanitize_response_body_for_debug(string $body): string {
		$body = trim($body);
		if (strlen($body) > 1500) {
			$body = substr($body, 0, 1500) . '...';
		}

		$body = preg_replace('/(authorization|api[_-]?token|token|secret|password|key)"?\s*[:=]\s*"[^"]+"/i', '$1:"[redacted]"', $body);

		return sanitize_textarea_field((string) $body);
	}

	private function build_http_error_message(int $status_code, array $decoded, string $fallback): string {
		$backend_message = $this->get_error_message($decoded, $fallback);

		if (401 === $status_code || 403 === $status_code) {
			return __('Connection/authentication failed. Reconnect Optivra.', 'optivra-image-studio-for-woocommerce') . ' ' . $backend_message;
		}

		if (400 === $status_code) {
			return $backend_message;
		}

		if ($status_code >= 500) {
			$request_id = '';
			if (isset($decoded['request_id']) && is_scalar($decoded['request_id'])) {
				$request_id = sanitize_text_field((string) $decoded['request_id']);
			} elseif (isset($decoded['requestId']) && is_scalar($decoded['requestId'])) {
				$request_id = sanitize_text_field((string) $decoded['requestId']);
			}

			return $request_id
				/* translators: %s: Optivra backend request ID. */
				? sprintf(__('Backend error. Request ID: %s', 'optivra-image-studio-for-woocommerce'), $request_id)
				: __('Backend error. Please try again or contact Optivra support.', 'optivra-image-studio-for-woocommerce');
		}

		return $backend_message;
	}

	/**
	 * Send a JSON request to the Optivra backend.
	 *
	 * @param string              $method HTTP method.
	 * @param string              $path API path.
	 * @param array<string,mixed> $payload Request payload.
	 * @param int                 $timeout Timeout seconds.
	 * @return array<string,mixed>|\WP_Error
	 */
	private function request_json(string $method, string $path, array $payload = [], int $timeout = 30, bool $log_response_body = false) {
		if ('' === $this->api_base_url || '' === $this->api_token) {
			return new WP_Error(
				'optiimst_missing_api_settings',
				__('Paste your Site API Token to connect this store.', 'optivra-image-studio-for-woocommerce')
			);
		}

		$args = [
			'timeout' => $timeout,
			'headers' => [
				'Authorization' => 'Bearer ' . $this->api_token,
				'Accept'        => 'application/json',
			] + $this->get_site_headers(),
		];

		if ('POST' === strtoupper($method)) {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body'] = wp_json_encode($payload);
			$url = $this->normalize_request_url($path, 'POST');
			$response = wp_remote_post($url, $args);
		} else {
			$url = $this->normalize_request_url($path, 'GET');
			$response = wp_remote_get($url, $args);
		}
		$this->log_http_request(
			strtoupper($method),
			$url,
			is_wp_error($response) ? null : (int) wp_remote_retrieve_response_code($response),
			[
				'endpoint_path' => $path,
			]
		);

		if (is_wp_error($response)) {
			$response->add_data(
				[
					'method'             => strtoupper($method),
					'url'                => $url,
					'endpoint_path'      => $path,
					'status_code'        => null,
					'auth_token_present' => '' !== $this->api_token,
					'response_body'      => '',
				]
			);
			$this->logger->error('Optivra API request failed.', ['url' => $url, 'message' => $response->get_error_message()]);
			return $response;
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		$body        = (string) wp_remote_retrieve_body($response);
		$decoded     = json_decode($body, true);
			$response_body_debug = $this->sanitize_response_body_for_debug($body);

		if (! is_array($decoded)) {
			return new WP_Error(
				'optiimst_invalid_api_response',
				sprintf(
					/* translators: 1: status code, 2: API path */
					__('Optivra returned an unexpected response for %2$s (HTTP %1$d).', 'optivra-image-studio-for-woocommerce'),
					$status_code,
					$path
				),
				[
					'method'             => strtoupper($method),
					'url'                => $url,
					'endpoint_path'      => $path,
					'status_code'        => $status_code,
					'auth_token_present' => '' !== $this->api_token,
					'response_body'      => $response_body_debug,
				]
			);
		}

		if ($status_code < 200 || $status_code >= 300) {
			if ($log_response_body && ! empty($response_body_debug)) {
				$this->logger->error(
					'Optivra audit route may have returned an unexpected payload.',
					[
						'method'        => strtoupper($method),
						'url'           => $url,
						'endpoint_path' => $path,
						'status'        => $status_code,
						'response_body' => $response_body_debug,
					]
				);
			}
			$error_data = [
				'method'             => strtoupper($method),
				'url'                => $url,
				'endpoint_path'      => $path,
				'status_code'        => $status_code,
				'auth_token_present' => '' !== $this->api_token,
				'response_body'      => $response_body_debug,
			];
			$this->log_http_request(strtoupper($method), $url, $status_code, $error_data);

			return new WP_Error(
				'optiimst_api_error',
				$this->build_http_error_message($status_code, $decoded, __('Optivra could not complete the audit request.', 'optivra-image-studio-for-woocommerce')),
				$error_data
			);
		}

		return $decoded;
	}

	/**
	 * @param array<string,mixed> $decoded API response body.
	 */
	private function get_error_message(array $decoded, string $fallback): string {
		if (isset($decoded['error']) && is_string($decoded['error'])) {
			return $decoded['error'];
		}

		if (isset($decoded['error']) && is_array($decoded['error']) && isset($decoded['error']['message']) && is_string($decoded['error']['message'])) {
			return $decoded['error']['message'];
		}

		return $fallback;
	}

	private function normalize_processed_url(string $url): string {
		$url = html_entity_decode(trim($url), ENT_QUOTES, 'UTF-8');

		if (false !== strpos($url, '.supabase.co/object/sign/')) {
			$url = str_replace('.supabase.co/object/sign/', '.supabase.co/storage/v1/object/sign/', $url);
		}

		if (false !== strpos($url, '.supabase.co/object/public/')) {
			$url = str_replace('.supabase.co/object/public/', '.supabase.co/storage/v1/object/public/', $url);
		}

		return esc_url_raw($url);
	}

	/**
	 * Send non-secret store identity metadata used for store claims.
	 *
	 * @return array<string,string>
	 */
	private function get_site_headers(): array {
		$install_id = (string) optiimst_get_option('optiimst_image_studio_install_id', '');
		if ('' === $install_id) {
			$install_id = wp_generate_uuid4();
			optiimst_update_option('optiimst_image_studio_install_id', $install_id, false);
		}

		$woocommerce_version = '';
		if (defined('WC_VERSION')) {
			$woocommerce_version = (string) WC_VERSION;
		} elseif (function_exists('WC') && WC()) {
			$woocommerce_version = (string) WC()->version;
		}

		return [
			'X-Optivra-Site-Url'             => esc_url_raw(site_url()),
			'X-Optivra-Home-Url'             => esc_url_raw(home_url()),
			'X-Optivra-Admin-Url-Hash'       => hash('sha256', admin_url()),
			'X-Optivra-WordPress-Install-Id' => sanitize_text_field($install_id),
			'X-Optivra-Plugin-Version'       => defined('OPTIIMST_VERSION') ? OPTIIMST_VERSION : '1.0.0',
			'X-Optivra-WordPress-Version'    => sanitize_text_field((string) get_bloginfo('version')),
			'X-Optivra-WooCommerce-Version'  => sanitize_text_field($woocommerce_version),
			'X-Optivra-PHP-Version'          => sanitize_text_field(PHP_VERSION),
		];
	}
}
