<?php
/**
 * Plugin Name: Optivra Image Studio for WooCommerce
 * Plugin URI:  https://www.optivra.app/docs/optivra-image-studio
 * Description: AI-powered product image optimisation, background replacement, review workflow, and SEO metadata for WooCommerce.
 * Version:     1.0.0
 * Author:      Optivra
 * Author URI:  https://www.optivra.app
 * License:     GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: optivra-image-studio-for-woocommerce
 * Requires at least: 6.3
 * Requires PHP: 8.0
 * WC requires at least: 8.0
 * WC tested up to: 10.5.3
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

define('CIS_VERSION', '1.0.0');
define('CIS_FILE', __FILE__);
define('CIS_PATH', plugin_dir_path(__FILE__));
define('CIS_URL', plugin_dir_url(__FILE__));
define('OPTIVRA_PRODUCT_NAME', 'Optivra Image Studio');
define('OPTIVRA_PLUGIN_DISPLAY_NAME', 'Optivra Image Studio for WooCommerce');
define('OPTIVRA_PRODUCT_TAGLINE', 'AI-powered product image optimisation for WooCommerce.');
define('CIS_TERMS_URL', 'https://www.optivra.app/terms');
define('CIS_PRIVACY_URL', 'https://www.optivra.app/privacy');
define('CIS_DATA_URL', 'https://www.optivra.app/docs/ai-image-studio');
define('CIS_SUPPORT_URL', 'https://www.optivra.app/support');
define('CIS_SUPPORT_EMAIL', 'support@optivra.app');

/**
 * Minimum supported PHP version for the plugin runtime.
 */
define('CIS_MINIMUM_PHP_VERSION', '8.0');

/**
 * Check whether the current site meets plugin runtime requirements.
 *
 * @return bool
 */
function catalogue_image_studio_requirements_met() {
	return version_compare(PHP_VERSION, CIS_MINIMUM_PHP_VERSION, '>=');
}

function catalogue_image_studio_is_woocommerce_active(): bool {
	return class_exists('WooCommerce') && function_exists('wc_get_products');
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
				__('Optivra Image Studio requires PHP %2$s or newer. This site is running PHP %1$s.', 'optivra-image-studio-for-woocommerce'),
				PHP_VERSION,
				CIS_MINIMUM_PHP_VERSION
			)
		)
	);
}

function catalogue_image_studio_render_woocommerce_notice(): void {
	if (! current_user_can('activate_plugins')) {
		return;
	}

	printf(
		'<div class="notice notice-warning"><p>%s</p></div>',
		esc_html__('Optivra requires WooCommerce to scan, queue, process, and replace product images. Activate WooCommerce before using Optivra.', 'optivra-image-studio-for-woocommerce')
	);
}

/**
 * Prevent activation on unsupported PHP versions.
 *
 * @return void
 */
function catalogue_image_studio_activate() {
	if (catalogue_image_studio_requirements_met()) {
		if ('' === (string) get_option('optivra_image_studio_install_id', '')) {
			update_option('optivra_image_studio_install_id', wp_generate_uuid4(), false);
		}

		Catalogue_Image_Studio_Plugin::activate();
		return;
	}

	deactivate_plugins(plugin_basename(CIS_FILE));

	wp_die(
		esc_html(
			sprintf(
				/* translators: 1: current PHP version, 2: required PHP version */
				__('Optivra Image Studio requires PHP %2$s or newer. This site is running PHP %1$s.', 'optivra-image-studio-for-woocommerce'),
				PHP_VERSION,
				CIS_MINIMUM_PHP_VERSION
			)
		),
		esc_html__('Plugin activation failed', 'optivra-image-studio-for-woocommerce'),
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
require_once CIS_PATH . 'includes/class-catalogue-image-studio-seo-metadata-generator.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-approval-manager.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-image-processor.php';
require_once CIS_PATH . 'includes/class-catalogue-image-studio-plugin.php';
require_once CIS_PATH . 'admin/class-catalogue-image-studio-admin.php';

register_activation_hook(CIS_FILE, 'catalogue_image_studio_activate');

add_action(
	'plugins_loaded',
	static function () {
		$plugin = Catalogue_Image_Studio_Plugin::instance();

		if ('' === (string) get_option('optivra_image_studio_install_id', '')) {
			update_option('optivra_image_studio_install_id', wp_generate_uuid4(), false);
		}

		if (is_admin()) {
			if (! catalogue_image_studio_is_woocommerce_active()) {
				add_action('admin_notices', 'catalogue_image_studio_render_woocommerce_notice');
			}

			new Catalogue_Image_Studio_Admin($plugin);
		}
	}
);
