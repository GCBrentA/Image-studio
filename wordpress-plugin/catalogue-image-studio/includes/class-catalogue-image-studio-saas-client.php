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
				__('The image processing API URL and token must be configured.', 'catalogue-image-studio')
			);
		}

		$response = wp_remote_post(
			$this->api_base_url . '/images/process',
			[
				'timeout' => 90,
				'headers' => [
					'Authorization' => 'Bearer ' . $this->api_token,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
				],
				'body'    => wp_json_encode(
					array_filter(
						[
							'image_url'      => $image_url,
							'background'     => $options['background'] ?? null,
							'scale_percent'  => $options['scale_percent'] ?? null,
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
			return new WP_Error('catalogue_image_studio_invalid_api_response', __('The image processing API returned invalid JSON.', 'catalogue-image-studio'));
		}

		if ($status_code < 200 || $status_code >= 300) {
			$message = $this->get_error_message($decoded, __('Image processing failed.', 'catalogue-image-studio'));
			return new WP_Error('catalogue_image_studio_api_error', $message, ['status_code' => $status_code]);
		}

		if (empty($decoded['processed_url'])) {
			return new WP_Error('catalogue_image_studio_missing_processed_url', __('The image processing API did not return a processed image URL.', 'catalogue-image-studio'));
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
				__('The image processing API URL and token must be configured.', 'catalogue-image-studio')
			);
		}

		$response = wp_remote_get(
			$this->api_base_url . '/usage',
			[
				'timeout' => 20,
				'headers' => [
					'Authorization' => 'Bearer ' . $this->api_token,
					'Accept'        => 'application/json',
				],
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
			return new WP_Error('catalogue_image_studio_invalid_api_response', __('The image processing API returned invalid JSON.', 'catalogue-image-studio'));
		}

		if ($status_code < 200 || $status_code >= 300) {
			$message = $this->get_error_message($decoded, __('Connection test failed.', 'catalogue-image-studio'));
			return new WP_Error('catalogue_image_studio_api_error', $message, ['status_code' => $status_code]);
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
}
