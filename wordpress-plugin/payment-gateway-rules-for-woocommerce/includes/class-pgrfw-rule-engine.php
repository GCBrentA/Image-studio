<?php
/**
 * Gateway rule engine.
 *
 * @package PaymentGatewayRulesForWooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Evaluates saved rules and filters checkout gateways.
 */
class PGRFW_Rule_Engine {
	const ACTION_SHOW = 'show';
	const ACTION_HIDE = 'hide';

	/**
	 * Return saved settings merged with defaults.
	 *
	 * @return array<string,mixed>
	 */
	public function get_settings() {
		$settings = get_option( PGRFW_SETTINGS_OPTION, array() );
		$settings = is_array( $settings ) ? $settings : array();

		return wp_parse_args( $settings, PGRFW_Plugin::default_settings() );
	}

	/**
	 * Return sanitized saved rules.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public function get_rules() {
		$rules = get_option( PGRFW_RULES_OPTION, array() );
		$rules = is_array( $rules ) ? $rules : array();
		$rules = array_map( array( $this, 'normalize_rule' ), $rules );

		usort(
			$rules,
			static function ( $a, $b ) {
				$a_priority = isset( $a['priority'] ) ? (int) $a['priority'] : 10;
				$b_priority = isset( $b['priority'] ) ? (int) $b['priority'] : 10;

				return $a_priority <=> $b_priority;
			}
		);

		return $rules;
	}

	/**
	 * Normalize one rule.
	 *
	 * @param mixed $rule Rule.
	 * @return array<string,mixed>
	 */
	public function normalize_rule( $rule ) {
		$rule = is_array( $rule ) ? $rule : array();

		return array(
			'id'             => isset( $rule['id'] ) ? sanitize_key( $rule['id'] ) : wp_generate_uuid4(),
			'name'           => isset( $rule['name'] ) ? sanitize_text_field( $rule['name'] ) : '',
			'enabled'        => ! empty( $rule['enabled'] ) ? 1 : 0,
			'match_type'     => $this->sanitize_match_type( isset( $rule['match_type'] ) ? $rule['match_type'] : 'billing_country' ),
			'countries'      => $this->sanitize_code_list( isset( $rule['countries'] ) ? $rule['countries'] : array(), 2 ),
			'currencies'     => $this->sanitize_code_list( isset( $rule['currencies'] ) ? $rule['currencies'] : array(), 3 ),
			'cart_condition' => $this->sanitize_cart_condition( isset( $rule['cart_condition'] ) ? $rule['cart_condition'] : 'greater_than' ),
			'cart_min'       => isset( $rule['cart_min'] ) ? (float) $rule['cart_min'] : 0,
			'cart_max'       => isset( $rule['cart_max'] ) ? (float) $rule['cart_max'] : 0,
			'gateways'       => $this->sanitize_gateway_ids( isset( $rule['gateways'] ) ? $rule['gateways'] : array() ),
			'action'         => $this->sanitize_action( isset( $rule['action'] ) ? $rule['action'] : self::ACTION_HIDE ),
			'priority'       => isset( $rule['priority'] ) ? (int) $rule['priority'] : 10,
		);
	}

	/**
	 * Filter gateways during checkout.
	 *
	 * @param array<string,WC_Payment_Gateway> $available_gateways Available gateways.
	 * @return array<string,WC_Payment_Gateway>
	 */
	public function filter_available_gateways( $available_gateways ) {
		if ( ! is_array( $available_gateways ) || empty( $available_gateways ) || $this->should_bypass_filtering() ) {
			return $available_gateways;
		}

		$original_gateways = $available_gateways;
		$context           = $this->get_checkout_context();
		$result            = $this->evaluate_rules( $available_gateways, $context );
		$settings          = $this->get_settings();

		if ( empty( $result['gateways'] ) ) {
			if ( 'restore_all' === $settings['all_hidden_fallback'] ) {
				$this->log( 'Rules would hide all gateways; restoring all gateways because the safe fallback is enabled.', $result );
				return $original_gateways;
			}

			if ( current_user_can( 'manage_woocommerce' ) && function_exists( 'wc_add_notice' ) ) {
				wc_add_notice( esc_html__( 'Payment Gateway Rules for WooCommerce has hidden all payment gateways for this checkout. Review your rules.', 'payment-gateway-rules-for-woocommerce' ), 'notice' );
			}
		}

		$this->log( 'Gateway rules evaluated.', $result );

		/**
		 * Filters payment gateways after Payment Gateway Rules for WooCommerce evaluates them.
		 *
		 * @param array<string,WC_Payment_Gateway> $gateways Result gateways.
		 * @param array<string,mixed>              $context  Checkout context.
		 * @param array<int,array<string,mixed>>   $matched  Matched rules.
		 */
		return apply_filters( 'pgrfw_available_gateways_after_rules', $result['gateways'], $context, $result['matched_rules'] );
	}

