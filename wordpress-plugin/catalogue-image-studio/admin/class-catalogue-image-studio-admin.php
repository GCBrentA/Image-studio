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

			<div class="catalogue-image-studio-panel">
				<h2><?php echo esc_html__('Settings', 'catalogue-image-studio'); ?></h2>
				<p><?php echo esc_html__('Catalogue Image Studio is installed and ready for configuration.', 'catalogue-image-studio'); ?></p>
				<p>
					<strong><?php echo esc_html__('Status:', 'catalogue-image-studio'); ?></strong>
					<?php echo ! empty($settings['enabled']) ? esc_html__('Enabled', 'catalogue-image-studio') : esc_html__('Disabled', 'catalogue-image-studio'); ?>
				</p>
				<p class="description">
					<?php echo esc_html__('Image processing controls will be added here in a future version.', 'catalogue-image-studio'); ?>
				</p>
			</div>
		</div>
		<?php
	}
}
