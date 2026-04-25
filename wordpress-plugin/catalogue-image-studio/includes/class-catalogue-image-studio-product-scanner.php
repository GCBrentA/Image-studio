<?php
/**
 * WooCommerce product image scanner.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_ProductScanner {
	private Catalogue_Image_Studio_Job_Repository $jobs;

	private Catalogue_Image_Studio_Logger $logger;

	public function __construct(Catalogue_Image_Studio_Job_Repository $jobs, Catalogue_Image_Studio_Logger $logger) {
		$this->jobs   = $jobs;
		$this->logger = $logger;
	}

	/**
	 * Retrieve reusable WooCommerce product image slots.
	 *
	 * @param array<string,mixed> $args Query filters.
	 * @return array<int,array<string,mixed>>
	 */
	public function get_product_images(array $args = []): array {
		$product_ids = $this->get_product_ids($args);
		$slots       = [];

		foreach ($product_ids as $product_id) {
			$featured_id = absint(get_post_thumbnail_id($product_id));

			if ($featured_id && $this->is_supported_attachment($featured_id)) {
				$slots[] = [
					'product_id'    => $product_id,
					'attachment_id' => $featured_id,
					'image_role'    => 'featured',
					'gallery_index' => 0,
				];
			}

			$gallery_ids = array_values(array_filter(array_map('absint', explode(',', (string) get_post_meta($product_id, '_product_image_gallery', true)))));

			foreach ($gallery_ids as $index => $gallery_id) {
				if (! $gallery_id || ! $this->is_supported_attachment($gallery_id)) {
					continue;
				}

				$slots[] = [
					'product_id'    => $product_id,
					'attachment_id' => $gallery_id,
					'image_role'    => 'gallery',
					'gallery_index' => (int) $index,
				];
			}
		}

		return $slots;
	}

	/**
	 * Scan products and persist reusable jobs.
	 *
	 * @param array<string,mixed> $args Query filters.
	 * @return array<string,mixed>
	 */
	public function scan(array $args = []): array {
		$slots   = $this->get_product_images($args);
		$job_ids = [];

		foreach ($slots as $slot) {
			$job_ids[] = $this->jobs->upsert_from_slot($slot);
		}

		$this->logger->info(
			'Product image scan completed.',
			[
				'slots_found' => count($slots),
				'jobs'        => count($job_ids),
			]
		);

		return [
			'slots_found' => count($slots),
			'job_ids'     => $job_ids,
		];
	}

	/**
	 * @param array<string,mixed> $args Query filters.
	 * @return array<int,int>
	 */
	private function get_product_ids(array $args): array {
		$query_args = [
			'post_type'      => 'product',
			'post_status'    => ['publish', 'private'],
			'fields'         => 'ids',
			'posts_per_page' => isset($args['limit']) ? absint($args['limit']) : -1,
			'orderby'        => 'ID',
			'order'          => 'DESC',
		];

		if (! empty($args['product_ids']) && is_array($args['product_ids'])) {
			$query_args['post__in'] = array_map('absint', $args['product_ids']);
		}

		if (! empty($args['status'])) {
			$query_args['post_status'] = array_map('sanitize_key', (array) $args['status']);
		}

		return array_map('absint', get_posts($query_args));
	}

	private function is_supported_attachment(int $attachment_id): bool {
		$mime = (string) get_post_mime_type($attachment_id);

		if (0 !== strpos($mime, 'image/') || 'image/svg+xml' === $mime) {
			return false;
		}

		$file = (string) get_attached_file($attachment_id);

		if ('' === $file || ! file_exists($file)) {
			return false;
		}

		$extension = strtolower((string) pathinfo($file, PATHINFO_EXTENSION));

		return in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true);
	}
}
