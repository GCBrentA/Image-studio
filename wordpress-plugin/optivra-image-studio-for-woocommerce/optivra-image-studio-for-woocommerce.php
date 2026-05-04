<?php
/**
 * Plugin Name: Optivra Image Studio for WooCommerce
 * Plugin URI:  https://www.optivra.app/docs/optivra-image-studio
 * Description: AI product image studio for WooCommerce with product-preserve background replacement, lighting enhancement, health scanning, review queues, and SEO recommendations.
 * Version:     1.0.0
 * Author:      Optivra
 * Author URI:  https://www.optivra.app
 * License:     GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: optivra-image-studio-for-woocommerce
 * Requires at least: 6.3
 * Requires PHP: 8.0
 * Requires Plugins: woocommerce
 * WC requires at least: 8.0
 * WC tested up to: 10.5.3
 *
 * @package Optiimst
 */

if (! defined('ABSPATH')) {
	exit;
}

define('OPTIIMST_VERSION', '1.0.0');
define('OPTIIMST_FILE', __FILE__);
define('OPTIIMST_PATH', plugin_dir_path(__FILE__));
define('OPTIIMST_URL', plugin_dir_url(__FILE__));
define('OPTIIMST_PRODUCT_NAME', 'Optivra Image Studio');
define('OPTIIMST_PLUGIN_DISPLAY_NAME', 'Optivra Image Studio for WooCommerce');
define('OPTIIMST_PRODUCT_TAGLINE', 'AI product image studio for WooCommerce.');
define('OPTIIMST_TERMS_URL', 'https://www.optivra.app/terms');
define('OPTIIMST_PRIVACY_URL', 'https://www.optivra.app/privacy');
define('OPTIIMST_DATA_URL', 'https://www.optivra.app/docs/ai-image-studio');
define('OPTIIMST_SUPPORT_URL', 'https://www.optivra.app/support');
define('OPTIIMST_SUPPORT_EMAIL', 'support@optivra.app');

/**
 * Minimum supported PHP version for the plugin runtime.
 */
define('OPTIIMST_MINIMUM_PHP_VERSION', '8.0');

add_action(
	'before_woocommerce_init',
	static function () {
		if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', OPTIIMST_FILE, true);
		}
	}
);

/**
 * Check whether the current site meets plugin runtime requirements.
 *
 * @return bool
 */
function optiimst_requirements_met() {
	return version_compare(PHP_VERSION, OPTIIMST_MINIMUM_PHP_VERSION, '>=');
}

function optiimst_is_woocommerce_active(): bool {
	return class_exists('WooCommerce') && function_exists('wc_get_products');
}

/**
 * Determine whether a dependency notice belongs on the current admin screen.
 *
 * @return bool
 */
function optiimst_is_dependency_notice_screen(): bool {
	$screen = function_exists('get_current_screen') ? get_current_screen() : null;
	if (! $screen) {
		return false;
	}

	if ('plugins' === $screen->base) {
		return true;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only screen routing for scoped dependency notices.
	return isset($_GET['page']) && 0 === strpos(sanitize_key(wp_unslash($_GET['page'])), 'optivra-image-studio');
}

/**
 * Render an admin notice when the site PHP version is too old.
 *
 * @return void
 */
function optiimst_render_php_notice() {
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
				OPTIIMST_MINIMUM_PHP_VERSION
			)
		)
	);
}

function optiimst_render_woocommerce_notice(): void {
	if (! current_user_can('activate_plugins') || ! optiimst_is_dependency_notice_screen()) {
		return;
	}

	printf(
		'<div class="notice notice-warning is-dismissible"><p>%s</p></div>',
		esc_html__('Optivra requires WooCommerce to scan, queue, process, and replace product images. Activate WooCommerce before using Optivra.', 'optivra-image-studio-for-woocommerce')
	);
}

/**
 * Prevent activation on unsupported PHP versions.
 *
 * @return void
 */
function optiimst_activate() {
	if (optiimst_requirements_met()) {
		optiimst_migrate_legacy_stored_data();
		if ('' === (string) optiimst_get_option('optiimst_image_studio_install_id', '')) {
			optiimst_update_option('optiimst_image_studio_install_id', wp_generate_uuid4(), false);
		}

		Optiimst_Plugin::activate();
		return;
	}

	deactivate_plugins(plugin_basename(OPTIIMST_FILE));

	wp_die(
		esc_html(
			sprintf(
				/* translators: 1: current PHP version, 2: required PHP version */
				__('Optivra Image Studio requires PHP %2$s or newer. This site is running PHP %1$s.', 'optivra-image-studio-for-woocommerce'),
				PHP_VERSION,
				OPTIIMST_MINIMUM_PHP_VERSION
			)
		),
		esc_html__('Plugin activation failed', 'optivra-image-studio-for-woocommerce'),
		['back_link' => true]
	);
}

if (! optiimst_requirements_met()) {
	add_action('admin_notices', 'optiimst_render_php_notice');
	return;
}

require_once OPTIIMST_PATH . 'includes/functions.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-logger.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-job-repository.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-saas-client.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-product-scanner.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-media-manager.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-seo-metadata-generator.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-approval-manager.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-image-processor.php';
require_once OPTIIMST_PATH . 'includes/class-catalogue-image-studio-plugin.php';
require_once OPTIIMST_PATH . 'admin/class-catalogue-image-studio-admin.php';

register_activation_hook(OPTIIMST_FILE, 'optiimst_activate');

add_action(
	'plugins_loaded',
	static function () {
		if (is_admin()) {
			optiimst_migrate_legacy_stored_data();
			Optiimst_Plugin::maybe_upgrade_schema();
		}

		$plugin = Optiimst_Plugin::instance();

		if ('' === (string) optiimst_get_option('optiimst_image_studio_install_id', '')) {
			optiimst_update_option('optiimst_image_studio_install_id', wp_generate_uuid4(), false);
		}

		if (is_admin()) {
			if (! optiimst_is_woocommerce_active()) {
				add_action('admin_notices', 'optiimst_render_woocommerce_notice');
				return;
			}

			new Optiimst_Admin($plugin);
		}
	}
);
