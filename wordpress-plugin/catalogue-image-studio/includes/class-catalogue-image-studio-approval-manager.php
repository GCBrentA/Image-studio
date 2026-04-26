<?php
/**
 * Approval, rejection, and revert workflows.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_ApprovalManager {
	private Catalogue_Image_Studio_Job_Repository $jobs;

	private Catalogue_Image_Studio_MediaManager $media;

	/**
	 * @var array<string,mixed>
	 */
	private array $settings;

	private Catalogue_Image_Studio_Logger $logger;

	public function __construct(
		Catalogue_Image_Studio_Job_Repository $jobs,
		Catalogue_Image_Studio_MediaManager $media,
		array $settings,
		Catalogue_Image_Studio_Logger $logger
	) {
		$this->jobs     = $jobs;
		$this->media    = $media;
		$this->settings = $settings;
		$this->logger   = $logger;
	}

	/**
	 * @return true|\WP_Error
	 */
	public function approve(int $job_id) {
		$job = $this->jobs->find($job_id);

		if (! $job) {
			return new WP_Error('catalogue_image_studio_missing_job', __('Image job not found.', 'optivra'));
		}

		$processed_attachment_id = (int) ($job['processed_attachment_id'] ?? 0);

		if ($processed_attachment_id && ! $this->attachment_is_usable($processed_attachment_id)) {
			$processed_attachment_id = 0;
		}

		if (! $processed_attachment_id) {
			if (empty($job['processed_url']) || ! wp_http_validate_url((string) $job['processed_url'])) {
				$error = new WP_Error('catalogue_image_studio_missing_processed_image', __('Processed image missing. Reprocess before approving.', 'optivra'));
				$this->mark_approval_error((int) $job_id, $error);
				return $error;
			}

			$processed_attachment_id = $this->media->sideload_processed_image(
				(string) $job['processed_url'],
				(int) $job['product_id'],
				(int) $job['attachment_id'],
				$this->get_seo_from_job($job),
				$this->settings
			);

			if (is_wp_error($processed_attachment_id)) {
				$error = new WP_Error('catalogue_image_studio_missing_processed_image', __('Processed image could not be found. Reprocess this image.', 'optivra'));
				$this->mark_approval_error((int) $job_id, $error);
				return $error;
			}
		}

		$this->media->apply_seo_metadata($processed_attachment_id, $this->get_seo_from_job($job), $this->settings);
		$this->replace_product_image($job, $processed_attachment_id);
		$this->jobs->update(
			$job_id,
			[
				'status'                => 'approved',
				'current_attachment_id' => $processed_attachment_id,
				'processed_attachment_id' => $processed_attachment_id,
				'approved_at'           => current_time('mysql', true),
				'error_message'         => '',
				'approval_error'        => '',
			]
		);

		$this->logger->info('Processed image approved.', ['job_id' => $job_id]);

		return true;
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return array<string,string>
	 */
	private function get_seo_from_job(array $job): array {
		return [
			'filename'    => isset($job['seo_filename']) ? (string) $job['seo_filename'] : '',
			'alt_text'    => isset($job['seo_alt_text']) ? (string) $job['seo_alt_text'] : '',
			'title'       => isset($job['seo_title']) ? (string) $job['seo_title'] : '',
			'caption'     => isset($job['seo_caption']) ? (string) $job['seo_caption'] : '',
			'description' => isset($job['seo_description']) ? (string) $job['seo_description'] : '',
		];
	}

	/**
	 * @return true|\WP_Error
	 */
	public function reject(int $job_id) {
		$job = $this->jobs->find($job_id);

		if (! $job) {
			return new WP_Error('catalogue_image_studio_missing_job', __('Image job not found.', 'optivra'));
		}

		$this->jobs->update(
			$job_id,
			[
				'status'        => 'rejected',
				'error_message' => '',
			]
		);

		$this->logger->info('Processed image rejected.', ['job_id' => $job_id]);

		return true;
	}

	/**
	 * @return true|\WP_Error
	 */
	public function revert(int $job_id) {
		$job = $this->jobs->find($job_id);

		if (! $job) {
			return new WP_Error('catalogue_image_studio_missing_job', __('Image job not found.', 'optivra'));
		}

		$original_attachment_id = (int) ($job['original_attachment_id'] ?? 0);

		if (! $original_attachment_id) {
			return new WP_Error('catalogue_image_studio_missing_original_image', __('The original image is missing and cannot be restored.', 'optivra'));
		}

		$this->replace_product_image($job, $original_attachment_id);
		$this->jobs->update(
			$job_id,
			[
				'status'                => 'reverted',
				'current_attachment_id' => $original_attachment_id,
				'reverted_at'           => current_time('mysql', true),
			]
		);

		$this->logger->info('Product image reverted.', ['job_id' => $job_id]);

		return true;
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return void
	 */
	private function replace_product_image(array $job, int $target_attachment_id): void {
		$product_id = (int) ($job['product_id'] ?? 0);
		$role       = (string) ($job['image_role'] ?? 'featured');

		if ('featured' === $role) {
			update_post_meta($product_id, '_thumbnail_id', $target_attachment_id);
			return;
		}

		if ('category' === $role) {
			$term_id = (int) ($job['gallery_index'] ?? 0);
			if ($term_id > 0) {
				update_term_meta($term_id, 'thumbnail_id', $target_attachment_id);
			}
			return;
		}

		$gallery = array_values(array_filter(array_map('absint', explode(',', (string) get_post_meta($product_id, '_product_image_gallery', true)))));
		$index   = (int) ($job['gallery_index'] ?? 0);

		if (isset($gallery[$index])) {
			$gallery[$index] = $target_attachment_id;
		} else {
			$current_attachment_id = (int) ($job['current_attachment_id'] ?? 0);

			foreach ($gallery as $gallery_index => $attachment_id) {
				if ($attachment_id === $current_attachment_id) {
					$gallery[$gallery_index] = $target_attachment_id;
				}
			}
		}

		update_post_meta($product_id, '_product_image_gallery', implode(',', array_map('absint', $gallery)));
	}

	private function attachment_is_usable(int $attachment_id): bool {
		$post = get_post($attachment_id);
		if (! $post || 'attachment' !== $post->post_type) {
			return false;
		}

		$url = wp_get_attachment_url($attachment_id);
		if (! $url) {
			return false;
		}

		$file = get_attached_file($attachment_id);

		return '' === (string) $file || file_exists((string) $file);
	}

	private function mark_approval_error(int $job_id, WP_Error $error): void {
		$this->jobs->update(
			$job_id,
			[
				'approval_error' => $error->get_error_message(),
				'error_message'  => $error->get_error_message(),
			]
		);

		$this->logger->error(
			'Processed image approval failed.',
			[
				'job_id'  => $job_id,
				'message' => $error->get_error_message(),
			]
		);
	}
}
