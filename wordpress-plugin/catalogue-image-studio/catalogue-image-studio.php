<?php
/**
 * Plugin Name: Catalogue Image Studio
 * Plugin URI:  https://example.com/catalogue-image-studio
 * Description: WooCommerce catalogue image tooling for product image preparation.
 * Version:     0.1.0
 * Author:      Catalogue Image Studio
 * Text Domain: catalogue-image-studio
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

register_activation_hook(CIS_FILE, ['Catalogue_Image_Studio_Plugin', 'activate']);

add_action(
	'plugins_loaded',
	static function (): void {
		$plugin = Catalogue_Image_Studio_Plugin::instance();

		if (is_admin()) {
			new Catalogue_Image_Studio_Admin($plugin);
		}
	}
);
