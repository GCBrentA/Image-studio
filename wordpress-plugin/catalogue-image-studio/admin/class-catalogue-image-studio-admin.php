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
		add_action('admin_init', [$this, 'handle_workflow_post']);
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

		$settings                  = $this->plugin->get_settings();
		$settings['enabled']       = isset($_POST['enabled']);
		$settings['api_base_url']  = isset($_POST['api_base_url']) ? esc_url_raw(wp_unslash($_POST['api_base_url'])) : '';
		$settings['api_token']     = isset($_POST['api_token']) ? sanitize_text_field(wp_unslash($_POST['api_token'])) : '';
		$settings['background']    = isset($_POST['background']) ? sanitize_hex_color(wp_unslash($_POST['background'])) : '#ffffff';
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
				$this->add_error($usage->get_error_message());
			} else {
				$this->add_success(__('Connection successful.', 'catalogue-image-studio'));
			}
		} else {
			$this->add_success(__('Settings saved.', 'catalogue-image-studio'));
		}
	}

	/**
	 * Handle scan, process, approve, reject, and revert actions.
	 *
	 * @return void
	 */
	public function handle_workflow_post(): void {
		if (
			! isset($_POST['catalogue_image_studio_action_nonce'], $_POST['catalogue_image_studio_action']) ||
			! current_user_can('manage_woocommerce')
		) {
			return;
		}

		check_admin_referer('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce');

		$action  = sanitize_key((string) wp_unslash($_POST['catalogue_image_studio_action']));
		$job_ids = isset($_POST['job_ids']) ? array_map('absint', (array) wp_unslash($_POST['job_ids'])) : [];
		$job_ids = array_values(array_filter($job_ids));

		if ('scan' === $action) {
			$result = $this->plugin->scanner()->scan();
			$this->add_success(
				sprintf(
					/* translators: 1: slots found, 2: jobs created/refreshed */
					__('Scan complete. Found %1$d images and refreshed %2$d jobs.', 'catalogue-image-studio'),
					(int) $result['slots_found'],
					count((array) $result['job_ids'])
				)
			);
			return;
		}

		if (empty($job_ids)) {
			$this->add_error(__('Select at least one image.', 'catalogue-image-studio'));
			return;
		}

		$success = 0;
		$failed  = 0;

		foreach ($job_ids as $job_id) {
			$result = $this->run_job_action($action, $job_id);

			if (is_wp_error($result)) {
				$failed++;
				$this->add_error($result->get_error_message());
			} else {
				$success++;
			}
		}

		if ($success > 0) {
			$this->add_success(
				sprintf(
					/* translators: 1: action, 2: count */
					__('%1$s complete for %2$d image(s).', 'catalogue-image-studio'),
					ucfirst(str_replace('_', ' ', $action)),
					$success
				)
			);
		}

		if ($failed > 0) {
			$this->add_error(
				sprintf(
					/* translators: %d: count */
					__('%d image action(s) failed.', 'catalogue-image-studio'),
					$failed
				)
			);
		}
	}

	/**
	 * @return array<string,mixed>|\WP_Error|true
	 */
	private function run_job_action(string $action, int $job_id) {
		switch ($action) {
			case 'process':
				$settings = $this->plugin->get_settings();
				return $this->plugin->processor()->process(
					$job_id,
					[
						'background'    => (string) $settings['background'],
						'scale_percent' => (int) $settings['scale_percent'],
					]
				);
			case 'approve':
				return $this->plugin->approval()->approve($job_id);
			case 'reject':
				return $this->plugin->approval()->reject($job_id);
			case 'revert':
				return $this->plugin->approval()->revert($job_id);
			default:
				return new WP_Error('catalogue_image_studio_unknown_action', __('Unknown action.', 'catalogue-image-studio'));
		}
	}

	private function add_success(string $message): void {
		add_settings_error('catalogue_image_studio_messages', uniqid('catalogue_image_studio_', true), $message, 'success');
	}

	private function add_error(string $message): void {
		add_settings_error('catalogue_image_studio_messages', uniqid('catalogue_image_studio_', true), $message, 'error');
	}

	/**
	 * Render admin page.
	 *
	 * @return void
	 */
	public function render_page(): void {
		if (! current_user_can('manage_woocommerce')) {
			wp_die(esc_html__('You do not have permission to access this page.', 'catalogue-image-studio'));
		}

		$settings = $this->plugin->get_settings();
		$usage    = $this->get_usage();
		$jobs     = $this->plugin->jobs()->query([], 100, 0);
		?>
		<div class="wrap catalogue-image-studio-admin">
			<h1><?php echo esc_html__('Catalogue Image Studio', 'catalogue-image-studio'); ?></h1>
			<?php settings_errors('catalogue_image_studio_messages'); ?>

			<div class="catalogue-image-studio-grid">
				<?php $this->render_settings_panel($settings, $usage); ?>
				<?php $this->render_workflow_panel($jobs); ?>
			</div>
		</div>
		<?php
	}

	/**
	 * @return array<string,mixed>|\WP_Error
	 */
	private function get_usage() {
		$settings = $this->plugin->get_settings();

		if (empty($settings['api_base_url']) || empty($settings['api_token'])) {
			return new WP_Error('catalogue_image_studio_not_connected', __('Not connected.', 'catalogue-image-studio'));
		}

		return $this->plugin->client()->get_usage();
	}

	/**
	 * @param array<string,mixed>           $settings Settings.
	 * @param array<string,mixed>|\WP_Error $usage Usage.
	 * @return void
	 */
	private function render_settings_panel(array $settings, $usage): void {
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Connection', 'catalogue-image-studio'); ?></h2>
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
							<th scope="row"><label for="catalogue-image-studio-api-base-url"><?php echo esc_html__('API Base URL', 'catalogue-image-studio'); ?></label></th>
							<td><input type="url" id="catalogue-image-studio-api-base-url" name="api_base_url" class="regular-text" value="<?php echo esc_attr((string) $settings['api_base_url']); ?>" placeholder="https://your-render-service.onrender.com" /></td>
						</tr>
						<tr>
							<th scope="row"><label for="catalogue-image-studio-api-token"><?php echo esc_html__('Site API Token', 'catalogue-image-studio'); ?></label></th>
							<td><input type="password" id="catalogue-image-studio-api-token" name="api_token" class="regular-text" value="<?php echo esc_attr((string) $settings['api_token']); ?>" autocomplete="off" /></td>
						</tr>
						<tr>
							<th scope="row"><label for="catalogue-image-studio-background"><?php echo esc_html__('Background', 'catalogue-image-studio'); ?></label></th>
							<td><input type="text" id="catalogue-image-studio-background" name="background" value="<?php echo esc_attr((string) $settings['background']); ?>" class="small-text" /></td>
						</tr>
						<tr>
							<th scope="row"><label for="catalogue-image-studio-scale-percent"><?php echo esc_html__('Scale', 'catalogue-image-studio'); ?></label></th>
							<td><input type="number" id="catalogue-image-studio-scale-percent" name="scale_percent" min="1" max="100" value="<?php echo esc_attr((string) $settings['scale_percent']); ?>" class="small-text" /> %</td>
						</tr>
					</tbody>
				</table>
				<p class="submit">
					<button type="submit" class="button button-primary"><?php echo esc_html__('Save Settings', 'catalogue-image-studio'); ?></button>
					<button type="submit" name="test_connection" value="1" class="button"><?php echo esc_html__('Test Connection', 'catalogue-image-studio'); ?></button>
				</p>
			</form>
			<?php $this->render_usage($usage); ?>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed>|\WP_Error $usage Usage.
	 * @return void
	 */
	private function render_usage($usage): void {
		if (is_wp_error($usage)) {
			?>
			<div class="catalogue-image-studio-usage catalogue-image-studio-muted">
				<?php echo esc_html($usage->get_error_message()); ?>
			</div>
			<?php
			return;
		}

		?>
		<div class="catalogue-image-studio-usage">
			<div>
				<span><?php echo esc_html__('Plan', 'catalogue-image-studio'); ?></span>
				<strong><?php echo esc_html(ucfirst((string) ($usage['plan'] ?? 'unknown'))); ?></strong>
			</div>
			<div>
				<span><?php echo esc_html__('Credits', 'catalogue-image-studio'); ?></span>
				<strong><?php echo esc_html((string) ($usage['credits_remaining'] ?? 0)); ?> / <?php echo esc_html((string) ($usage['credits_total'] ?? 0)); ?></strong>
			</div>
			<div>
				<span><?php echo esc_html__('Status', 'catalogue-image-studio'); ?></span>
				<strong><?php echo esc_html(ucfirst((string) ($usage['subscription_status'] ?? 'unknown'))); ?></strong>
			</div>
		</div>
		<?php
	}

	/**
	 * @param array<int,array<string,mixed>> $jobs Jobs.
	 * @return void
	 */
	private function render_workflow_panel(array $jobs): void {
		?>
		<div class="catalogue-image-studio-panel catalogue-image-studio-panel-wide">
			<div class="catalogue-image-studio-toolbar">
				<h2><?php echo esc_html__('Images', 'catalogue-image-studio'); ?></h2>
				<form method="post" action="">
					<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
					<input type="hidden" name="catalogue_image_studio_action" value="scan" />
					<button type="submit" class="button"><?php echo esc_html__('Scan Product Images', 'catalogue-image-studio'); ?></button>
				</form>
			</div>

			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<div class="tablenav top">
					<div class="alignleft actions">
						<select name="catalogue_image_studio_action">
							<option value="process"><?php echo esc_html__('Process selected', 'catalogue-image-studio'); ?></option>
							<option value="approve"><?php echo esc_html__('Approve selected', 'catalogue-image-studio'); ?></option>
							<option value="reject"><?php echo esc_html__('Reject selected', 'catalogue-image-studio'); ?></option>
							<option value="revert"><?php echo esc_html__('Revert selected', 'catalogue-image-studio'); ?></option>
						</select>
						<button type="submit" class="button button-primary"><?php echo esc_html__('Apply', 'catalogue-image-studio'); ?></button>
					</div>
				</div>

				<table class="widefat fixed striped catalogue-image-studio-jobs">
					<thead>
						<tr>
							<td class="check-column"><input type="checkbox" onclick="document.querySelectorAll('.catalogue-image-studio-job-check').forEach((box) => box.checked = this.checked);" /></td>
							<th><?php echo esc_html__('Product', 'catalogue-image-studio'); ?></th>
							<th><?php echo esc_html__('Before', 'catalogue-image-studio'); ?></th>
							<th><?php echo esc_html__('After', 'catalogue-image-studio'); ?></th>
							<th><?php echo esc_html__('Slot', 'catalogue-image-studio'); ?></th>
							<th><?php echo esc_html__('Status', 'catalogue-image-studio'); ?></th>
							<th><?php echo esc_html__('Updated', 'catalogue-image-studio'); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php if (empty($jobs)) : ?>
							<tr><td colspan="7"><?php echo esc_html__('No image jobs yet. Run a scan to find WooCommerce product images.', 'catalogue-image-studio'); ?></td></tr>
						<?php else : ?>
							<?php foreach ($jobs as $job) : ?>
								<?php $this->render_job_row($job); ?>
							<?php endforeach; ?>
						<?php endif; ?>
					</tbody>
				</table>
			</form>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return void
	 */
	private function render_job_row(array $job): void {
		$product_id       = (int) ($job['product_id'] ?? 0);
		$attachment_id    = (int) ($job['attachment_id'] ?? 0);
		$processed_id     = (int) ($job['processed_attachment_id'] ?? 0);
		$before_url       = $attachment_id ? wp_get_attachment_image_url($attachment_id, 'thumbnail') : '';
		$processed_source = $processed_id ? wp_get_attachment_image_url($processed_id, 'thumbnail') : (string) ($job['processed_url'] ?? '');
		$product_title    = $product_id ? get_the_title($product_id) : __('Unknown product', 'catalogue-image-studio');
		?>
		<tr>
			<th scope="row" class="check-column">
				<input type="checkbox" class="catalogue-image-studio-job-check" name="job_ids[]" value="<?php echo esc_attr((string) (int) $job['id']); ?>" />
			</th>
			<td>
				<strong><?php echo esc_html($product_title); ?></strong><br />
				<a href="<?php echo esc_url(get_edit_post_link($product_id)); ?>"><?php echo esc_html__('Edit product', 'catalogue-image-studio'); ?></a>
			</td>
			<td><?php $this->render_thumbnail($before_url, __('Before', 'catalogue-image-studio')); ?></td>
			<td><?php $this->render_thumbnail($processed_source, __('After', 'catalogue-image-studio')); ?></td>
			<td><?php echo esc_html((string) $job['image_role']); ?> <?php echo 'gallery' === (string) $job['image_role'] ? esc_html('#' . ((int) $job['gallery_index'] + 1)) : ''; ?></td>
			<td><span class="catalogue-image-studio-status catalogue-image-studio-status-<?php echo esc_attr(sanitize_key((string) $job['status'])); ?>"><?php echo esc_html((string) $job['status']); ?></span><?php echo ! empty($job['error_message']) ? '<br /><small>' . esc_html((string) $job['error_message']) . '</small>' : ''; ?></td>
			<td><?php echo esc_html((string) ($job['updated_at'] ?? '')); ?></td>
		</tr>
		<?php
	}

	private function render_thumbnail(string $url, string $label): void {
		if ('' === $url) {
			echo '<span class="catalogue-image-studio-muted">' . esc_html__('None', 'catalogue-image-studio') . '</span>';
			return;
		}

		?>
		<a href="<?php echo esc_url($url); ?>" target="_blank" rel="noopener noreferrer">
			<img src="<?php echo esc_url($url); ?>" alt="<?php echo esc_attr($label); ?>" class="catalogue-image-studio-thumb" />
		</a>
		<?php
	}
}