	/**
	 * Evaluate rules without mutating checkout state.
	 *
	 * @param array<string,mixed> $gateways Gateways.
	 * @param array<string,mixed> $context Context.
	 * @return array<string,mixed>
	 */
	public function evaluate_rules( array $gateways, array $context ) {
		$matched_rules = array();

		foreach ( $this->get_rules() as $rule ) {
			if ( empty( $rule['enabled'] ) || empty( $rule['gateways'] ) || ! $this->rule_matches( $rule, $context ) ) {
				continue;
			}

			$matched_rules[] = $rule;
			$target_ids      = array_values( array_intersect( array_keys( $gateways ), $rule['gateways'] ) );

			if ( self::ACTION_HIDE === $rule['action'] ) {
				foreach ( $target_ids as $gateway_id ) {
					unset( $gateways[ $gateway_id ] );
				}
			} else {
				$gateways = array_intersect_key( $gateways, array_flip( $target_ids ) );
			}
		}

		return array(
			'gateways'      => $gateways,
			'matched_rules' => $matched_rules,
			'context'       => $context,
		);
	}

	/**
	 * Determine whether a rule matches current context.
	 *
	 * @param array<string,mixed> $rule Rule.
	 * @param array<string,mixed> $context Context.
	 * @return bool
	 */
	public function rule_matches( array $rule, array $context ) {
		$matches = false;

		switch ( $rule['match_type'] ) {
			case 'billing_country':
				$matches = in_array( $context['billing_country'], $rule['countries'], true );
				break;
			case 'shipping_country':
				$matches = in_array( $context['shipping_country'], $rule['countries'], true );
				break;
			case 'currency':
				$matches = in_array( $context['currency'], $rule['currencies'], true );
				break;
			case 'cart_total':
				$total = (float) $context['cart_total'];
				if ( 'less_than' === $rule['cart_condition'] ) {
					$matches = $total < (float) $rule['cart_min'];
				} elseif ( 'between' === $rule['cart_condition'] ) {
					$matches = $total >= (float) $rule['cart_min'] && $total <= (float) $rule['cart_max'];
				} else {
					$matches = $total > (float) $rule['cart_min'];
				}
				break;
		}

		/**
		 * Filters whether a payment gateway rule matches.
		 *
		 * @param bool                $matches Rule match result.
		 * @param array<string,mixed> $rule    Rule data.
		 * @param array<string,mixed> $context Checkout context.
		 */
		return (bool) apply_filters( 'pgrfw_rule_matches', $matches, $rule, $context );
	}

