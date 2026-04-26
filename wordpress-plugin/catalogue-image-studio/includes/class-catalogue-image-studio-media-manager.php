<?php
/**
 * WordPress media library operations.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_MediaManager {
	private Catalogue_Image_Studio_Logger $logger;

	public function __construct(Catalogue_Image_Studio_Logger $logger) {
		$this->logger = $logger;
	}

	/**
	 * Sideload a processed image into the media library.
	 *
	 * @param string $processed_url Processed image URL.
	 * @param int    $product_id Product ID.
	 * @param int    $source_attachment_id Original attachment ID.
	 * @return int|\WP_Error
	 */
	public function sideload_processed_image(string $processed_url, int $product_id, int $source_attachment_id = 0, array $seo = [], array $settings = []) {
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$tmp = download_url($processed_url, 60);

		if (is_wp_error($tmp)) {
			return $tmp;
		}

		$source_post = $source_attachment_id ? get_post($source_attachment_id) : null;
		$file_name   = ! empty($settings['enable_filename_seo']) && ! empty($seo['filename'])
			? sanitize_file_name((string) $seo['filename'])
			: sanitize_file_name(($source_post ? $source_post->post_title : 'catalogue-image') . '-processed.webp');

		if ('' === pathinfo($file_name, PATHINFO_EXTENSION)) {
			$file_name .= '.webp';
		}

		$file_array  = [
			'name'     => $file_name,
			'tmp_name' => $tmp,
		];

		$attachment_id = media_handle_sideload($file_array, $product_id);

		if (is_wp_error($attachment_id)) {
			@unlink($tmp);
			return $attachment_id;
		}

		if ($source_attachment_id) {
			$alt_text = get_post_meta($source_attachment_id, '_wp_attachment_image_alt', true);

			if ('' !== (string) $alt_text) {
				update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt_text);
			}

			update_post_meta($attachment_id, '_catalogue_image_studio_original_attachment_id', $source_attachment_id);
		}

		$this->apply_seo_metadata((int) $attachment_id, $seo, $settings);

		$this->logger->info(
			'Processed image saved to media library.',
			[
				'product_id'    => $product_id,
				'attachment_id' => (int) $attachment_id,
			]
		);

		return (int) $attachment_id;
	}

	/**
	 * @param array<string,string> $seo SEO metadata.
	 * @param array<string,mixed>  $settings Settings.
	 */
	private function apply_seo_metadata(int $attachment_id, array $seo, array $settings): void {
		$only_fill_missing = ! empty($settings['only_fill_missing']);
		$overwrite         = ! empty($settings['overwrite_existing_meta']);

		$post = get_post($attachment_id);

		if (! $post) {
			return;
		}

		$post_update = [
			'ID' => $attachment_id,
		];

		if (! empty($settings['generate_image_title']) && ! empty($seo['title']) && ($overwrite || ! $only_fill_missing || '' === trim((string) $post->post_title))) {
			$post_update['post_title'] = sanitize_text_field((string) $seo['title']);
		}

		if (! empty($seo['caption']) && ($overwrite || ! $only_fill_missing || '' === trim((string) $post->post_excerpt))) {
			$post_update['post_excerpt'] = sanitize_text_field((string) $seo['caption']);
		}

		if (! empty($seo['description']) && ($overwrite || ! $only_fill_missing || '' === trim((string) $post->post_content))) {
			$post_update['post_content'] = wp_kses_post((string) $seo['description']);
		}

		if (count($post_update) > 1) {
			wp_update_post($post_update);
		}

		if (empty($settings['enable_alt_text']) || empty($seo['alt_text'])) {
			return;
		}

		$current_alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);

		if ($overwrite || ! $only_fill_missing || '' === trim((string) $current_alt)) {
			update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field((string) $seo['alt_text']));
		}
	}
}
