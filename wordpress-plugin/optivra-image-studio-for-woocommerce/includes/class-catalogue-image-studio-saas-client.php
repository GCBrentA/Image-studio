<?php
/**
 * Client for the external image processing backend.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_SaaSClient {
	private string $api_base_url;

	private string $api_token;

	private Catalogue_Image_Studio_Logger $logger;

	public function __construct(string $api_base_url, string $api_token, Catalogue_Image_Studio_Logger $logger) {
		$this->api_base_url = untrailingslashit($api_base_url);
		$this->api_token    = $api_token;
		$this->logger       = $logger;
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
				'catalogue_image_studio_missing_api_settings',
				__('Paste your Site API Token to connect this store.', 'optivra-image-studio-for-woocommerce')
			);
		}

		$response = wp_remote_post(
			$this->api_base_url . '/images/process',
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

		if (is_wp_error($response)) {
			$this->logger->error('Image processing API request failed.', ['message' => $response->get_error_message()]);
			return $response;
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		$body        = (string) wp_remote_retrieve_body($response);
		$decoded     = json_decode($body, true);

		if (! is_array($decoded)) {
			return new WP_Error(
				'catalogue_image_studio_invalid_api_response',
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
			return new WP_Error('catalogue_image_studio_api_error', $message, $error_data);
		}

		if (empty($decoded['processed_url'])) {
			return new WP_Error('catalogue_image_studio_missing_processed_url', __('The image processing API did not return a processed image URL.', 'optivra-image-studio-for-woocommerce'));
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
				'catalogue_image_studio_missing_api_settings',
				__('Paste your Site API Token to connect this store.', 'optivra-image-studio-for-woocommerce')
			);
		}

		$response = wp_remote_get(
			$this->api_base_url . '/usage',
			[
				'timeout' => 20,
				'headers' => [
					'Authorization' => 'Bearer ' . $this->api_token,
					'Accept'        => 'application/json',
				] + $this->get_site_headers(),
			]
		);

		if (is_wp_error($response)) {
			$this->logger->error('Usage API request failed.', ['message' => $response->get_error_message()]);
			return $response;
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		$body        = (string) wp_remote_retrieve_body($response);
		$decoded     = json_decode($body, true);

		if (! is_array($decoded)) {
			return new WP_Error(
				'catalogue_image_studio_invalid_api_response',
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
			return new WP_Error('catalogue_image_studio_api_error', $message, ['status_code' => $status_code]);
		}

		return $decoded;
	}

	/**
	 * Start a free Product Image Health Report audit scan.
	 *
	 * @param string              $store_id Store identifier validated by the backend token.
	 * @param array<string,mixed> $scan_options Sanitized scan options.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function start_image_audit(string $store_id, array $scan_options = []) {
		return $this->request_json(
			'POST',
			'/api/image-studio/audits/start',
			[
				'store_id'     => $store_id,
				'source'       => 'woocommerce',
				'scan_options' => $scan_options,
			],
			30
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
			45
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
			60
		);
	}

	/**
	 * Fetch the latest Product Image Health Report summary.
	 *
	 * @param string $store_id Store identifier validated by the backend token.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function get_latest_image_audit(string $store_id) {
		return $this->request_json(
			'GET',
			'/api/image-studio/audits/latest?store_id=' . rawurlencode($store_id),
			[],
			20
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

		$response = wp_remote_post(
			$this->api_base_url . '/api/plugin/events',
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
						'pluginVersion'      => defined('CIS_VERSION') ? CIS_VERSION : '1.0.0',
						'wordpressVersion'   => get_bloginfo('version'),
						'woocommerceVersion' => defined('WC_VERSION') ? WC_VERSION : '',
						'phpVersion'         => PHP_VERSION,
						'metadata'           => $this->sanitize_event_metadata($metadata),
					]
				),
			]
		);

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

	/**
	 * Send a JSON request to the Optivra backend.
	 *
	 * @param string              $method HTTP method.
	 * @param string              $path API path.
	 * @param array<string,mixed> $payload Request payload.
	 * @param int                 $timeout Timeout seconds.
	 * @return array<string,mixed>|\WP_Error
	 */
	private function request_json(string $method, string $path, array $payload = [], int $timeout = 30) {
		if ('' === $this->api_base_url || '' === $this->api_token) {
			return new WP_Error(
				'catalogue_image_studio_missing_api_settings',
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
			$response = wp_remote_post($this->api_base_url . $path, $args);
		} else {
			$response = wp_remote_get($this->api_base_url . $path, $args);
		}

		if (is_wp_error($response)) {
			$this->logger->error('Optivra API request failed.', ['path' => $path, 'message' => $response->get_error_message()]);
			return $response;
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		$body        = (string) wp_remote_retrieve_body($response);
		$decoded     = json_decode($body, true);

		if (! is_array($decoded)) {
			return new WP_Error(
				'catalogue_image_studio_invalid_api_response',
				sprintf(
					/* translators: 1: status code, 2: API path */
					__('Optivra returned an unexpected response for %2$s (HTTP %1$d).', 'optivra-image-studio-for-woocommerce'),
					$status_code,
					$path
				)
			);
		}

		if ($status_code < 200 || $status_code >= 300) {
			return new WP_Error(
				'catalogue_image_studio_api_error',
				$this->get_error_message($decoded, __('Optivra could not complete the audit request.', 'optivra-image-studio-for-woocommerce')),
				['status_code' => $status_code]
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
		$install_id = (string) get_option('optivra_image_studio_install_id', '');
		if ('' === $install_id) {
			$install_id = wp_generate_uuid4();
			update_option('optivra_image_studio_install_id', $install_id, false);
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
			'X-Optivra-Plugin-Version'       => defined('CIS_VERSION') ? CIS_VERSION : '1.0.0',
			'X-Optivra-WordPress-Version'    => sanitize_text_field((string) get_bloginfo('version')),
			'X-Optivra-WooCommerce-Version'  => sanitize_text_field($woocommerce_version),
			'X-Optivra-PHP-Version'          => sanitize_text_field(PHP_VERSION),
		];
	}
}
