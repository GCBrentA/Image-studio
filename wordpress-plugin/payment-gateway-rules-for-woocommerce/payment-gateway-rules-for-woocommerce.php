<?php
/**
 * Plugin Name: Payment Gateway Rules for WooCommerce
 * Plugin URI: https://www.optivra.app/payment-gateway-rules-for-woocommerce
 * Description: Show or hide WooCommerce payment gateways by billing country, shipping country, currency, and cart total rules.
 * Version: 1.0.0
 * Author: Optivra
 * Author URI: https://www.optivra.app
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: payment-gateway-rules-for-woocommerce
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 * WC tested up to: 9.8
 *
 * @package PaymentGatewayRulesForWooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PGRFW_VERSION', '1.0.0' );
define( 'PGRFW_FILE', __FILE__ );
define( 'PGRFW_PATH', plugin_dir_path( __FILE__ ) );
define( 'PGRFW_URL', plugin_dir_url( __FILE__ ) );
define( 'PGRFW_TEXT_DOMAIN', 'payment-gateway-rules-for-woocommerce' );
define( 'PGRFW_RULES_OPTION', 'pgrfw_gateway_rules' );
define( 'PGRFW_SETTINGS_OPTION', 'pgrfw_gateway_rules_settings' );

add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', PGRFW_FILE, true );
		}
	}
);

require_once PGRFW_PATH . 'includes/class-pgrfw-plugin.php';
require_once PGRFW_PATH . 'includes/class-pgrfw-rule-engine.php';
require_once PGRFW_PATH . 'includes/class-pgrfw-admin.php';

register_activation_hook( PGRFW_FILE, array( 'PGRFW_Plugin', 'activate' ) );

add_action(
	'plugins_loaded',
	static function () {
		PGRFW_Plugin::instance();
	}
);
