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
		$result = $this->collect_product_images($args);

		return $result['slots'];
	}

	/**
	 * Scan products and persist reusable jobs.
	 *
	 * @param array<string,mixed> $args Query filters.
	 * @return array<string,mixed>
	 */
	public function scan(array $args = []): array {
		$result = $this->collect_product_images($args);
		$job_ids = [];

		foreach ($result['slots'] as $slot) {
			$job_ids[] = $this->jobs->upsert_from_slot($slot);
		}

		$summary = $result['summary'];
		$summary['slots_found'] = count($result['slots']);
		$summary['jobs']        = count($job_ids);

		$this->logger->info('Product image scan completed.', $summary);

		return [
			'slots_found' => count($result['slots']),
			'job_ids'     => $job_ids,
			'summary'     => $summary,
		];
	}

	/**
	 * @param array<string,mixed> $args Query filters.
	 * @return array{slots: array<int,array<string,mixed>>, summary: array<string,mixed>}
	 */
	private function collect_product_images(array $args): array {
		$products = $this->get_products($args);
		$slots    = [];
		$summary  = [
			'products_scanned' => count($products),
			'featured_found'   => 0,
			'gallery_found'    => 0,
			'category_found'   => 0,
			'skipped_total'    => 0,
			'skipped'          => [],
		];

		foreach ($products as $product) {
			if (! $product instanceof WC_Product) {
				$this->increment_skip($summary, 'invalid_product');
				continue;
			}

			$product_id = (int) $product->get_id();
			if ($product_id <= 0) {
				$this->increment_skip($summary, 'missing_product_id');
				continue;
			}

			$seen_attachment_ids = [];

			if (! empty($args['include_featured'])) {
				$featured_id = absint($product->get_image_id());
				if ($this->append_slot($slots, $summary, $seen_attachment_ids, $product, $featured_id, 'featured', 0)) {
					$summary['featured_found']++;
				}
			}

			if (! empty($args['include_gallery'])) {
				$gallery_ids = array_values(array_filter(array_map('absint', $product->get_gallery_image_ids())));
				foreach ($gallery_ids as $index => $gallery_id) {
					if ($this->append_slot($slots, $summary, $seen_attachment_ids, $product, $gallery_id, 'gallery', (int) $index)) {
						$summary['gallery_found']++;
					}
				}
			}

			if (! empty($args['include_category'])) {
				$terms = wp_get_post_terms($product_id, 'product_cat');

				if (is_wp_error($terms)) {
					$this->increment_skip($summary, 'category_term_lookup_failed');
				} else {
					foreach ($terms as $term) {
						if (! $term instanceof WP_Term) {
							continue;
						}

						$thumbnail_id = absint((string) get_term_meta($term->term_id, 'thumbnail_id', true));
						if ($this->append_slot($slots, $summary, $seen_attachment_ids, $product, $thumbnail_id, 'category', (int) $term->term_id, $term)) {
							$summary['category_found']++;
						}
					}
				}
			}
		}

		return [
			'slots'   => $slots,
			'summary' => $summary,
		];
	}

	/**
	 * @param array<string,mixed> $args Query filters.
	 * @return array<int,WC_Product>
	 */
	private function get_products(array $args): array {
		if (! function_exists('wc_get_products')) {
			return [];
		}

		$query_args = [
			'limit'  => isset($args['limit']) ? max(1, absint($args['limit'])) : -1,
			'status' => $this->normalize_status_filter($args['status'] ?? 'publish'),
			'type'   => ['simple', 'variable'],
			'orderby' => 'date',
			'order'   => 'DESC',
		];

		if (! empty($args['product_ids']) && is_array($args['product_ids'])) {
			$query_args['include'] = array_values(array_filter(array_map('absint', $args['product_ids'])));
		}

		if (! empty($args['category'])) {
			$term = get_term(absint($args['category']), 'product_cat');
			if ($term instanceof WP_Term) {
				$query_args['category'] = [$term->slug];
			}
		}

		if (! empty($args['product_type'])) {
			$product_type = sanitize_key((string) $args['product_type']);
			if (in_array($product_type, ['simple', 'variable'], true)) {
				$query_args['type'] = [$product_type];
			}
		}

		if (! empty($args['stock_status'])) {
			$query_args['stock_status'] = sanitize_key((string) $args['stock_status']);
		}

		$products = wc_get_products($query_args);

		return is_array($products) ? $products : [];
	}

	/**
	 * @param array<string,mixed> $summary Summary.
	 * @param array<int,int>      $seen_attachment_ids Seen IDs for this product.
	 */
	private function append_slot(array &$slots, array &$summary, array &$seen_attachment_ids, WC_Product $product, int $attachment_id, string $image_role, int $gallery_index, ?WP_Term $category_term = null): bool {
		if ($attachment_id <= 0) {
			$this->increment_skip($summary, 'empty_attachment_id');
			return false;
		}

		if (in_array($attachment_id, $seen_attachment_ids, true)) {
			$this->increment_skip($summary, 'duplicate_attachment_per_product');
			return false;
		}

		$attachment = get_post($attachment_id);
		if (! $attachment || 'attachment' !== $attachment->post_type) {
			$this->increment_skip($summary, 'missing_attachment_post');
			return false;
		}

		if (! $this->is_supported_attachment($attachment_id)) {
			$this->increment_skip($summary, 'unsupported_attachment_type');
			return false;
		}

		$seen_attachment_ids[] = $attachment_id;
		$slot = [
			'product_id'     => (int) $product->get_id(),
			'product_name'   => (string) $product->get_name(),
			'attachment_id'  => $attachment_id,
			'image_url'      => (string) (wp_get_attachment_image_url($attachment_id, 'thumbnail') ?: wp_get_attachment_url($attachment_id)),
			'image_role'     => $image_role,
			'gallery_index'  => $gallery_index,
			'current_status' => 'unprocessed',
		];

		if ($category_term instanceof WP_Term) {
			$slot['category_id']   = (int) $category_term->term_id;
			$slot['category_name'] = (string) $category_term->name;
		}

		$job = $this->jobs->find_by_slot($slot);
		if ($job) {
			$slot['current_status'] = (string) ($job['status'] ?? 'unprocessed');
		}

		$slots[] = $slot;

		return true;
	}

	/**
	 * @param array<string,mixed>|string $status Status filter.
	 * @return array<int,string>
	 */
	private function normalize_status_filter($status): array {
		$statuses = is_array($status) ? $status : [$status];
		$normalized = [];

		foreach ($statuses as $item) {
			$item = sanitize_key((string) $item);
			if ('all' === $item) {
				return ['publish', 'draft', 'private'];
			}

			if (in_array($item, ['publish', 'draft', 'private'], true)) {
				$normalized[] = $item;
			}
		}

		return empty($normalized) ? ['publish'] : array_values(array_unique($normalized));
	}

	/**
	 * @param array<string,mixed> $summary Summary.
	 */
	private function increment_skip(array &$summary, string $reason): void {
		$summary['skipped_total'] = (int) ($summary['skipped_total'] ?? 0) + 1;
		$summary['skipped'][$reason] = (int) ($summary['skipped'][$reason] ?? 0) + 1;
	}

	private function is_supported_attachment(int $attachment_id): bool {
		$mime = (string) get_post_mime_type($attachment_id);

		if (0 !== strpos($mime, 'image/') || 'image/svg+xml' === $mime) {
			return false;
		}

		$file      = (string) get_attached_file($attachment_id);
		$url       = (string) wp_get_attachment_url($attachment_id);
		$extension = '';

		if ('' !== $file) {
			$extension = strtolower((string) pathinfo($file, PATHINFO_EXTENSION));
		}

		if ('' === $extension && '' !== $url) {
			$extension = strtolower((string) pathinfo((string) wp_parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
		}

		if ('' === $extension) {
			return in_array($mime, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'], true);
		}

		return in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true);
	}
}
