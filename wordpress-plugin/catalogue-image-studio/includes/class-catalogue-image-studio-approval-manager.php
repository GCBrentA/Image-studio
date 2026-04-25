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

	private Catalogue_Image_Studio_Logger $logger;

	public function __construct(Catalogue_Image_Studio_Job_Repository $jobs, Catalogue_Image_Studio_Logger $logger) {
		$this->jobs   = $jobs;
		$this->logger = $logger;
	}

	/**
	 * @return true|\WP_Error
	 */
	public function approve(int $job_id) {
		$job = $this->jobs->find($job_id);

		if (! $job) {
			return new WP_Error('catalogue_image_studio_missing_job', __('Image job not found.', 'catalogue-image-studio'));
		}

		$processed_attachment_id = (int) ($job['processed_attachment_id'] ?? 0);

		if (! $processed_attachment_id) {
			return new WP_Error('catalogue_image_studio_missing_processed_image', __('This job does not have a processed image to approve.', 'catalogue-image-studio'));
		}

		$this->replace_product_image($job, $processed_attachment_id);
		$this->jobs->update(
			$job_id,
			[
				'status'                => 'approved',
				'current_attachment_id' => $processed_attachment_id,
				'approved_at'           => current_time('mysql', true),
				'error_message'         => '',
			]
		);

		$this->logger->info('Processed image approved.', ['job_id' => $job_id]);

		return true;
	}

	/**
	 * @return true|\WP_Error
	 */
	public function reject(int $job_id) {
		$job = $this->jobs->find($job_id);

		if (! $job) {
			return new WP_Error('catalogue_image_studio_missing_job', __('Image job not found.', 'catalogue-image-studio'));
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
			return new WP_Error('catalogue_image_studio_missing_job', __('Image job not found.', 'catalogue-image-studio'));
		}

		$original_attachment_id = (int) ($job['original_attachment_id'] ?? 0);

		if (! $original_attachment_id) {
			return new WP_Error('catalogue_image_studio_missing_original_image', __('The original image is missing and cannot be restored.', 'catalogue-image-studio'));
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
}
