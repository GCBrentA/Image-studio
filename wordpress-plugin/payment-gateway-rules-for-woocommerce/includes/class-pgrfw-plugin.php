<?php
/**
 * Plugin bootstrap.
 *
 * @package PaymentGatewayRulesForWooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Loads admin and checkout integrations.
 */
final class PGRFW_Plugin {
	/**
	 * Singleton instance.
	 *
	 * @var PGRFW_Plugin|null
	 */
	private static $instance = null;

	/**
	 * Rule engine.
	 *
	 * @var PGRFW_Rule_Engine
	 */
	private $engine;

	/**
	 * Return singleton instance.
	 *
	 * @return PGRFW_Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Seed default options.
	 *
	 * @return void
	 */
	public static function activate() {
		if ( false === get_option( PGRFW_RULES_OPTION, false ) ) {
			add_option( PGRFW_RULES_OPTION, array(), '', false );
		}

		if ( false === get_option( PGRFW_SETTINGS_OPTION, false ) ) {
			add_option( PGRFW_SETTINGS_OPTION, self::default_settings(), '', false );
		}
	}

	/**
	 * Return default settings.
	 *
	 * @return array<string,mixed>
	 */
	public static function default_settings() {
		return array(
			'all_hidden_fallback'        => 'restore_all',
			'debug_mode'                 => 0,
			'delete_settings_on_uninstall' => 0,
		);
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		$this->engine = new PGRFW_Rule_Engine();

		add_action( 'admin_notices', array( $this, 'maybe_render_woocommerce_notice' ) );

		if ( $this->is_woocommerce_active() ) {
			add_filter( 'woocommerce_available_payment_gateways', array( $this->engine, 'filter_available_gateways' ), 100 );
		}

		if ( is_admin() ) {
			new PGRFW_Admin( $this->engine );
		}
	}

	/**
	 * Check whether WooCommerce is active.
	 *
	 * @return bool
	 */
	public function is_woocommerce_active() {
		return class_exists( 'WooCommerce' );
	}

	/**
	 * Render WooCommerce dependency notice.
	 *
	 * @return void
	 */
	public function maybe_render_woocommerce_notice() {
		if ( $this->is_woocommerce_active() || ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		echo '<div class="notice notice-warning"><p>';
		echo esc_html__( 'Payment Gateway Rules for WooCommerce is active, but WooCommerce is not active. Activate WooCommerce to configure gateway rules.', 'payment-gateway-rules-for-woocommerce' );
		echo '</p></div>';
	}
}
