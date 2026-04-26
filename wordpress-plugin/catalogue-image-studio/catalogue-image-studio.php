<?php
/**
 * Plugin Name: Catalogue Image Studio
 * Plugin URI:  https://example.com/catalogue-image-studio
 * Description: WooCommerce catalogue image tooling for product image preparation.
 * Version:     0.1.0
 * Author:      Catalogue Image Studio
 * Text Domain: catalogue-image-studio
 * Requires PHP: 7.4
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

define('CIS_VERSION', '0.1.0');
define('CIS_FILE', __FILE__);
define('CIS_PATH', plugin_dir_path(__FILE__));
define('CIS_URL', plugin_dir_url(__FILE__));

/**
 * Minimum supported PHP version for the plugin runtime.
 */
define('CIS_MINIMUM_PHP_VERSION', '7.4');

/**
 * Check whether the current site meets plugin runtime requirements.
 *
 * @return bool
 */
function catalogue_image_studio_requirements_met() {
	return version_compare(PHP_VERSION, CIS_MINIMUM_PHP_VERSION, '>=');
}

/**
 * Render an admin notice when the site PHP version is too old.
 *
 * @return void
 */
function catalogue_image_studio_render_php_notice() {
	if (! current_user_can('activate_plugins')) {
		return;
	}

	printf(
		'<div class="notice notice-error"><p>%s</p></div>',
		esc_html(
			sprintf(
				/* translators: 1: current PHP version, 2: required PHP version */
				__('Catalogue Image Studio requires PHP %2$s or newer. This site is running PHP %1$s.', 'catalogue-image-studio'),
				PHP_VERSION,
				CIS_MINIMUM_PHP_VERSION
			)
		)
	);
}

/**
 * Prevent activation on unsupported PHP versions.
 *
 * @return void
 */
function catalogue_image_studio_activate() {
	if (catalogue_image_studio_requirements_met()) {
		Catalogue_Image_Studio_Plugin::activate();
		return;
	}

	deactivate_plugins(plugin_basename(CIS_FILE));

	wp_die(
		esc_html(
			sprintf(
				/* translators: 1: current PHP version, 2: required PHP version */
				__('Catalogue Image Studio requires PHP %2$s or newer. This site is running PHP %1$s.', 'catalogue-image-studio'),
				PHP_VERSION,
				CIS_MINIMUM_PHP_VERSION
			)
		),
		esc_html__('Plugin activation failed', 'catalogue-image-studio'),
		['back_link' => true]
	);
}

if (! catalogue_image_studio_requirements_met()) {
	add_action('admin_notices', 'catalogue_image_studio_render_php_notice');
	return;
}

require_once CIS_PATH . 'includes/functions.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-logger.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-job-repository.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-saas-client.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-product-scanner.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-media-manager.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-approval-manager.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-image-processor.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-plugin.php';
require_once CIS_PATH . 'admin/class-catalogue-image-studio-admin.php';

register_activation_hook(CIS_FILE, 'catalogue_image_studio_activate');

add_action(
	'plugins_loaded',
	static function () {
		$plugin = Catalogue_Image_Studio_Plugin::instance();

		if (is_admin()) {
			new Catalogue_Image_Studio_Admin($plugin);
		}
	}
);
