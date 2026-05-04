<?php
/**
 * Approval, rejection, and revert workflows.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Optiimst_ApprovalManager {
	private Optiimst_Job_Repository $jobs;

	private Optiimst_MediaManager $media;

	/**
	 * @var array<string,mixed>
	 */
	private array $settings;

	private Optiimst_Logger $logger;

	public function __construct(
		Optiimst_Job_Repository $jobs,
		Optiimst_MediaManager $media,
		array $settings,
		Optiimst_Logger $logger
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
			return new WP_Error('optiimst_missing_job', __('Image job not found.', 'optivra-image-studio-for-woocommerce'));
		}

		$safety = optiimst_get_preservation_safety($job);
		$is_preserve_job = $this->is_preserve_mode_job($job);

		if ('failed' === $safety['status']) {
			$error = new WP_Error(
				'optiimst_product_preservation_failed',
				__('This processed image failed product preservation safety checks and cannot be applied. Reprocess it or contact Optivra support.', 'optivra-image-studio-for-woocommerce')
			);
			$this->mark_approval_error((int) $job_id, $error);
			return $error;
		}

		if ($is_preserve_job && 'not_assessed' === $safety['status']) {
			$error = new WP_Error(
				'optiimst_product_preservation_not_assessed',
				__('This preserve-mode image was not assessed by the current product preservation safety checks. Reprocess it before applying.', 'optivra-image-studio-for-woocommerce')
			);
			$this->mark_approval_error((int) $job_id, $error);
			return $error;
		}

		$processed_attachment_id = (int) ($job['processed_attachment_id'] ?? 0);

		if ($processed_attachment_id && ! $this->attachment_is_usable($processed_attachment_id)) {
			$processed_attachment_id = 0;
		}

		if (! $processed_attachment_id) {
			$processed_url = $this->normalize_supabase_storage_url((string) ($job['processed_url'] ?? ''));
			if ('' === $processed_url || ! wp_http_validate_url($processed_url)) {
				$error = new WP_Error('optiimst_missing_processed_image', __('Processed image missing. Reprocess before approving.', 'optivra-image-studio-for-woocommerce'));
				$this->mark_approval_error((int) $job_id, $error);
				return $error;
			}

			$processed_attachment_id = $this->media->sideload_processed_image(
				$processed_url,
				(int) $job['product_id'],
				(int) $job['attachment_id'],
				$this->get_seo_from_job($job),
				$this->settings
			);

			if (is_wp_error($processed_attachment_id)) {
				$error = new WP_Error('optiimst_missing_processed_image', __('Processed image could not be found. Reprocess this image.', 'optivra-image-studio-for-woocommerce'));
				$this->mark_approval_error((int) $job_id, $error);
				return $error;
			}
		}

		$this->media->apply_seo_metadata($processed_attachment_id, $this->get_seo_from_job($job), $this->settings);
		$version_id = $this->record_version_history($job, $processed_attachment_id, $safety);
		$this->replace_product_image($job, $processed_attachment_id);
		$this->jobs->update(
			$job_id,
			[
				'status'                => 'approved',
				'current_attachment_id' => $processed_attachment_id,
				'processed_attachment_id' => $processed_attachment_id,
				'approved_at'           => current_time('mysql', true),
				'safety_status'         => $safety['status'],
				'safety_metadata'       => wp_json_encode($safety['metadata']),
				'processing_mode'       => $this->get_processing_mode($job),
				'error_message'         => '',
				'approval_error'        => '',
			]
		);

		$this->logger->info('Processed image approved.', ['job_id' => $job_id, 'version_id' => $version_id, 'safety_status' => $safety['status']]);

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
			return new WP_Error('optiimst_missing_job', __('Image job not found.', 'optivra-image-studio-for-woocommerce'));
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
			return new WP_Error('optiimst_missing_job', __('Image job not found.', 'optivra-image-studio-for-woocommerce'));
		}

		$version = $this->get_latest_applied_version($job_id);
		$original_attachment_id = (int) ($version['original_attachment_id'] ?? $job['original_attachment_id'] ?? 0);

		if (! $original_attachment_id) {
			return new WP_Error('optiimst_missing_original_image', __('The original image is missing and cannot be restored.', 'optivra-image-studio-for-woocommerce'));
		}

		$this->replace_product_image($job, $original_attachment_id);
		$this->mark_version_reverted((int) ($version['id'] ?? 0));
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
	 */
	private function is_preserve_mode_job(array $job): bool {
		$mode = strtolower($this->get_processing_mode($job));

		return 'audit_report' === (string) ($job['audit_source'] ?? '')
			|| false !== strpos($mode, 'preserve')
			|| false !== strpos($mode, 'seo_product_feed');
	}

	/**
	 * @param array<string,mixed> $job Job.
	 */
	private function get_processing_mode(array $job): string {
		if (! empty($job['processing_mode']) && is_scalar($job['processing_mode'])) {
			return sanitize_text_field((string) $job['processing_mode']);
		}

		$validation = optiimst_get_output_validation($job);
		if (! empty($validation['processingMode']) && is_scalar($validation['processingMode'])) {
			return sanitize_text_field((string) $validation['processingMode']);
		}

		return '';
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @param array{status:string,label:string,metadata:array<string,mixed>,blocking:bool,requires_review:bool} $safety Safety result.
	 */
	private function record_version_history(array $job, int $processed_attachment_id, array $safety): int {
		global $wpdb;

		$now = current_time('mysql', true);
		$original_attachment_id = (int) ($job['original_attachment_id'] ?? $job['attachment_id'] ?? 0);
		$processed_url = (string) ($job['processed_url'] ?? wp_get_attachment_url($processed_attachment_id));
		$data = [
			'job_id'                 => (int) ($job['id'] ?? 0),
			'product_id'             => (int) ($job['product_id'] ?? 0),
			'image_role'             => sanitize_key((string) ($job['image_role'] ?? 'featured')),
			'gallery_index'          => (int) ($job['gallery_index'] ?? 0),
			'original_attachment_id'  => $original_attachment_id,
			'original_url'            => (string) wp_get_attachment_url($original_attachment_id),
			'original_file_path'      => (string) get_attached_file($original_attachment_id),
			'processed_attachment_id' => $processed_attachment_id,
			'processed_url'           => $processed_url,
			'processed_file_path'     => (string) get_attached_file($processed_attachment_id),
			'processing_mode'         => $this->get_processing_mode($job),
			'approval_status'         => 'approved',
			'approved_by'             => get_current_user_id(),
			'approved_at'             => $now,
			'safety_status'           => $safety['status'],
			'safety_metadata'         => wp_json_encode($safety['metadata']),
			'audit_scan_id'           => sanitize_text_field((string) ($job['audit_scan_id'] ?? '')),
			'audit_recommendation_id' => sanitize_text_field((string) ($job['audit_recommendation_id'] ?? '')),
			'audit_issue_id'          => sanitize_text_field((string) ($job['audit_issue_id'] ?? '')),
			'audit_queue_job_id'      => sanitize_text_field((string) ($job['audit_queue_job_id'] ?? '')),
			'created_at'              => $now,
			'updated_at'              => $now,
		];

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin version history insert.
		$wpdb->insert(optiimst_versions_table_name(), $data);

		return (int) $wpdb->insert_id;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private function get_latest_applied_version(int $job_id): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin version history lookup.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE job_id = %d AND approval_status = %s ORDER BY approved_at DESC, id DESC LIMIT 1',
				optiimst_versions_table_name(),
				$job_id,
				'approved'
			),
			ARRAY_A
		);

		return $row ?: null;
	}

	private function mark_version_reverted(int $version_id): void {
		if ($version_id <= 0) {
			return;
		}

		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin version history update.
		$wpdb->update(
			optiimst_versions_table_name(),
			[
				'approval_status' => 'reverted',
				'reverted_by'     => get_current_user_id(),
				'reverted_at'     => current_time('mysql', true),
				'updated_at'      => current_time('mysql', true),
			],
			['id' => $version_id]
		);
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return void
	 */
	private function replace_product_image(array $job, int $target_attachment_id): void {
		$product_id = (int) ($job['product_id'] ?? 0);
		$role       = (string) ($job['image_role'] ?? 'featured');

		if ('featured' === $role || 'main' === $role) {
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
}
