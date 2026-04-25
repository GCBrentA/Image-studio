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

	private Catalogue_Image_Studio_Logger $logger;

	/**
	 * @param Catalogue_Image_Studio_Job_Repository $jobs Job repository.
	 * @param Catalogue_Image_Studio_SaaSClient     $client SaaS client.
	 * @param Catalogue_Image_Studio_Logger         $logger Logger.
	 */
	public function __construct(
		Catalogue_Image_Studio_Job_Repository $jobs,
		Catalogue_Image_Studio_SaaSClient $client,
		Catalogue_Image_Studio_Logger $logger
	) {
		$this->jobs   = $jobs;
		$this->client = $client;
		$this->logger = $logger;
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
			return new WP_Error('catalogue_image_studio_missing_job', __('Image job not found.', 'catalogue-image-studio'));
		}

		$image_url = wp_get_attachment_url((int) ($job['attachment_id'] ?? 0));

		if (! $image_url) {
			$error = new WP_Error('catalogue_image_studio_missing_source_url', __('The source image URL could not be resolved.', 'catalogue-image-studio'));
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

		$processed = $this->client->process_image($image_url, $options);

		if (is_wp_error($processed)) {
			$this->mark_failed($job_id, $processed);
			return $processed;
		}

		$result = [
			'status'          => 'completed',
			'processed_url'   => (string) $processed['processed_url'],
			'processed_at'    => current_time('mysql', true),
			'error_message'   => '',
			'seo_filename'    => $this->get_seo_value($processed, 'seo_filename', 'file_name'),
			'seo_alt_text'    => $this->get_seo_value($processed, 'alt_text'),
			'seo_title'       => $this->get_seo_value($processed, 'title'),
			'seo_caption'     => $this->get_seo_value($processed, 'caption'),
			'seo_description' => $this->get_seo_value($processed, 'description'),
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
	 * @param array<string,mixed> $processed API response.
	 */
	private function get_seo_value(array $processed, string $key, string $fallback_key = ''): string {
		$metadata = isset($processed['seo_metadata']) && is_array($processed['seo_metadata']) ? $processed['seo_metadata'] : [];

		if (isset($metadata[$key]) && is_string($metadata[$key])) {
			return sanitize_text_field($metadata[$key]);
		}

		if ('' !== $fallback_key && isset($metadata[$fallback_key]) && is_string($metadata[$fallback_key])) {
			return sanitize_text_field($metadata[$fallback_key]);
		}

		return '';
	}
}
