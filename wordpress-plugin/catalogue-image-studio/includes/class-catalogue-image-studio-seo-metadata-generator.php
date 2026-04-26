<?php
/**
 * Product-aware SEO metadata generation for processed images.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_SEO_Metadata_Generator {
	/**
	 * Generate SEO metadata from WooCommerce product context.
	 *
	 * @param int                 $product_id Product ID.
	 * @param int                 $attachment_id Source attachment ID.
	 * @param string              $slot Image slot.
	 * @param string              $original_filename Original filename.
	 * @param string              $processed_filename Processed filename.
	 * @param array<string,mixed> $settings Plugin settings.
	 * @return array<string,string>
	 */
	public function generate(int $product_id, int $attachment_id, string $slot, string $original_filename, string $processed_filename, array $settings): array {
		$product = function_exists('wc_get_product') ? wc_get_product($product_id) : null;
		$title   = $product ? trim((string) $product->get_name()) : trim((string) get_the_title($product_id));

		if ('' === $title) {
			$title = __('Product', 'optivra-image-studio-for-woocommerce');
		}

		$categories = $this->get_terms($product_id, 'product_cat');
		$tags       = $this->get_terms($product_id, 'product_tag');
		$brand      = $this->get_brand($product_id);
		$attributes = $product ? $this->get_attributes($product) : [];
		$sku        = $product ? trim((string) $product->get_sku()) : '';
		$suffix     = trim((string) ($settings['brand_keyword_suffix'] ?? $settings['seo_brand_suffix'] ?? ''));
		$store      = trim((string) get_bloginfo('name'));

		$category_phrase = $this->build_category_phrase($categories, $tags, $attributes);
		$product_type    = '' !== $category_phrase ? $category_phrase : __('product accessory', 'optivra-image-studio-for-woocommerce');
		$modifier        = $this->first_useful([$brand, $attributes['colour'] ?? '', $attributes['color'] ?? '', $attributes['material'] ?? '', $attributes['type'] ?? '']);

		$filename_terms = array_filter([
			$title,
			$brand,
			$category_phrase,
			$suffix,
		]);
		$filename = $this->seo_filename(implode(' ', $filename_terms), $processed_filename ?: $original_filename);

		$alt_parts = array_filter([
			$title,
			$this->natural_join([$modifier, $product_type]),
		]);
		$alt = $this->trim_sentence(
			sprintf(
				/* translators: 1: product name, 2: product/category phrase */
				__('%1$s, shown as %2$s.', 'optivra-image-studio-for-woocommerce'),
				$title,
				'' !== implode(' ', $alt_parts) ? strtolower($this->natural_join([$modifier, $product_type])) : strtolower($product_type)
			),
			140
		);

		$image_title = $title;
		if ('' !== $category_phrase) {
			$image_title .= ' - ' . $this->title_case($category_phrase);
		}

		$caption = $this->trim_sentence(
			sprintf(
				/* translators: 1: product name, 2: product/category phrase */
				__('%1$s for %2$s.', 'optivra-image-studio-for-woocommerce'),
				$title,
				strtolower($product_type)
			),
			160
		);

		$description_bits = array_filter([
			sprintf(
				/* translators: 1: product name, 2: product/category phrase */
				__('Optimised product image for %1$s, a %2$s', 'optivra-image-studio-for-woocommerce'),
				$title,
				strtolower($product_type)
			),
			/* translators: %s: store name. */
			'' !== $store ? sprintf(__('available from %s', 'optivra-image-studio-for-woocommerce'), $store) : '',
		]);
		$description = rtrim(implode(' ', $description_bits), '.') . '.';

		if ('' !== $sku) {
			/* translators: %s: product SKU. */
			$description .= ' ' . sprintf(__('SKU: %s.', 'optivra-image-studio-for-woocommerce'), $sku);
		}

		return [
			'filename'    => ! empty($settings['generate_seo_filename']) ? $filename : '',
			'alt_text'    => ! empty($settings['generate_alt_text']) ? $alt : '',
			'title'       => ! empty($settings['generate_image_title']) ? sanitize_text_field($image_title) : '',
			'caption'     => ! empty($settings['generate_caption']) ? sanitize_text_field($caption) : '',
			'description' => ! empty($settings['generate_description']) ? sanitize_textarea_field($description) : '',
		];
	}

	/**
	 * @return array<int,string>
	 */
	private function get_terms(int $product_id, string $taxonomy): array {
		$terms = get_the_terms($product_id, $taxonomy);

		if (! is_array($terms)) {
			return [];
		}

		return array_values(array_filter(array_map(static function ($term): string {
			return isset($term->name) ? trim((string) $term->name) : '';
		}, $terms)));
	}

	private function get_brand(int $product_id): string {
		foreach (['pa_brand', 'brand', 'product_brand'] as $taxonomy) {
			$terms = $this->get_terms($product_id, $taxonomy);
			if (! empty($terms)) {
				return (string) $terms[0];
			}
		}

		return '';
	}

	/**
	 * @return array<string,string>
	 */
	private function get_attributes(WC_Product $product): array {
		$values = [];

		foreach ($product->get_attributes() as $attribute) {
			$name = sanitize_key(str_replace('pa_', '', (string) $attribute->get_name()));
			$text = '';

			if ($attribute->is_taxonomy()) {
				$terms = wc_get_product_terms($product->get_id(), $attribute->get_name(), ['fields' => 'names']);
				$text  = is_array($terms) ? implode(' ', array_map('strval', $terms)) : '';
			} else {
				$text = implode(' ', array_map('strval', $attribute->get_options()));
			}

			if ('' !== trim($text)) {
				$values[$name] = trim($text);
			}
		}

		return $values;
	}

	/**
	 * @param array<int,string>    $categories Categories.
	 * @param array<int,string>    $tags Tags.
	 * @param array<string,string> $attributes Attributes.
	 */
	private function build_category_phrase(array $categories, array $tags, array $attributes): string {
		$terms = array_merge(
			$categories,
			array_intersect_key($attributes, array_flip(['model', 'type', 'material', 'compatibility', 'size', 'platform', 'system']))
		);

		if (empty($terms)) {
			$terms = array_slice($tags, 0, 2);
		}

		$phrase = trim(implode(' ', array_slice(array_unique(array_filter(array_map('strval', $terms))), 0, 3)));

		return sanitize_text_field($phrase);
	}

	/**
	 * @param array<int,string> $values Values.
	 */
	private function first_useful(array $values): string {
		foreach ($values as $value) {
			$value = trim((string) $value);
			if ('' !== $value) {
				return $value;
			}
		}

		return '';
	}

	/**
	 * @param array<int,string> $parts Parts.
	 */
	private function natural_join(array $parts): string {
		return trim(implode(' ', array_filter(array_map('trim', $parts))));
	}

	private function seo_filename(string $text, string $fallback_filename): string {
		$extension = strtolower((string) pathinfo($fallback_filename, PATHINFO_EXTENSION));
		if ('' === $extension || strlen($extension) > 5) {
			$extension = 'webp';
		}

		$text = strtolower(remove_accents($text));
		$text = preg_replace('/\b(photoroom|scaled|edited|export|img|image|photo|copy|final)\b/', ' ', (string) $text);
		$text = preg_replace('/\b(20\d{6,}|19\d{6,}|\d{6,})\b/', ' ', (string) $text);
		$text = preg_replace('/[^a-z0-9]+/', '-', (string) $text);
		$text = trim((string) $text, '-');

		$stop_words = ['the', 'and', 'for', 'with', 'from', 'your'];
		$parts = array_values(array_filter(explode('-', $text), static function (string $part) use ($stop_words): bool {
			return '' !== $part && ! in_array($part, $stop_words, true);
		}));

		$slug = substr(implode('-', $parts), 0, 80);
		$slug = trim($slug, '-');

		if ('' === $slug) {
			$slug = 'optimised-product-image';
		}

		return sanitize_file_name($slug . '.' . $extension);
	}

	private function trim_sentence(string $text, int $max_length): string {
		$text = trim(preg_replace('/\s+/', ' ', $text));
		if (strlen($text) <= $max_length) {
			return sanitize_text_field($text);
		}

		$text = substr($text, 0, $max_length);
		$text = preg_replace('/\s+\S*$/', '', $text);

		return sanitize_text_field(rtrim((string) $text, ',.;') . '.');
	}

	private function title_case(string $text): string {
		return ucwords(strtolower($text));
	}
}
