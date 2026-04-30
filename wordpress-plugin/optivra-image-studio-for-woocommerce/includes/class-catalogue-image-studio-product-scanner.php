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
	 * Count products for a Product Image Health Report scan.
	 *
	 * @param array<string,mixed> $args Query filters.
	 * @return int
	 */
	public function count_audit_products(array $args = []): int {
		if (! function_exists('wc_get_products')) {
			return 0;
		}

		$query_args = $this->build_product_query_args($args);
		$query_args['limit']    = 1;
		$query_args['paginate'] = true;

		$result = wc_get_products($query_args);

		if (is_object($result) && isset($result->total)) {
			return max(0, (int) $result->total);
		}

		$products = $this->get_products($args);

		return count($products);
	}

	/**
	 * Collect one bounded audit metadata batch. This does not create processing jobs or use credits.
	 *
	 * @param array<string,mixed> $args Query filters/options.
	 * @param int                 $offset Product offset.
	 * @param int                 $limit Product batch size.
	 * @return array<string,mixed>
	 */
	public function collect_audit_batch(array $args = [], int $offset = 0, int $limit = 25): array {
		$args['offset'] = max(0, $offset);
		$args['limit']  = max(1, min(100, $limit));

		$products = $this->get_products($args);
		$items = [];
		$warnings = [];
		$errors = [];
		$summary = [
			'products_scanned' => count($products),
			'images_scanned'   => 0,
			'main_images'      => 0,
			'gallery_images'   => 0,
			'variation_images' => 0,
			'category_images'  => 0,
			'missing_main'     => 0,
		];

		foreach ($products as $product) {
			if (! $product instanceof WC_Product) {
				$warnings[] = __('Skipped an invalid product row.', 'optivra-image-studio-for-woocommerce');
				continue;
			}

			if (! $this->audit_product_matches_scope($product, $args)) {
				continue;
			}

			$product_id = (int) $product->get_id();
			$categories = $this->get_product_category_payload($product_id);
			$seen_attachment_ids = [];
			$product_item_count = 0;

			if (empty($product->get_image_id())) {
				$summary['missing_main']++;
			}

			if (! empty($args['include_main_images'])) {
				$item = $this->build_audit_item($product, absint($product->get_image_id()), 'main', 0, $categories);
				if ($item) {
					$items[] = $item;
					$seen_attachment_ids[] = (int) $item['_attachment_id'];
					$summary['main_images']++;
					$product_item_count++;
				}
			}

			if (! empty($args['include_gallery_images'])) {
				foreach (array_values(array_filter(array_map('absint', $product->get_gallery_image_ids()))) as $index => $attachment_id) {
					if (in_array($attachment_id, $seen_attachment_ids, true)) {
						continue;
					}

					$item = $this->build_audit_item($product, $attachment_id, 'gallery', (int) $index, $categories);
					if ($item) {
						$items[] = $item;
						$seen_attachment_ids[] = $attachment_id;
						$summary['gallery_images']++;
						$product_item_count++;
					}
				}
			}

			if (! empty($args['include_variation_images']) && $product->is_type('variable')) {
				foreach (array_values(array_filter(array_map('absint', $product->get_children()))) as $variation_index => $variation_id) {
					$variation = wc_get_product($variation_id);
					if (! $variation instanceof WC_Product) {
						continue;
					}

					$attachment_id = absint($variation->get_image_id());
					if ($attachment_id <= 0 || in_array($attachment_id, $seen_attachment_ids, true)) {
						continue;
					}

					$item = $this->build_audit_item($product, $attachment_id, 'variation', (int) $variation_index, $categories, $variation);
					if ($item) {
						$items[] = $item;
						$seen_attachment_ids[] = $attachment_id;
						$summary['variation_images']++;
						$product_item_count++;
					}
				}
			}

			if (! empty($args['include_category_thumbnails'])) {
				$terms = wp_get_post_terms($product_id, 'product_cat');
				if (is_wp_error($terms)) {
					$errors[] = __('Could not read product categories for one product.', 'optivra-image-studio-for-woocommerce');
				} else {
					foreach ($terms as $term) {
						if (! $term instanceof WP_Term) {
							continue;
						}

						$attachment_id = absint((string) get_term_meta($term->term_id, 'thumbnail_id', true));
						if ($attachment_id <= 0 || in_array($attachment_id, $seen_attachment_ids, true)) {
							continue;
						}

						$item = $this->build_audit_item($product, $attachment_id, 'category_thumbnail', (int) $term->term_id, $categories);
						if ($item) {
							$items[] = $item;
							$seen_attachment_ids[] = $attachment_id;
							$summary['category_images']++;
							$product_item_count++;
						}
					}
				}
			}

			if (0 === $product_item_count) {
				$items[] = $this->build_audit_product_fallback_item($product, $categories);
			}
		}

		foreach ($items as &$item) {
			unset($item['_attachment_id']);
		}
		unset($item);

		$summary['images_scanned'] = count(array_filter($items, static function ($item): bool {
			return is_array($item) && ! empty($item['_audit_item']);
		}));

		return [
			'items'     => $items,
			'summary'   => $summary,
			'warnings'  => array_values(array_unique($warnings)),
			'errors'    => array_values(array_unique($errors)),
			'has_more'  => count($products) >= (int) $args['limit'],
			'next_offset' => (int) $args['offset'] + (int) $args['limit'],
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

		$query_args = $this->build_product_query_args($args);

		$products = wc_get_products($query_args);

		return is_array($products) ? $products : [];
	}

	/**
	 * @param array<string,mixed> $args Query filters.
	 * @return array<string,mixed>
	 */
	private function build_product_query_args(array $args): array {
		$query_args = [
			'limit'   => isset($args['limit']) ? max(1, absint($args['limit'])) : -1,
			'status'  => $this->normalize_status_filter($args['status'] ?? 'publish'),
			'type'    => ['simple', 'variable'],
			'orderby' => 'date',
			'order'   => 'DESC',
		];

		if (isset($args['offset'])) {
			$query_args['offset'] = max(0, absint($args['offset']));
		}

		if (! empty($args['product_ids']) && is_array($args['product_ids'])) {
			$query_args['include'] = array_values(array_filter(array_map('absint', $args['product_ids'])));
		}

		$category_ids = [];
		if (! empty($args['category'])) {
			$category_ids[] = absint($args['category']);
		}
		if (! empty($args['category_ids']) && is_array($args['category_ids'])) {
			$category_ids = array_merge($category_ids, array_map('absint', $args['category_ids']));
		}

		$category_slugs = [];
		foreach (array_values(array_unique(array_filter($category_ids))) as $category_id) {
			$term = get_term($category_id, 'product_cat');
			if ($term instanceof WP_Term) {
				$category_slugs[] = $term->slug;
			}
		}
		if (! empty($category_slugs)) {
			$query_args['category'] = array_values(array_unique($category_slugs));
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

		if (! empty($args['updated_since'])) {
			$timestamp = strtotime((string) $args['updated_since']);
			if ($timestamp) {
				$query_args['date_modified'] = '>' . $timestamp;
			}
		}

		return $query_args;
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
	 * @param array<string,mixed> $args Scan args.
	 */
	private function audit_product_matches_scope(WC_Product $product, array $args): bool {
		$scope = sanitize_key((string) ($args['scan_scope'] ?? 'all'));

		if ('missing_main' === $scope) {
			return absint($product->get_image_id()) <= 0;
		}

		if ('unprocessed' === $scope) {
			$slots = $this->collect_product_images(
				[
					'product_ids'       => [(int) $product->get_id()],
					'include_featured'  => true,
					'include_gallery'   => true,
					'include_category'  => false,
					'status'            => 'all',
				]
			);

			foreach ($slots['slots'] as $slot) {
				if (! in_array((string) ($slot['current_status'] ?? 'unprocessed'), ['completed', 'approved'], true)) {
					return true;
				}
			}

			return false;
		}

		return true;
	}

	/**
	 * @return array{ids:array<int,string>,names:array<int,string>}
	 */
	private function get_product_category_payload(int $product_id): array {
		$terms = wp_get_post_terms($product_id, 'product_cat');
		$payload = [
			'ids'   => [],
			'names' => [],
		];

		if (is_wp_error($terms)) {
			return $payload;
		}

		foreach ($terms as $term) {
			if (! $term instanceof WP_Term) {
				continue;
			}

			$payload['ids'][] = (string) $term->term_id;
			$payload['names'][] = (string) $term->name;
		}

		return $payload;
	}

	/**
	 * @param array{ids:array<int,string>,names:array<int,string>} $categories Product categories.
	 * @return array<string,mixed>|null
	 */
	private function build_audit_item(WC_Product $product, int $attachment_id, string $image_role, int $index, array $categories, ?WC_Product $variation = null): ?array {
		if ($attachment_id <= 0 || ! $this->is_supported_attachment($attachment_id)) {
			return null;
		}

		$attachment = get_post($attachment_id);
		if (! $attachment || 'attachment' !== $attachment->post_type) {
			return null;
		}

		$source_url = (string) wp_get_attachment_url($attachment_id);
		if ('' === $source_url) {
			return null;
		}

		$file_path = (string) get_attached_file($attachment_id);
		$metadata = wp_get_attachment_metadata($attachment_id);
		$width = 0;
		$height = 0;

		if (is_array($metadata)) {
			$width = isset($metadata['width']) ? absint($metadata['width']) : 0;
			$height = isset($metadata['height']) ? absint($metadata['height']) : 0;
		}

		if (($width <= 0 || $height <= 0) && '' !== $file_path && file_exists($file_path)) {
			$size = wp_getimagesize($file_path);
			if (is_array($size)) {
				$width = absint($size[0] ?? 0);
				$height = absint($size[1] ?? 0);
			}
		}

		$filename = '' !== $file_path ? wp_basename($file_path) : wp_basename((string) wp_parse_url($source_url, PHP_URL_PATH));
		$product_id = (int) $product->get_id();
		$image_id = 'variation' === $image_role && $variation instanceof WC_Product
			? (string) $variation->get_id() . ':' . (string) $attachment_id
			: (string) $attachment_id;

		return [
			'_attachment_id'   => $attachment_id,
			'product_id'       => (string) $product_id,
			'product_name'     => (string) $product->get_name(),
			'product_sku'      => (string) $product->get_sku(),
			'product_url'      => (string) get_permalink($product_id),
			'product_type'     => (string) $product->get_type(),
			'product_status'   => (string) get_post_status($product_id),
			'product_updated_at' => $product->get_date_modified() ? $product->get_date_modified()->date('c') : '',
			'image_id'         => $image_id,
			'image_url'        => $source_url,
			'image_role'       => $image_role,
			'category_ids'     => $categories['ids'],
			'category_names'   => $categories['names'],
			'filename'         => (string) $filename,
			'file_extension'   => strtolower((string) pathinfo((string) $filename, PATHINFO_EXTENSION)),
			'mime_type'        => (string) get_post_mime_type($attachment_id),
			'width'            => $width > 0 ? $width : null,
			'height'           => $height > 0 ? $height : null,
			'file_size_bytes'  => ('' !== $file_path && file_exists($file_path)) ? (int) filesize($file_path) : null,
			'alt_text'         => (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true),
			'image_title'      => (string) $attachment->post_title,
			'caption'          => (string) $attachment->post_excerpt,
			'description'      => (string) $attachment->post_content,
			'upload_date'      => (string) get_post_time('c', true, $attachment_id),
			'gallery_index'    => $index,
			'_audit_item'      => true,
			'_queueable_image' => true,
		];
	}

	/**
	 * Build a product-level row when no queueable audit image was found.
	 *
	 * @param array{ids:array<int,string>,names:array<int,string>} $categories Product categories.
	 * @return array<string,mixed>
	 */
	private function build_audit_product_fallback_item(WC_Product $product, array $categories): array {
		$product_id = (int) $product->get_id();
		$attachment_id = absint($product->get_image_id());
		$image_role = 'main';
		$gallery_index = 0;

		if ($attachment_id <= 0) {
			$gallery_ids = array_values(array_filter(array_map('absint', $product->get_gallery_image_ids())));
			if (! empty($gallery_ids[0])) {
				$attachment_id = (int) $gallery_ids[0];
				$image_role = 'gallery';
			}
		}

		$image_url = $attachment_id > 0 ? (string) (wp_get_attachment_image_url($attachment_id, 'thumbnail') ?: wp_get_attachment_url($attachment_id)) : '';
		$issue_type = $attachment_id > 0 ? 'unsupported_image' : 'missing_main_image';
		$issue_label = $attachment_id > 0
			? __('Image could not be prepared for the health audit.', 'optivra-image-studio-for-woocommerce')
			: __('Product has no queueable product image.', 'optivra-image-studio-for-woocommerce');

		return [
			'_attachment_id'   => $attachment_id,
			'attachment_id'    => $attachment_id,
			'product_id'       => (string) $product_id,
			'product_name'     => (string) $product->get_name(),
			'product_sku'      => (string) $product->get_sku(),
			'product_url'      => (string) get_permalink($product_id),
			'product_type'     => (string) $product->get_type(),
			'product_status'   => (string) get_post_status($product_id),
			'product_updated_at' => $product->get_date_modified() ? $product->get_date_modified()->date('c') : '',
			'image_id'         => $attachment_id > 0 ? (string) $attachment_id : '',
			'image_url'        => $image_url,
			'image_role'       => $image_role,
			'category_ids'     => $categories['ids'],
			'category_names'   => $categories['names'],
			'filename'         => '',
			'file_extension'   => '',
			'mime_type'        => $attachment_id > 0 ? (string) get_post_mime_type($attachment_id) : '',
			'width'            => null,
			'height'           => null,
			'file_size_bytes'  => null,
			'alt_text'         => $attachment_id > 0 ? (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true) : '',
			'image_title'      => $attachment_id > 0 ? (string) get_the_title($attachment_id) : '',
			'caption'          => '',
			'description'      => '',
			'upload_date'      => $attachment_id > 0 ? (string) get_post_time('c', true, $attachment_id) : '',
			'gallery_index'    => $gallery_index,
			'status'           => __('Needs attention', 'optivra-image-studio-for-woocommerce'),
			'readiness'        => $attachment_id > 0 ? __('Review image', 'optivra-image-studio-for-woocommerce') : __('Image needed', 'optivra-image-studio-for-woocommerce'),
			'issues'           => [
				[
					'type'     => $issue_type,
					'label'    => $issue_label,
					'severity' => 'medium',
				],
			],
			'recommendations'  => [
				[
					'label'    => $attachment_id > 0 ? __('Review image before queueing', 'optivra-image-studio-for-woocommerce') : __('Add a product image', 'optivra-image-studio-for-woocommerce'),
					'severity' => 'info',
					'filter'   => $issue_type,
				],
			],
			'recommended'      => false,
			'_audit_item'      => false,
			'_queueable_image' => $attachment_id > 0,
		];
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
