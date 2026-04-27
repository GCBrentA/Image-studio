<?php
/**
 * Image processing workflow coordinator.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_ImageProcessor {
	private Catalogue_Image_Studio_Job_Repository $jobs;

	private Catalogue_Image_Studio_SaaSClient $client;

	private Catalogue_Image_Studio_MediaManager $media;

	private Catalogue_Image_Studio_SEO_Metadata_Generator $seo_generator;

	/**
	 * @var array<string,mixed>
	 */
	private array $settings;

	private Catalogue_Image_Studio_Logger $logger;

	/**
	 * @param Catalogue_Image_Studio_Job_Repository $jobs Job repository.
	 * @param Catalogue_Image_Studio_SaaSClient     $client SaaS client.
	 * @param Catalogue_Image_Studio_MediaManager   $media Media manager.
	 * @param Catalogue_Image_Studio_SEO_Metadata_Generator $seo_generator SEO generator.
	 * @param array<string,mixed>                   $settings Plugin settings.
	 * @param Catalogue_Image_Studio_Logger         $logger Logger.
	 */
	public function __construct(
		Catalogue_Image_Studio_Job_Repository $jobs,
		Catalogue_Image_Studio_SaaSClient $client,
		Catalogue_Image_Studio_MediaManager $media,
		Catalogue_Image_Studio_SEO_Metadata_Generator $seo_generator,
		array $settings,
		Catalogue_Image_Studio_Logger $logger
	) {
		$this->jobs          = $jobs;
		$this->client        = $client;
		$this->media         = $media;
		$this->seo_generator = $seo_generator;
		$this->settings      = $settings;
		$this->logger        = $logger;
	}

	/**
	 * Process one stored image job.
	 *
	 * @param int                 $job_id Job ID.
	 * @param array<string,mixed> $options Processing options.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function process(int $job_id, array $options = []) {
		$job = $this->jobs->find($job_id);

		if (! $job) {
			return new WP_Error('catalogue_image_studio_missing_job', __('Image job not found.', 'optivra-image-studio-for-woocommerce'));
		}

		$image_url = wp_get_attachment_url((int) ($job['attachment_id'] ?? 0));
		$source_payload = $this->get_attachment_upload_payload((int) ($job['attachment_id'] ?? 0));

		if (! $image_url) {
			$error = new WP_Error('catalogue_image_studio_missing_source_url', __('The source image URL could not be resolved.', 'optivra-image-studio-for-woocommerce'));
			$this->mark_failed($job_id, $error);
			return $error;
		}

		$this->jobs->update(
			$job_id,
			[
				'status'     => 'processing',
				'queued_at'  => current_time('mysql', true),
			]
		);

		$background_payload = [];
		if (! empty($options['background_attachment_id'])) {
			$background_payload = $this->get_attachment_upload_payload((int) $options['background_attachment_id'], 'background');
			unset($options['background_attachment_id']);
		}

		$processed = $this->client->process_image($image_url, array_merge($options, $source_payload, $background_payload));

		if (is_wp_error($processed)) {
			$this->mark_failed($job_id, $processed);
			return $processed;
		}

		$processed_url = $this->get_processed_url($processed);
		if ('' === $processed_url) {
			$error = new WP_Error('catalogue_image_studio_missing_processed_url', __('The processing API did not return a usable processed image URL.', 'optivra-image-studio-for-woocommerce'));
			$this->mark_failed($job_id, $error);
			return $error;
		}

		$processed_filename = (string) wp_basename((string) wp_parse_url($processed_url, PHP_URL_PATH));
		$original_filename  = (string) wp_basename((string) get_attached_file((int) ($job['attachment_id'] ?? 0)));
		$seo               = $this->seo_generator->generate(
			(int) ($job['product_id'] ?? 0),
			(int) ($job['attachment_id'] ?? 0),
			(string) ($job['image_role'] ?? 'featured'),
			$original_filename,
			$processed_filename,
			$this->settings
		);

		$processed_attachment_id = $this->media->sideload_processed_image(
			$processed_url,
			(int) ($job['product_id'] ?? 0),
			(int) ($job['attachment_id'] ?? 0),
			$seo,
			$this->settings
		);

		$import_error = '';
		if (is_wp_error($processed_attachment_id)) {
			$import_error = sprintf(
				/* translators: %s: error message */
				__('Processed image is ready in Optivra, but WordPress could not import it yet. You can still review it and approve will try again. Details: %s', 'optivra-image-studio-for-woocommerce'),
				$processed_attachment_id->get_error_message()
			);
			$this->logger->error(
				'Processed image import deferred.',
				[
					'job_id'  => $job_id,
					'message' => $processed_attachment_id->get_error_message(),
				]
			);
			$processed_attachment_id = 0;
		}

		$image_meta = $processed_attachment_id ? wp_get_attachment_metadata((int) $processed_attachment_id) : [];
		$mime_type  = $processed_attachment_id ? (string) get_post_mime_type((int) $processed_attachment_id) : 'image/webp';

		$result = [
			'status'                  => 'completed',
			'processed_url'           => $processed_url,
			'processed_attachment_id' => (int) $processed_attachment_id,
			'processed_storage_bucket' => $this->get_processed_meta_value($processed, 'processed_storage_bucket', 'processed_bucket'),
			'processed_storage_path'  => $this->get_processed_meta_value($processed, 'processed_storage_path', 'storage_path'),
			'processed_mime_type'     => $mime_type,
			'processed_width'         => is_array($image_meta) && isset($image_meta['width']) ? (int) $image_meta['width'] : 0,
			'processed_height'        => is_array($image_meta) && isset($image_meta['height']) ? (int) $image_meta['height'] : 0,
			'processed_at'            => current_time('mysql', true),
			'error_message'           => '',
			'approval_error'          => $import_error,
			'seo_filename'            => $seo['filename'],
			'seo_alt_text'            => $seo['alt_text'],
			'seo_title'               => $seo['title'],
			'seo_caption'             => $seo['caption'],
			'seo_description'         => $seo['description'],
		];

		$this->jobs->update($job_id, $result);
		$this->logger->info('Image job processed successfully.', ['job_id' => $job_id]);

		return $result;
	}

	private function mark_failed(int $job_id, WP_Error $error): void {
		$this->jobs->update(
			$job_id,
			[
				'status'        => 'failed',
				'error_message' => $error->get_error_message(),
			]
		);

		$this->logger->error(
			'Image job failed.',
			[
				'job_id'  => $job_id,
				'message' => $error->get_error_message(),
			]
		);
	}

	/**
	 * Build a direct upload payload for local/private WordPress media.
	 *
	 * @return array<string,string>
	 */
	private function get_attachment_upload_payload(int $attachment_id, string $prefix = ''): array {
		$file = (string) get_attached_file($attachment_id);

		if ('' === $file || ! is_file($file) || ! is_readable($file)) {
			return [];
		}

		$max_bytes = 15 * 1024 * 1024;
		$file_size = (int) filesize($file);

		if ($file_size <= 0 || $file_size > $max_bytes) {
			return [];
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		global $wp_filesystem;

		if (! $wp_filesystem) {
			return [];
		}

		$contents = $wp_filesystem->get_contents($file);

		if (! is_string($contents) || '' === $contents) {
			return [];
		}

		$mime_type = (string) get_post_mime_type($attachment_id);
		if ('' === $mime_type) {
			$file_type = wp_check_filetype($file);
			$mime_type = (string) ($file_type['type'] ?? '');
		}

		if (0 !== strpos($mime_type, 'image/')) {
			return [];
		}

		$key_prefix = '' === $prefix ? '' : $prefix . '_';

		return [
			$key_prefix . 'image_data'      => base64_encode($contents),
			$key_prefix . 'image_filename'  => sanitize_file_name(wp_basename($file)),
			$key_prefix . 'image_mime_type' => sanitize_mime_type($mime_type),
		];
	}

	/**
	 * @param array<string,mixed> $processed API response.
	 */
	private function get_processed_url(array $processed): string {
		$url = isset($processed['processed_url']) && is_string($processed['processed_url']) ? trim($processed['processed_url']) : '';
		$url = $this->normalize_supabase_storage_url($url);

		if ('' === $url || ! wp_http_validate_url($url)) {
			return '';
		}

		return esc_url_raw($url);
	}

	private function normalize_supabase_storage_url(string $url): string {
		$url = html_entity_decode(trim($url), ENT_QUOTES, 'UTF-8');

		if (false !== strpos($url, '.supabase.co/object/sign/')) {
			$url = str_replace('.supabase.co/object/sign/', '.supabase.co/storage/v1/object/sign/', $url);
		}

		if (false !== strpos($url, '.supabase.co/object/public/')) {
			$url = str_replace('.supabase.co/object/public/', '.supabase.co/storage/v1/object/public/', $url);
		}

		return $url;
	}

	/**
	 * @param array<string,mixed> $processed API response.
	 */
	private function get_processed_meta_value(array $processed, string $key, string $fallback_key = ''): string {
		if (isset($processed[$key]) && is_string($processed[$key])) {
			return sanitize_text_field($processed[$key]);
		}

		if ('' !== $fallback_key && isset($processed[$fallback_key]) && is_string($processed[$fallback_key])) {
			return sanitize_text_field($processed[$fallback_key]);
		}

		return '';
	}
}
