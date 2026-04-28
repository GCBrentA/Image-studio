<?php
/**
 * Admin UI.
 *
 * @package PaymentGatewayRulesForWooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Renders and saves gateway rules.
 */
class PGRFW_Admin {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	private $page_slug = 'pgrfw-gateway-rules';

	/**
	 * Rule engine.
	 *
	 * @var PGRFW_Rule_Engine
	 */
	private $engine;

	/**
	 * Constructor.
	 *
	 * @param PGRFW_Rule_Engine $engine Rule engine.
	 */
	public function __construct( PGRFW_Rule_Engine $engine ) {
		$this->engine = $engine;

		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_init', array( $this, 'handle_save' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Register WooCommerce submenu.
	 *
	 * @return void
	 */
	public function register_menu() {
		add_submenu_page(
			'woocommerce',
			__( 'Payment Gateway Rules', 'payment-gateway-rules-for-woocommerce' ),
			__( 'Gateway Rules', 'payment-gateway-rules-for-woocommerce' ),
			'manage_woocommerce',
			$this->page_slug,
			array( $this, 'render_page' )
		);
	}

	/**
	 * Enqueue admin CSS.
	 *
	 * @param string $hook Hook.
	 * @return void
	 */
	public function enqueue_assets( $hook ) {
		if ( false === strpos( $hook, $this->page_slug ) ) {
			return;
		}

		wp_enqueue_style( 'pgrfw-admin', PGRFW_URL . 'assets/admin.css', array(), PGRFW_VERSION );
	}

	/**
	 * Save rules/settings.
	 *
	 * @return void
	 */
	public function handle_save() {
		if ( ! isset( $_POST['pgrfw_nonce'] ) ) {
			return;
		}

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage payment gateway rules.', 'payment-gateway-rules-for-woocommerce' ) );
		}

		check_admin_referer( 'pgrfw_save_rules', 'pgrfw_nonce' );

		$action = isset( $_POST['pgrfw_action'] ) ? sanitize_key( wp_unslash( (string) $_POST['pgrfw_action'] ) ) : '';
		if ( 'save_rules' !== $action ) {
			return;
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitized field-by-field in sanitize_rules_payload().
		$rules_raw = isset( $_POST['pgrfw_rules'] ) ? wp_unslash( $_POST['pgrfw_rules'] ) : array();
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitized field-by-field in sanitize_settings_payload().
		$settings_raw = isset( $_POST['pgrfw_settings'] ) ? wp_unslash( $_POST['pgrfw_settings'] ) : array();

		$rules    = $this->sanitize_rules_payload( is_array( $rules_raw ) ? $rules_raw : array() );
		$settings = $this->sanitize_settings_payload( is_array( $settings_raw ) ? $settings_raw : array() );

		update_option( PGRFW_RULES_OPTION, $rules, false );
		update_option( PGRFW_SETTINGS_OPTION, $settings, false );

		$redirect_url = add_query_arg(
			array(
				'page'          => $this->page_slug,
				'pgrfw_updated' => '1',
			),
			admin_url( 'admin.php' )
		);

		wp_safe_redirect( $redirect_url );
		exit;
	}

	/**
	 * Sanitize rules payload.
	 *
	 * @param array<int,array<string,mixed>> $rules_raw Raw rules.
	 * @return array<int,array<string,mixed>>
	 */
	private function sanitize_rules_payload( array $rules_raw ) {
		$rules = array();

		foreach ( $rules_raw as $rule_raw ) {
			if ( ! is_array( $rule_raw ) || ! empty( $rule_raw['delete'] ) ) {
				continue;
			}

			$name     = isset( $rule_raw['name'] ) ? sanitize_text_field( $rule_raw['name'] ) : '';
			$gateways = $this->engine->sanitize_gateway_ids( isset( $rule_raw['gateways'] ) ? $rule_raw['gateways'] : array() );

			if ( '' === $name && empty( $gateways ) ) {
				continue;
			}

			$rule = array(
				'id'             => isset( $rule_raw['id'] ) && '' !== $rule_raw['id'] ? sanitize_key( $rule_raw['id'] ) : wp_generate_uuid4(),
				'name'           => $name,
				'enabled'        => ! empty( $rule_raw['enabled'] ) ? 1 : 0,
				'match_type'     => $this->engine->sanitize_match_type( isset( $rule_raw['match_type'] ) ? $rule_raw['match_type'] : 'billing_country' ),
				'countries'      => $this->engine->sanitize_code_list( isset( $rule_raw['countries'] ) ? $rule_raw['countries'] : array(), 2 ),
				'currencies'     => $this->engine->sanitize_code_list( isset( $rule_raw['currencies'] ) ? $rule_raw['currencies'] : array(), 3 ),
				'cart_condition' => $this->engine->sanitize_cart_condition( isset( $rule_raw['cart_condition'] ) ? $rule_raw['cart_condition'] : 'greater_than' ),
				'cart_min'       => isset( $rule_raw['cart_min'] ) ? $this->sanitize_decimal( $rule_raw['cart_min'] ) : '0',
				'cart_max'       => isset( $rule_raw['cart_max'] ) ? $this->sanitize_decimal( $rule_raw['cart_max'] ) : '0',
				'gateways'       => $gateways,
				'action'         => $this->engine->sanitize_action( isset( $rule_raw['action'] ) ? $rule_raw['action'] : PGRFW_Rule_Engine::ACTION_HIDE ),
				'priority'       => isset( $rule_raw['priority'] ) ? absint( $rule_raw['priority'] ) : 10,
			);

			$rules[] = $rule;
		}

		return $rules;
	}

	/**
	 * Sanitize settings payload.
	 *
	 * @param array<string,mixed> $settings_raw Raw settings.
	 * @return array<string,mixed>
	 */
	private function sanitize_settings_payload( array $settings_raw ) {
		$fallback = isset( $settings_raw['all_hidden_fallback'] ) ? sanitize_key( $settings_raw['all_hidden_fallback'] ) : 'restore_all';

		return array(
			'all_hidden_fallback'        => in_array( $fallback, array( 'restore_all', 'keep_hidden' ), true ) ? $fallback : 'restore_all',
			'debug_mode'                 => ! empty( $settings_raw['debug_mode'] ) ? 1 : 0,
			'delete_settings_on_uninstall' => ! empty( $settings_raw['delete_settings_on_uninstall'] ) ? 1 : 0,
		);
	}

	/**
	 * Sanitize a decimal value without requiring WooCommerce helpers.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	private function sanitize_decimal( $value ) {
		$value = preg_replace( '/[^0-9.\-]/', '', (string) $value );

		return (string) max( 0, (float) $value );
	}

	/**
	 * Render admin page.
	 *
	 * @return void
	 */
	public function render_page() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'payment-gateway-rules-for-woocommerce' ) );
		}

		$rules    = $this->engine->get_rules();
		$settings = $this->engine->get_settings();
		$gateways = $this->engine->get_gateway_registry();
		$countries = function_exists( 'WC' ) ? WC()->countries->get_countries() : array();
		$rules[] = $this->blank_rule();

		?>
		<div class="wrap pgrfw-wrap">
			<h1><?php esc_html_e( 'Payment Gateway Rules for WooCommerce', 'payment-gateway-rules-for-woocommerce' ); ?></h1>
			<p class="description"><?php esc_html_e( 'Show or hide payment gateways using billing country, shipping country, currency, and optional cart total rules.', 'payment-gateway-rules-for-woocommerce' ); ?></p>

			<?php
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only admin notice flag after wp_safe_redirect().
			$updated = isset( $_GET['pgrfw_updated'] ) ? sanitize_key( wp_unslash( (string) $_GET['pgrfw_updated'] ) ) : '';
			?>
			<?php if ( '1' === $updated ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Gateway rules saved.', 'payment-gateway-rules-for-woocommerce' ); ?></p></div>
			<?php endif; ?>

			<?php if ( ! class_exists( 'WooCommerce' ) ) : ?>
				<div class="notice notice-warning"><p><?php esc_html_e( 'WooCommerce is inactive. Rules can be edited, but they will only run after WooCommerce is active.', 'payment-gateway-rules-for-woocommerce' ); ?></p></div>
			<?php elseif ( empty( $gateways ) ) : ?>
				<div class="notice notice-warning"><p><?php esc_html_e( 'No payment gateways were detected. Enable at least one WooCommerce payment gateway before testing rules.', 'payment-gateway-rules-for-woocommerce' ); ?></p></div>
			<?php endif; ?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin.php?page=' . $this->page_slug ) ); ?>">
				<?php wp_nonce_field( 'pgrfw_save_rules', 'pgrfw_nonce' ); ?>
				<input type="hidden" name="pgrfw_action" value="save_rules" />

				<div class="pgrfw-grid">
					<div class="pgrfw-card pgrfw-card-main">
						<h2><?php esc_html_e( 'Rules', 'payment-gateway-rules-for-woocommerce' ); ?></h2>
						<p><?php esc_html_e( 'Rules run from lowest priority number to highest. Add a blank rule at the bottom, then save.', 'payment-gateway-rules-for-woocommerce' ); ?></p>
						<?php foreach ( $rules as $index => $rule ) : ?>
							<?php $this->render_rule_card( $index, $rule, $countries, $gateways ); ?>
						<?php endforeach; ?>
					</div>

					<div class="pgrfw-card">
						<h2><?php esc_html_e( 'Safety and debug', 'payment-gateway-rules-for-woocommerce' ); ?></h2>
						<?php $this->render_settings_panel( $settings ); ?>
						<?php $this->render_debug_panel( $gateways ); ?>
					</div>
				</div>

				<p class="submit">
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Save Gateway Rules', 'payment-gateway-rules-for-woocommerce' ); ?></button>
				</p>
			</form>
		</div>
		<?php
	}

	/**
	 * Return a blank rule.
	 *
	 * @return array<string,mixed>
	 */
	private function blank_rule() {
		return array(
			'id'             => '',
			'name'           => '',
			'enabled'        => 0,
			'match_type'     => 'billing_country',
			'countries'      => array(),
			'currencies'     => array(),
			'cart_condition' => 'greater_than',
			'cart_min'       => '',
			'cart_max'       => '',
			'gateways'       => array(),
			'action'         => 'hide',
			'priority'       => 10,
		);
	}

	/**
	 * Render one rule card.
	 *
	 * @param int                 $index Index.
	 * @param array<string,mixed> $rule Rule.
	 * @param array<string,string> $countries Countries.
	 * @param array<string,array<string,mixed>> $gateways Gateways.
	 * @return void
	 */
	private function render_rule_card( $index, array $rule, array $countries, array $gateways ) {
		$field = 'pgrfw_rules[' . absint( $index ) . ']';
		$is_new = empty( $rule['id'] ) && empty( $rule['name'] );

		?>
		<div class="pgrfw-rule-card">
			<div class="pgrfw-rule-header">
				<h3><?php echo $is_new ? esc_html__( 'Add new rule', 'payment-gateway-rules-for-woocommerce' ) : esc_html( $rule['name'] ); ?></h3>
				<label>
					<input type="checkbox" name="<?php echo esc_attr( $field ); ?>[enabled]" value="1" <?php checked( ! empty( $rule['enabled'] ) ); ?> />
					<?php esc_html_e( 'Enabled', 'payment-gateway-rules-for-woocommerce' ); ?>
				</label>
			</div>
			<input type="hidden" name="<?php echo esc_attr( $field ); ?>[id]" value="<?php echo esc_attr( $rule['id'] ); ?>" />

			<div class="pgrfw-fields">
				<label>
					<span><?php esc_html_e( 'Rule name', 'payment-gateway-rules-for-woocommerce' ); ?></span>
					<input type="text" name="<?php echo esc_attr( $field ); ?>[name]" value="<?php echo esc_attr( $rule['name'] ); ?>" placeholder="<?php esc_attr_e( 'Example: Show Square in Australia', 'payment-gateway-rules-for-woocommerce' ); ?>" />
				</label>

				<label>
					<span><?php esc_html_e( 'Priority', 'payment-gateway-rules-for-woocommerce' ); ?></span>
					<input type="number" min="0" step="1" name="<?php echo esc_attr( $field ); ?>[priority]" value="<?php echo esc_attr( (string) $rule['priority'] ); ?>" />
				</label>

				<label>
					<span><?php esc_html_e( 'Match type', 'payment-gateway-rules-for-woocommerce' ); ?></span>
					<select name="<?php echo esc_attr( $field ); ?>[match_type]">
						<?php $this->render_option( 'billing_country', __( 'Billing country', 'payment-gateway-rules-for-woocommerce' ), $rule['match_type'] ); ?>
						<?php $this->render_option( 'shipping_country', __( 'Shipping country', 'payment-gateway-rules-for-woocommerce' ), $rule['match_type'] ); ?>
						<?php $this->render_option( 'currency', __( 'Active currency', 'payment-gateway-rules-for-woocommerce' ), $rule['match_type'] ); ?>
						<?php $this->render_option( 'cart_total', __( 'Cart total', 'payment-gateway-rules-for-woocommerce' ), $rule['match_type'] ); ?>
					</select>
				</label>

				<label>
					<span><?php esc_html_e( 'Action', 'payment-gateway-rules-for-woocommerce' ); ?></span>
					<select name="<?php echo esc_attr( $field ); ?>[action]">
						<?php $this->render_option( 'hide', __( 'Hide selected gateways', 'payment-gateway-rules-for-woocommerce' ), $rule['action'] ); ?>
						<?php $this->render_option( 'show', __( 'Show only selected gateways', 'payment-gateway-rules-for-woocommerce' ), $rule['action'] ); ?>
					</select>
				</label>
			</div>

			<div class="pgrfw-fields pgrfw-fields-wide">
				<label>
					<span><?php esc_html_e( 'Countries', 'payment-gateway-rules-for-woocommerce' ); ?></span>
					<select multiple="multiple" size="6" name="<?php echo esc_attr( $field ); ?>[countries][]">
						<?php foreach ( $countries as $code => $label ) : ?>
							<option value="<?php echo esc_attr( $code ); ?>" <?php selected( in_array( $code, (array) $rule['countries'], true ) ); ?>><?php echo esc_html( $label . ' (' . $code . ')' ); ?></option>
						<?php endforeach; ?>
					</select>
					<em><?php esc_html_e( 'Used for billing or shipping country rules.', 'payment-gateway-rules-for-woocommerce' ); ?></em>
				</label>

				<label>
					<span><?php esc_html_e( 'Currency codes', 'payment-gateway-rules-for-woocommerce' ); ?></span>
					<input type="text" name="<?php echo esc_attr( $field ); ?>[currencies]" value="<?php echo esc_attr( implode( ', ', (array) $rule['currencies'] ) ); ?>" placeholder="<?php esc_attr_e( 'AUD, USD, GBP', 'payment-gateway-rules-for-woocommerce' ); ?>" />
					<em><?php esc_html_e( 'Used for active currency rules. Enter comma-separated ISO currency codes.', 'payment-gateway-rules-for-woocommerce' ); ?></em>
				</label>

				<label>
					<span><?php esc_html_e( 'Cart total condition', 'payment-gateway-rules-for-woocommerce' ); ?></span>
					<select name="<?php echo esc_attr( $field ); ?>[cart_condition]">
						<?php $this->render_option( 'greater_than', __( 'Greater than', 'payment-gateway-rules-for-woocommerce' ), $rule['cart_condition'] ); ?>
						<?php $this->render_option( 'less_than', __( 'Less than', 'payment-gateway-rules-for-woocommerce' ), $rule['cart_condition'] ); ?>
						<?php $this->render_option( 'between', __( 'Between', 'payment-gateway-rules-for-woocommerce' ), $rule['cart_condition'] ); ?>
					</select>
					<div class="pgrfw-inline">
						<input type="number" step="0.01" min="0" name="<?php echo esc_attr( $field ); ?>[cart_min]" value="<?php echo esc_attr( (string) $rule['cart_min'] ); ?>" placeholder="<?php esc_attr_e( 'Minimum', 'payment-gateway-rules-for-woocommerce' ); ?>" />
						<input type="number" step="0.01" min="0" name="<?php echo esc_attr( $field ); ?>[cart_max]" value="<?php echo esc_attr( (string) $rule['cart_max'] ); ?>" placeholder="<?php esc_attr_e( 'Maximum', 'payment-gateway-rules-for-woocommerce' ); ?>" />
					</div>
				</label>
			</div>

			<div class="pgrfw-gateways">
				<strong><?php esc_html_e( 'Target gateways', 'payment-gateway-rules-for-woocommerce' ); ?></strong>
				<?php if ( empty( $gateways ) ) : ?>
					<p><?php esc_html_e( 'No gateways detected yet.', 'payment-gateway-rules-for-woocommerce' ); ?></p>
				<?php else : ?>
					<?php foreach ( $gateways as $gateway ) : ?>
						<label>
							<input type="checkbox" name="<?php echo esc_attr( $field ); ?>[gateways][]" value="<?php echo esc_attr( $gateway['id'] ); ?>" <?php checked( in_array( $gateway['id'], (array) $rule['gateways'], true ) ); ?> />
							<?php echo esc_html( $gateway['title'] ); ?> <code><?php echo esc_html( $gateway['id'] ); ?></code>
						</label>
					<?php endforeach; ?>
				<?php endif; ?>
			</div>

			<?php if ( ! $is_new ) : ?>
				<label class="pgrfw-delete">
					<input type="checkbox" name="<?php echo esc_attr( $field ); ?>[delete]" value="1" />
					<?php esc_html_e( 'Delete this rule on save', 'payment-gateway-rules-for-woocommerce' ); ?>
				</label>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Render one select option.
	 *
	 * @param string $value Value.
	 * @param string $label Label.
	 * @param string $selected Selected value.
	 * @return void
	 */
	private function render_option( $value, $label, $selected ) {
		printf(
			'<option value="%1$s" %2$s>%3$s</option>',
			esc_attr( $value ),
			selected( $selected, $value, false ),
			esc_html( $label )
		);
	}

	/**
	 * Render settings panel.
	 *
	 * @param array<string,mixed> $settings Settings.
	 * @return void
	 */
	private function render_settings_panel( array $settings ) {
		?>
		<div class="pgrfw-setting">
			<label for="pgrfw_all_hidden_fallback"><strong><?php esc_html_e( 'If rules hide all gateways', 'payment-gateway-rules-for-woocommerce' ); ?></strong></label>
			<select id="pgrfw_all_hidden_fallback" name="pgrfw_settings[all_hidden_fallback]">
				<?php $this->render_option( 'restore_all', __( 'Restore all gateways (recommended)', 'payment-gateway-rules-for-woocommerce' ), $settings['all_hidden_fallback'] ); ?>
				<?php $this->render_option( 'keep_hidden', __( 'Keep hidden and show admin warning', 'payment-gateway-rules-for-woocommerce' ), $settings['all_hidden_fallback'] ); ?>
			</select>
			<p><?php esc_html_e( 'The default protects checkout from accidental misconfiguration.', 'payment-gateway-rules-for-woocommerce' ); ?></p>
		</div>
		<label class="pgrfw-check">
			<input type="checkbox" name="pgrfw_settings[debug_mode]" value="1" <?php checked( ! empty( $settings['debug_mode'] ) ); ?> />
			<?php esc_html_e( 'Enable WooCommerce logger debug entries', 'payment-gateway-rules-for-woocommerce' ); ?>
		</label>
		<label class="pgrfw-check">
			<input type="checkbox" name="pgrfw_settings[delete_settings_on_uninstall]" value="1" <?php checked( ! empty( $settings['delete_settings_on_uninstall'] ) ); ?> />
			<?php esc_html_e( 'Delete settings on uninstall', 'payment-gateway-rules-for-woocommerce' ); ?>
		</label>
		<?php
	}

	/**
	 * Render debug/test panel.
	 *
	 * @param array<string,array<string,mixed>> $gateways Gateways.
	 * @return void
	 */
	private function render_debug_panel( array $gateways ) {
		$context = $this->engine->get_checkout_context();
		$mock_gateways = array();

		foreach ( $gateways as $gateway_id => $gateway ) {
			$mock_gateways[ $gateway_id ] = (object) $gateway;
		}

		$result = $this->engine->evaluate_rules( $mock_gateways, $context );

		?>
		<hr />
		<h2><?php esc_html_e( 'Debug / test panel', 'payment-gateway-rules-for-woocommerce' ); ?></h2>
		<table class="widefat striped pgrfw-debug-table">
			<tbody>
				<tr><th><?php esc_html_e( 'Billing country', 'payment-gateway-rules-for-woocommerce' ); ?></th><td><?php echo esc_html( $context['billing_country'] ? $context['billing_country'] : __( 'Not detected', 'payment-gateway-rules-for-woocommerce' ) ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Shipping country', 'payment-gateway-rules-for-woocommerce' ); ?></th><td><?php echo esc_html( $context['shipping_country'] ? $context['shipping_country'] : __( 'Not detected', 'payment-gateway-rules-for-woocommerce' ) ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Active currency', 'payment-gateway-rules-for-woocommerce' ); ?></th><td><?php echo esc_html( $context['currency'] ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Cart total', 'payment-gateway-rules-for-woocommerce' ); ?></th><td><?php echo esc_html( function_exists( 'wc_price' ) ? wp_strip_all_tags( wc_price( (float) $context['cart_total'] ) ) : (string) $context['cart_total'] ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Matched rules', 'payment-gateway-rules-for-woocommerce' ); ?></th><td><?php echo esc_html( $this->format_rule_names( $result['matched_rules'] ) ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Final visible gateways', 'payment-gateway-rules-for-woocommerce' ); ?></th><td><?php echo esc_html( implode( ', ', array_keys( $result['gateways'] ) ) ); ?></td></tr>
			</tbody>
		</table>
		<?php
	}

	/**
	 * Format matched rule names.
	 *
	 * @param array<int,array<string,mixed>> $rules Rules.
	 * @return string
	 */
	private function format_rule_names( array $rules ) {
		if ( empty( $rules ) ) {
			return __( 'None', 'payment-gateway-rules-for-woocommerce' );
		}

		return implode(
			', ',
			array_map(
				static function ( $rule ) {
					return isset( $rule['name'] ) ? (string) $rule['name'] : '';
				},
				$rules
			)
		);
	}
}
