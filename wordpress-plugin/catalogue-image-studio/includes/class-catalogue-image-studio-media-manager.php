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
	public function sideload_processed_image(string $processed_url, int $product_id, int $source_attachment_id = 0) {
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$tmp = download_url($processed_url, 60);

		if (is_wp_error($tmp)) {
			return $tmp;
		}

		$source_post = $source_attachment_id ? get_post($source_attachment_id) : null;
		$file_name   = sanitize_file_name(($source_post ? $source_post->post_title : 'catalogue-image') . '-processed.png');
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

		$this->logger->info(
			'Processed image saved to media library.',
			[
				'product_id'    => $product_id,
				'attachment_id' => (int) $attachment_id,
			]
		);

		return (int) $attachment_id;
	}
}