	/**
	 * Return current checkout context.
	 *
	 * @return array<string,mixed>
	 */
	public function get_checkout_context() {
		$billing_country  = '';
		$shipping_country = '';
		$cart_total       = 0.0;

		if ( function_exists( 'WC' ) && WC()->customer ) {
			$billing_country  = $this->sanitize_single_code( WC()->customer->get_billing_country(), 2 );
			$shipping_country = $this->sanitize_single_code( WC()->customer->get_shipping_country(), 2 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Read-only WooCommerce checkout AJAX context; WooCommerce validates checkout requests.
		if ( isset( $_POST['post_data'] ) ) {
			$posted = array();
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Read-only WooCommerce checkout AJAX context; WooCommerce validates checkout requests.
			parse_str( sanitize_text_field( wp_unslash( (string) $_POST['post_data'] ) ), $posted );
			if ( isset( $posted['billing_country'] ) ) {
				$billing_country = $this->sanitize_single_code( $posted['billing_country'], 2 );
			}
			if ( isset( $posted['shipping_country'] ) ) {
				$shipping_country = $this->sanitize_single_code( $posted['shipping_country'], 2 );
			}
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Read-only WooCommerce checkout AJAX context; WooCommerce validates checkout requests.
		if ( isset( $_POST['billing_country'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Read-only WooCommerce checkout AJAX context; WooCommerce validates checkout requests.
			$pgrfw_billing_country = sanitize_text_field( wp_unslash( $_POST['billing_country'] ) );
			$billing_country       = $this->sanitize_single_code( $pgrfw_billing_country, 2 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Read-only WooCommerce checkout AJAX context; WooCommerce validates checkout requests.
		if ( isset( $_POST['shipping_country'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Read-only WooCommerce checkout AJAX context; WooCommerce validates checkout requests.
			$pgrfw_shipping_country = sanitize_text_field( wp_unslash( $_POST['shipping_country'] ) );
			$shipping_country       = $this->sanitize_single_code( $pgrfw_shipping_country, 2 );
		}

		if ( function_exists( 'WC' ) && WC()->cart ) {
			$cart_total = (float) WC()->cart->get_total( 'edit' );
		}

		$context = array(
			'billing_country'  => $billing_country,
			'shipping_country' => $shipping_country,
			'currency'         => function_exists( 'get_woocommerce_currency' ) ? $this->sanitize_single_code( get_woocommerce_currency(), 3 ) : '',
			'cart_total'       => $cart_total,
		);

		/**
		 * Filters the context used to evaluate payment gateway rules.
		 *
		 * @param array<string,mixed> $context Checkout context.
		 */
		return apply_filters( 'pgrfw_rule_context', $context );
	}

	/**
	 * Return installed WooCommerce gateways.
	 *
	 * @return array<string,array<string,mixed>>
	 */
	public function get_gateway_registry() {
		$registry = array();

		if ( ! function_exists( 'WC' ) ) {
			return $registry;
		}

		$payment_gateways = WC()->payment_gateways();
		if ( ! $payment_gateways instanceof WC_Payment_Gateways ) {
			$payment_gateways = WC_Payment_Gateways::instance();
		}

		$gateways = $payment_gateways->payment_gateways();
		$gateways = is_array( $gateways ) ? $gateways : array();

		foreach ( $gateways as $gateway ) {
			if ( ! is_object( $gateway ) || empty( $gateway->id ) ) {
				continue;
			}

			$title = ! empty( $gateway->method_title ) ? $gateway->method_title : $gateway->title;
			$registry[ $gateway->id ] = array(
				'id'      => sanitize_key( $gateway->id ),
				'title'   => wp_strip_all_tags( (string) $title ),
				'enabled' => 'yes' === (string) $gateway->enabled,
			);
		}

		ksort( $registry );

		return $registry;
	}

	/**
	 * Sanitize match type.
	 *
	 * @param mixed $match_type Match type.
	 * @return string
	 */
	public function sanitize_match_type( $match_type ) {
		$match_type = sanitize_key( $match_type );
		$allowed    = array( 'billing_country', 'shipping_country', 'currency', 'cart_total' );

		return in_array( $match_type, $allowed, true ) ? $match_type : 'billing_country';
	}

	/**
	 * Sanitize action.
	 *
	 * @param mixed $action Action.
	 * @return string
	 */
	public function sanitize_action( $action ) {
		$action = sanitize_key( $action );

		return self::ACTION_SHOW === $action ? self::ACTION_SHOW : self::ACTION_HIDE;
	}

	/**
	 * Sanitize cart condition.
	 *
	 * @param mixed $condition Condition.
	 * @return string
	 */
	public function sanitize_cart_condition( $condition ) {
		$condition = sanitize_key( $condition );
		$allowed   = array( 'greater_than', 'less_than', 'between' );

		return in_array( $condition, $allowed, true ) ? $condition : 'greater_than';
	}

	/**
	 * Sanitize gateway IDs.
	 *
	 * @param mixed $values Values.
	 * @return array<int,string>
	 */
	public function sanitize_gateway_ids( $values ) {
		if ( is_string( $values ) ) {
			$values = preg_split( '/[\r\n,]+/', $values );
		}

		$values = is_array( $values ) ? $values : array();

		return array_values( array_unique( array_filter( array_map( 'sanitize_key', $values ) ) ) );
	}

	/**
	 * Sanitize code list.
	 *
	 * @param mixed $values Values.
	 * @param int   $length Expected length.
	 * @return array<int,string>
	 */
	public function sanitize_code_list( $values, $length ) {
		if ( is_string( $values ) ) {
			$values = preg_split( '/[\r\n,]+/', $values );
		}

		$values = is_array( $values ) ? $values : array();
		$output = array();

		foreach ( $values as $value ) {
			$code = $this->sanitize_single_code( $value, $length );
			if ( '' !== $code ) {
				$output[] = $code;
			}
		}

		return array_values( array_unique( $output ) );
	}

	/**
	 * Sanitize a country or currency code.
	 *
	 * @param mixed $value Value.
	 * @param int   $length Expected length.
	 * @return string
	 */
	private function sanitize_single_code( $value, $length ) {
		$code = strtoupper( preg_replace( '/[^A-Za-z]/', '', (string) $value ) );

		return strlen( $code ) === (int) $length ? $code : '';
	}

	/**
	 * Determine if current request should bypass filtering.
	 *
	 * @return bool
	 */
	private function should_bypass_filtering() {
		if ( wp_doing_cron() ) {
			return true;
		}

		if ( is_admin() && ! wp_doing_ajax() ) {
			return true;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only WooCommerce request routing flag.
		if ( isset( $_REQUEST['wc-ajax'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only WooCommerce request routing flag.
			$wc_ajax = sanitize_key( wp_unslash( (string) $_REQUEST['wc-ajax'] ) );
			if ( in_array( $wc_ajax, array( 'update_order_review', 'checkout' ), true ) ) {
				return false;
			}
		}

		return function_exists( 'is_checkout' ) ? ! is_checkout() : false;
	}

	/**
	 * Log debug context when enabled.
	 *
	 * @param string              $message Message.
	 * @param array<string,mixed> $context Context.
	 * @return void
	 */
	private function log( $message, array $context ) {
		$settings = $this->get_settings();

		if ( empty( $settings['debug_mode'] ) || ! function_exists( 'wc_get_logger' ) ) {
			return;
		}

		wc_get_logger()->debug(
			$message,
			array(
				'source'  => 'payment-gateway-rules-for-woocommerce',
				'context' => $context,
			)
		);
	}
}
