<?php
/**
 * Admin menu and page rendering.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_Admin {
	/**
	 * Core plugin instance.
	 *
	 * @var Catalogue_Image_Studio_Plugin
	 */
	private $plugin;

	/**
	 * Admin page hook suffix.
	 *
	 * @var string
	 */
	private $page_hook = '';

	/**
	 * Constructor.
	 *
	 * @param Catalogue_Image_Studio_Plugin $plugin Plugin instance.
	 */
	public function __construct(Catalogue_Image_Studio_Plugin $plugin) {
		$this->plugin = $plugin;

		add_action('admin_menu', [$this, 'register_menu']);
		add_action('admin_init', [$this, 'handle_settings_post']);
		add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
	}

	/**
	 * Register the WooCommerce submenu.
	 *
	 * @return void
	 */
	public function register_menu(): void {
		if (! current_user_can('manage_woocommerce')) {
			return;
		}

		$this->page_hook = add_submenu_page(
			'woocommerce',
			__('Catalogue Image Studio', 'catalogue-image-studio'),
			__('Catalogue Image Studio', 'catalogue-image-studio'),
			'manage_woocommerce',
			'catalogue-image-studio',
			[$this, 'render_page']
		);
	}

	/**
	 * Enqueue admin assets only on the plugin page.
	 *
	 * @param string $hook Current admin page hook.
	 * @return void
	 */
	public function enqueue_assets(string $hook): void {
		if ($hook !== $this->page_hook) {
			return;
		}

		wp_enqueue_style(
			'catalogue-image-studio-admin',
			CIS_URL . 'assets/admin.css',
			[],
			CIS_VERSION
		);
	}

	/**
	 * Save settings and optionally test the SaaS connection.
	 *
	 * @return void
	 */
	public function handle_settings_post(): void {
		if (
			! isset($_POST['catalogue_image_studio_settings_nonce']) ||
			! current_user_can('manage_woocommerce')
		) {
			return;
		}

		check_admin_referer('catalogue_image_studio_save_settings', 'catalogue_image_studio_settings_nonce');

		$settings = $this->plugin->get_settings();
		$settings['enabled'] = isset($_POST['enabled']);
		$settings['api_base_url'] = isset($_POST['api_base_url']) ? esc_url_raw(wp_unslash($_POST['api_base_url'])) : '';
		$settings['api_token'] = isset($_POST['api_token']) ? sanitize_text_field(wp_unslash($_POST['api_token'])) : '';
		$settings['background'] = isset($_POST['background']) ? sanitize_hex_color(wp_unslash($_POST['background'])) : '#ffffff';
		$settings['scale_percent'] = isset($_POST['scale_percent']) ? max(1, min(100, absint($_POST['scale_percent']))) : 82;

		if (empty($settings['background'])) {
			$settings['background'] = '#ffffff';
		}

		update_option($this->plugin->get_option_name(), $settings, false);

		if (isset($_POST['test_connection'])) {
			$client = new Catalogue_Image_Studio_SaaSClient(
				(string) $settings['api_base_url'],
				(string) $settings['api_token'],
				$this->plugin->logger()
			);
			$usage = $client->get_usage();

			if (is_wp_error($usage)) {
				add_settings_error(
					'catalogue_image_studio_messages',
					'catalogue_image_studio_connection_failed',
					$usage->get_error_message(),
					'error'
				);
			} else {
				add_settings_error(
					'catalogue_image_studio_messages',
					'catalogue_image_studio_connection_ok',
					__('Connection successful.', 'catalogue-image-studio'),
					'success'
				);
			}
		} else {
			add_settings_error(
				'catalogue_image_studio_messages',
				'catalogue_image_studio_settings_saved',
				__('Settings saved.', 'catalogue-image-studio'),
				'success'
			);
		}
	}

	/**
	 * Render settings placeholder page.
	 *
	 * @return void
	 */
	public function render_page(): void {
		if (! current_user_can('manage_woocommerce')) {
			wp_die(esc_html__('You do not have permission to access this page.', 'catalogue-image-studio'));
		}

		$settings = $this->plugin->get_settings();
		?>
		<div class="wrap catalogue-image-studio-admin">
			<h1><?php echo esc_html__('Catalogue Image Studio', 'catalogue-image-studio'); ?></h1>
			<?php settings_errors('catalogue_image_studio_messages'); ?>

			<div class="catalogue-image-studio-panel">
				<h2><?php echo esc_html__('Settings', 'catalogue-image-studio'); ?></h2>
				<form method="post" action="">
					<?php wp_nonce_field('catalogue_image_studio_save_settings', 'catalogue_image_studio_settings_nonce'); ?>
					<table class="form-table" role="presentation">
						<tbody>
							<tr>
								<th scope="row"><?php echo esc_html__('Enabled', 'catalogue-image-studio'); ?></th>
								<td>
									<label>
										<input type="checkbox" name="enabled" value="1" <?php checked(! empty($settings['enabled'])); ?> />
										<?php echo esc_html__('Enable image processing workflows', 'catalogue-image-studio'); ?>
									</label>
								</td>
							</tr>
							<tr>
								<th scope="row">
									<label for="catalogue-image-studio-api-base-url"><?php echo esc_html__('API Base URL', 'catalogue-image-studio'); ?></label>
								</th>
								<td>
									<input
										type="url"
										id="catalogue-image-studio-api-base-url"
										name="api_base_url"
										class="regular-text"
										value="<?php echo esc_attr((string) $settings['api_base_url']); ?>"
										placeholder="https://your-render-service.onrender.com"
									/>
								</td>
							</tr>
							<tr>
								<th scope="row">
									<label for="catalogue-image-studio-api-token"><?php echo esc_html__('Site API Token', 'catalogue-image-studio'); ?></label>
								</th>
								<td>
									<input
										type="password"
										id="catalogue-image-studio-api-token"
										name="api_token"
										class="regular-text"
										value="<?php echo esc_attr((string) $settings['api_token']); ?>"
										autocomplete="off"
									/>
								</td>
							</tr>
							<tr>
								<th scope="row">
									<label for="catalogue-image-studio-background"><?php echo esc_html__('Background', 'catalogue-image-studio'); ?></label>
								</th>
								<td>
									<input
										type="text"
										id="catalogue-image-studio-background"
										name="background"
										value="<?php echo esc_attr((string) $settings['background']); ?>"
										class="small-text"
									/>
								</td>
							</tr>
							<tr>
								<th scope="row">
									<label for="catalogue-image-studio-scale-percent"><?php echo esc_html__('Scale', 'catalogue-image-studio'); ?></label>
								</th>
								<td>
									<input
										type="number"
										id="catalogue-image-studio-scale-percent"
										name="scale_percent"
										min="1"
										max="100"
										value="<?php echo esc_attr((string) $settings['scale_percent']); ?>"
										class="small-text"
									/> %
								</td>
							</tr>
						</tbody>
					</table>
					<p class="submit">
						<button type="submit" class="button button-primary"><?php echo esc_html__('Save Settings', 'catalogue-image-studio'); ?></button>
						<button type="submit" name="test_connection" value="1" class="button"><?php echo esc_html__('Test Connection', 'catalogue-image-studio'); ?></button>
					</p>
				</form>
			</div>
		</div>
		<?php
	}
}
