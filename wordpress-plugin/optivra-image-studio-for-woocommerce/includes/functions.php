<?php
/**
 * Shared plugin helpers.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

/**
 * Return the processing jobs table name.
 *
 * @return string
 */
function catalogue_image_studio_table_name(): string {
	global $wpdb;

	return $wpdb->prefix . 'catalogue_image_studio_jobs';
}
