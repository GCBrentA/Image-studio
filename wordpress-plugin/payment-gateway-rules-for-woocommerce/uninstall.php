<?php
/**
 * Uninstall cleanup.
 *
 * @package PaymentGatewayRulesForWooCommerce
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$pgrfw_settings = get_option( 'pgrfw_gateway_rules_settings', array() );

if ( is_array( $pgrfw_settings ) && ! empty( $pgrfw_settings['delete_settings_on_uninstall'] ) ) {
	delete_option( 'pgrfw_gateway_rules' );
	delete_option( 'pgrfw_gateway_rules_settings' );
}
