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
		add_action('admin_init', ['Catalogue_Image_Studio_Plugin', 'create_tables']);
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
		wp_enqueue_script('jquery');

		wp_add_inline_script(
			'jquery',
			"function catalogueImageStudioUpdateSelectedCount() {
				var selected = document.querySelectorAll('.catalogue-image-studio-job-check:checked').length;
				document.querySelectorAll('[data-cis-selected-count]').forEach(function(node) {
					node.textContent = String(selected);
				});
			}
			document.addEventListener('change', function(event) {
				if (!event.target.matches('.catalogue-image-studio-job-check, .catalogue-image-studio-check-all')) {
					return;
				}
				catalogueImageStudioUpdateSelectedCount();
			});
			document.addEventListener('DOMContentLoaded', catalogueImageStudioUpdateSelectedCount);"
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

		$settings            = $this->plugin->get_settings();
		$defaults            = $this->plugin->get_default_settings();
		$settings['enabled'] = true;

		if (isset($_POST['disconnect_store'])) {
			$settings['api_token'] = '';
			update_option($this->plugin->get_option_name(), $settings, false);
			$this->add_success(__('Store disconnected.', 'catalogue-image-studio'));
			return;
		}

		$posted_token = isset($_POST['api_token']) ? trim(sanitize_text_field(wp_unslash($_POST['api_token']))) : '';
		if ('' !== $posted_token) {
			$settings['api_token'] = $posted_token;
		}

		$settings['api_base_url'] = isset($_POST['api_base_url']) ? esc_url_raw(wp_unslash($_POST['api_base_url'])) : (string) $defaults['api_base_url'];
		if (empty($settings['api_base_url'])) {
			$settings['api_base_url'] = (string) $defaults['api_base_url'];
		}

		$is_full_settings = isset($_POST['catalogue_image_studio_full_settings']);

		$settings['background'] = isset($_POST['background']) ? sanitize_text_field(wp_unslash($_POST['background'])) : (string) ($settings['background'] ?? $defaults['background']);
		if ('' === $settings['background']) {
			$settings['background'] = (string) $defaults['background'];
		}

		$scale = isset($_POST['scale_percent']) ? sanitize_text_field(wp_unslash($_POST['scale_percent'])) : (string) ($settings['scale_percent'] ?? $defaults['scale_percent']);
		$settings['scale_percent'] = 'auto' === $scale ? 'auto' : max(1, min(100, absint($scale)));

		if ($is_full_settings) {
			$settings['smart_scaling_enabled']   = isset($_POST['smart_scaling_enabled']);
			$settings['shadow_enabled']          = isset($_POST['shadow_enabled']);
			$settings['approval_required']       = isset($_POST['approval_required']);
			$settings['auto_process_new_images'] = isset($_POST['auto_process_new_images']);
			$settings['process_featured_images'] = isset($_POST['process_featured_images']);
			$settings['process_gallery_images']  = isset($_POST['process_gallery_images']);
			$settings['duplicate_detection']     = isset($_POST['duplicate_detection']);
			$settings['shadow_strength']         = isset($_POST['shadow_strength']) ? sanitize_key(wp_unslash($_POST['shadow_strength'])) : 'medium';
			$settings['enable_filename_seo']     = isset($_POST['enable_filename_seo']);
			$settings['enable_alt_text']         = isset($_POST['enable_alt_text']);
			$settings['only_fill_missing']       = isset($_POST['only_fill_missing']);
			$settings['overwrite_existing_meta'] = isset($_POST['overwrite_existing_meta']);
			$settings['seo_brand_suffix']        = isset($_POST['seo_brand_suffix']) ? sanitize_text_field(wp_unslash($_POST['seo_brand_suffix'])) : '';
		}
		$settings['debug_mode']              = isset($_POST['debug_mode']);

		if (isset($_POST['category_preset_category'])) {
			$category_id = absint($_POST['category_preset_category']);
			if ($category_id > 0) {
				$presets                 = isset($settings['category_presets']) && is_array($settings['category_presets']) ? $settings['category_presets'] : [];
				$presets[$category_id]   = [
					'enabled'         => isset($_POST['category_preset_enabled']),
					'scale_mode'      => isset($_POST['category_scale_mode']) ? sanitize_key(wp_unslash($_POST['category_scale_mode'])) : 'auto',
					'background'      => isset($_POST['category_background']) ? sanitize_text_field(wp_unslash($_POST['category_background'])) : 'optivra-default',
					'shadow_strength' => isset($_POST['category_shadow_strength']) ? sanitize_key(wp_unslash($_POST['category_shadow_strength'])) : 'medium',
				];
				$settings['category_presets'] = $presets;
			}
		}

		update_option($this->plugin->get_option_name(), $settings, false);

		if (isset($_POST['clear_local_cache'])) {
			$this->plugin->jobs()->delete_all();
			$this->add_success(__('Local image job cache cleared.', 'catalogue-image-studio'));
			return;
		}

		if (isset($_POST['reset_local_data'])) {
			$this->plugin->jobs()->delete_all();
			$this->add_success(__('Plugin local data reset.', 'catalogue-image-studio'));
			return;
		}

		if (isset($_POST['test_connection']) || isset($_POST['connect_store'])) {
			$client = new Catalogue_Image_Studio_SaaSClient(
				(string) $settings['api_base_url'],
				(string) $settings['api_token'],
				$this->plugin->logger()
			);
			$usage = $client->get_usage();

			if (is_wp_error($usage)) {
				$this->add_error($usage->get_error_message());
			} else {
				$this->add_success(__('Store connected to Optivra.', 'catalogue-image-studio'));
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
		$usage   = $this->get_usage();

		if (is_wp_error($usage)) {
			$this->add_error(__('Connect your Optivra account before scanning or processing images.', 'catalogue-image-studio'));
			return;
		}

		if ('scan' === $action) {
			$result = $this->plugin->scanner()->scan($this->get_scan_filters_from_request());
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

		if ('queue_visible' === $action || 'queue_category' === $action) {
			$result = $this->plugin->scanner()->scan($this->get_scan_filters_from_request());
			$this->plugin->jobs()->update_statuses((array) $result['job_ids'], 'queued');
			$this->add_success(sprintf(
				/* translators: %d: jobs queued */
				__('%d image(s) queued.', 'catalogue-image-studio'),
				count((array) $result['job_ids'])
			));
			return;
		}

		if ('queue_selected_slots' === $action) {
			$job_ids = $this->queue_selected_slots();
			$this->plugin->jobs()->update_statuses($job_ids, 'queued');
			$this->add_success(sprintf(
				/* translators: %d: jobs queued */
				__('%d selected image(s) queued.', 'catalogue-image-studio'),
				count($job_ids)
			));
			return;
		}

		if ('process_next_batch' === $action) {
			$queued  = $this->plugin->jobs()->query(['status' => 'queued'], 10, 0);
			$job_ids = array_map('absint', wp_list_pluck($queued, 'id'));
			$action  = 'process';
		}

		if (empty($job_ids)) {
			$this->add_error(__('Select at least one image.', 'catalogue-image-studio'));
			return;
		}

		if ('process' === $action) {
			$credits_remaining = max(0, (int) ($usage['credits_remaining'] ?? 0));

			if ($credits_remaining < count($job_ids)) {
				$job_ids = array_slice($job_ids, 0, $credits_remaining);

				$this->add_error(__('Insufficient credits. Processing available images only; buy credits or upgrade plan to process the rest.', 'catalogue-image-studio'));
			}

			if (empty($job_ids)) {
				$this->add_error(__('No credits available. Buy credits or upgrade plan to continue.', 'catalogue-image-studio'));
				return;
			}
		}

		if ('cancel' === $action) {
			$updated = $this->plugin->jobs()->update_statuses($job_ids, 'unprocessed');
			$this->add_success(sprintf(
				/* translators: %d: jobs cancelled */
				__('%d image(s) removed from queue.', 'catalogue-image-studio'),
				$updated
			));
			return;
		}

		if ('retry' === $action) {
			$this->plugin->jobs()->update_statuses($job_ids, 'queued');
			$action = 'process';
		}

		$success = 0;
		$failed  = 0;

		$this->save_posted_seo_metadata();

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

	private function save_posted_seo_metadata(): void {
		if (empty($_POST['seo']) || ! is_array($_POST['seo'])) {
			return;
		}

		$seo_rows = wp_unslash($_POST['seo']);

		foreach ((array) $seo_rows as $job_id => $seo) {
			if (! is_array($seo)) {
				continue;
			}

			$this->plugin->jobs()->update(
				absint($job_id),
				[
					'seo_filename'    => isset($seo['filename']) ? sanitize_file_name((string) $seo['filename']) : '',
					'seo_alt_text'    => isset($seo['alt_text']) ? sanitize_text_field((string) $seo['alt_text']) : '',
					'seo_title'       => isset($seo['title']) ? sanitize_text_field((string) $seo['title']) : '',
					'seo_caption'     => isset($seo['caption']) ? sanitize_text_field((string) $seo['caption']) : '',
					'seo_description' => isset($seo['description']) ? wp_kses_post((string) $seo['description']) : '',
				]
			);
		}
	}

	/**
	 * @return array<string,mixed>
	 */
	private function get_scan_filters_from_request(): array {
		$settings = $this->plugin->get_settings();
		$include_featured_default = ! empty($settings['process_featured_images']);
		$include_gallery_default  = ! empty($settings['process_gallery_images']);
		$filters = [
			'category'         => isset($_POST['filter_category']) ? absint($_POST['filter_category']) : 0,
			'product_type'     => isset($_POST['filter_product_type']) ? sanitize_key(wp_unslash($_POST['filter_product_type'])) : '',
			'stock_status'     => isset($_POST['filter_stock_status']) ? sanitize_key(wp_unslash($_POST['filter_stock_status'])) : '',
			'include_featured' => isset($_POST['filter_image_gallery_only']) ? false : $include_featured_default,
			'include_gallery'  => isset($_POST['filter_image_featured_only']) ? false : $include_gallery_default,
		];

		if (! empty($_POST['filter_product_status'])) {
			$filters['status'] = [sanitize_key(wp_unslash($_POST['filter_product_status']))];
		}

		return array_filter(
			$filters,
			static function ($value) {
				return '' !== $value && 0 !== $value && null !== $value;
			}
		);
	}

	/**
	 * @return array<int,int>
	 */
	private function queue_selected_slots(): array {
		$slots   = isset($_POST['slots']) ? (array) wp_unslash($_POST['slots']) : [];
		$job_ids = [];

		foreach ($slots as $slot_value) {
			$parts = explode(':', sanitize_text_field((string) $slot_value));

			if (4 !== count($parts)) {
				continue;
			}

			$job_ids[] = $this->plugin->jobs()->upsert_from_slot(
				[
					'product_id'    => absint($parts[0]),
					'attachment_id' => absint($parts[1]),
					'image_role'    => sanitize_key($parts[2]),
					'gallery_index' => absint($parts[3]),
				]
			);
		}

		return array_values(array_filter(array_map('absint', $job_ids)));
	}

	/**
	 * @return array<string,mixed>|\WP_Error|true
	 */
	private function run_job_action(string $action, int $job_id) {
		switch ($action) {
			case 'process':
				$settings = $this->plugin->get_settings();
				$options  = [
					'background' => (string) $settings['background'],
				];

				if ('auto' !== (string) $settings['scale_percent']) {
					$options['scale_percent'] = (int) $settings['scale_percent'];
				}

				return $this->plugin->processor()->process(
					$job_id,
					$options
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
		$connected = ! is_wp_error($usage);
		$tab       = $this->get_current_tab();
		?>
		<div class="wrap catalogue-image-studio-admin">
			<h1><?php echo esc_html__('Catalogue Image Studio', 'catalogue-image-studio'); ?></h1>
			<?php settings_errors('catalogue_image_studio_messages'); ?>

			<?php if (! $connected) : ?>
				<?php $this->render_settings_panel($settings, $usage); ?>
			<?php else : ?>
				<?php $this->render_tabs($tab); ?>
				<?php
				switch ($tab) {
					case 'scan':
						$this->render_scan_tab();
						break;
					case 'queue':
						$this->render_queue_tab($usage);
						break;
					case 'review':
						$this->render_review_tab();
						break;
					case 'settings':
						$this->render_settings_tab($settings, $usage);
						break;
					case 'logs':
						$this->render_logs_tab();
						break;
					case 'dashboard':
					default:
						$this->render_dashboard_tab($settings, $usage, $jobs);
						break;
				}
				?>
			<?php endif; ?>
		</div>
		<?php
	}

	private function get_current_tab(): string {
		$tab = isset($_GET['cis_tab']) ? sanitize_key(wp_unslash($_GET['cis_tab'])) : 'dashboard';

		return in_array($tab, ['dashboard', 'scan', 'queue', 'review', 'settings', 'logs'], true) ? $tab : 'dashboard';
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 * @param array<string,mixed> $usage Usage.
	 * @param array<int,array<string,mixed>> $jobs Jobs.
	 */
	private function render_dashboard_tab(array $settings, array $usage, array $jobs): void {
		$counts             = $this->plugin->jobs()->counts_by_status();
		$awaiting_approval  = (int) ($counts['completed'] ?? 0);
		$images_scanned     = count($jobs);
		?>
		<div class="catalogue-image-studio-panel">
			<div class="catalogue-image-studio-dashboard-head">
				<div>
					<h2><?php echo esc_html__('Dashboard', 'catalogue-image-studio'); ?></h2>
					<?php $this->render_usage($usage); ?>
				</div>
				<div class="catalogue-image-studio-cta-buttons">
					<a class="button button-primary" href="<?php echo esc_url(add_query_arg(['page' => 'catalogue-image-studio', 'cis_tab' => 'scan'], admin_url('admin.php'))); ?>"><?php echo esc_html__('Scan Catalogue', 'catalogue-image-studio'); ?></a>
					<a class="button" href="<?php echo esc_url(add_query_arg(['page' => 'catalogue-image-studio', 'cis_tab' => 'review'], admin_url('admin.php'))); ?>"><?php echo esc_html__('Review Images', 'catalogue-image-studio'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_buy_credits_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Buy Credits', 'catalogue-image-studio'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_account_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Manage Account', 'catalogue-image-studio'); ?></a>
				</div>
			</div>
			<div class="catalogue-image-studio-metrics">
				<?php
				$this->render_metric(__('Images scanned', 'catalogue-image-studio'), $images_scanned);
				$this->render_metric(__('Queued', 'catalogue-image-studio'), (int) ($counts['queued'] ?? 0));
				$this->render_metric(__('Processing', 'catalogue-image-studio'), (int) ($counts['processing'] ?? 0));
				$this->render_metric(__('Completed', 'catalogue-image-studio'), (int) ($counts['completed'] ?? 0));
				$this->render_metric(__('Failed', 'catalogue-image-studio'), (int) ($counts['failed'] ?? 0));
				$this->render_metric(__('Awaiting approval', 'catalogue-image-studio'), $awaiting_approval);
				?>
			</div>
		</div>
		<?php
	}

	private function render_metric(string $label, int $value): void {
		?>
		<div class="catalogue-image-studio-metric">
			<span><?php echo esc_html($label); ?></span>
			<strong><?php echo esc_html((string) $value); ?></strong>
		</div>
		<?php
	}

	private function render_scan_tab(): void {
		$filters = $this->get_scan_filters_from_query();
		$slots   = $this->filter_slots_by_processing_state($this->plugin->scanner()->get_product_images($filters));
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Scan Catalogue', 'catalogue-image-studio'); ?></h2>
			<?php $this->render_scan_filters($filters); ?>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<?php $this->render_hidden_scan_filters($filters); ?>
				<div class="catalogue-image-studio-toolbar">
					<strong><?php echo esc_html(sprintf(__('%d image(s) visible', 'catalogue-image-studio'), count($slots))); ?></strong>
					<div class="catalogue-image-studio-cta-buttons">
						<button type="submit" name="catalogue_image_studio_action" value="scan" class="button"><?php echo esc_html__('Scan all product images', 'catalogue-image-studio'); ?></button>
						<button type="submit" name="catalogue_image_studio_action" value="queue_selected_slots" class="button button-primary"><?php echo esc_html__('Queue selected', 'catalogue-image-studio'); ?></button>
						<button type="submit" name="catalogue_image_studio_action" value="queue_visible" class="button"><?php echo esc_html__('Queue all visible', 'catalogue-image-studio'); ?></button>
						<button type="submit" name="catalogue_image_studio_action" value="queue_category" class="button"><?php echo esc_html__('Queue category', 'catalogue-image-studio'); ?></button>
					</div>
				</div>
				<table class="widefat fixed striped catalogue-image-studio-jobs">
					<thead><tr><td class="check-column"><input type="checkbox" class="catalogue-image-studio-check-all" onclick="document.querySelectorAll('.catalogue-image-studio-job-check').forEach((box) => box.checked = this.checked); catalogueImageStudioUpdateSelectedCount();" /></td><th><?php echo esc_html__('Image', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('Product', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('Slot', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('Status', 'catalogue-image-studio'); ?></th></tr></thead>
					<tbody>
						<?php if (empty($slots)) : ?>
							<tr><td colspan="5"><?php echo esc_html__('No matching product images found.', 'catalogue-image-studio'); ?></td></tr>
						<?php else : ?>
							<?php foreach ($slots as $slot) : ?>
								<?php $this->render_scan_slot_row($slot); ?>
							<?php endforeach; ?>
						<?php endif; ?>
					</tbody>
				</table>
			</form>
		</div>
		<?php
	}

	private function get_scan_filters_from_query(): array {
		$settings = $this->plugin->get_settings();
		$include_featured_default = ! empty($settings['process_featured_images']);
		$include_gallery_default  = ! empty($settings['process_gallery_images']);
		$filters = [
			'category'         => isset($_GET['filter_category']) ? absint($_GET['filter_category']) : 0,
			'product_type'     => isset($_GET['filter_product_type']) ? sanitize_key(wp_unslash($_GET['filter_product_type'])) : '',
			'stock_status'     => isset($_GET['filter_stock_status']) ? sanitize_key(wp_unslash($_GET['filter_stock_status'])) : '',
			'include_featured' => isset($_GET['filter_image_gallery_only']) ? false : $include_featured_default,
			'include_gallery'  => isset($_GET['filter_image_featured_only']) ? false : $include_gallery_default,
		];

		if (! empty($_GET['filter_product_status'])) {
			$filters['status'] = [sanitize_key(wp_unslash($_GET['filter_product_status']))];
		}

		return $filters;
	}

	private function render_scan_filters(array $filters): void {
		$categories = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
		?>
		<form method="get" action="" class="catalogue-image-studio-filters">
			<input type="hidden" name="page" value="catalogue-image-studio" />
			<input type="hidden" name="cis_tab" value="scan" />
			<label><?php echo esc_html__('Category', 'catalogue-image-studio'); ?><select name="filter_category"><option value="0"><?php echo esc_html__('All categories', 'catalogue-image-studio'); ?></option><?php if (! is_wp_error($categories)) : foreach ($categories as $category) : ?><option value="<?php echo esc_attr((string) $category->term_id); ?>" <?php selected((int) ($filters['category'] ?? 0), (int) $category->term_id); ?>><?php echo esc_html($category->name); ?></option><?php endforeach; endif; ?></select></label>
			<label><?php echo esc_html__('Product status', 'catalogue-image-studio'); ?><select name="filter_product_status"><option value=""><?php echo esc_html__('Published and private', 'catalogue-image-studio'); ?></option><option value="publish" <?php selected('publish', (string) (($filters['status'][0] ?? ''))); ?>><?php echo esc_html__('Published', 'catalogue-image-studio'); ?></option><option value="draft" <?php selected('draft', (string) (($filters['status'][0] ?? ''))); ?>><?php echo esc_html__('Draft', 'catalogue-image-studio'); ?></option><option value="private" <?php selected('private', (string) (($filters['status'][0] ?? ''))); ?>><?php echo esc_html__('Private', 'catalogue-image-studio'); ?></option></select></label>
			<label><?php echo esc_html__('Product type', 'catalogue-image-studio'); ?><select name="filter_product_type"><option value=""><?php echo esc_html__('All types', 'catalogue-image-studio'); ?></option><option value="simple" <?php selected('simple', (string) ($filters['product_type'] ?? '')); ?>><?php echo esc_html__('Simple', 'catalogue-image-studio'); ?></option><option value="variable" <?php selected('variable', (string) ($filters['product_type'] ?? '')); ?>><?php echo esc_html__('Variable', 'catalogue-image-studio'); ?></option></select></label>
			<label><?php echo esc_html__('Processing state', 'catalogue-image-studio'); ?><select name="filter_processing_state"><option value=""><?php echo esc_html__('All', 'catalogue-image-studio'); ?></option><option value="unprocessed" <?php selected('unprocessed', isset($_GET['filter_processing_state']) ? sanitize_key(wp_unslash($_GET['filter_processing_state'])) : ''); ?>><?php echo esc_html__('Unprocessed', 'catalogue-image-studio'); ?></option><option value="processed" <?php selected('processed', isset($_GET['filter_processing_state']) ? sanitize_key(wp_unslash($_GET['filter_processing_state'])) : ''); ?>><?php echo esc_html__('Already processed', 'catalogue-image-studio'); ?></option></select></label>
			<label><?php echo esc_html__('Stock', 'catalogue-image-studio'); ?><select name="filter_stock_status"><option value=""><?php echo esc_html__('Any stock status', 'catalogue-image-studio'); ?></option><option value="instock" <?php selected('instock', (string) ($filters['stock_status'] ?? '')); ?>><?php echo esc_html__('In stock', 'catalogue-image-studio'); ?></option><option value="outofstock" <?php selected('outofstock', (string) ($filters['stock_status'] ?? '')); ?>><?php echo esc_html__('Out of stock', 'catalogue-image-studio'); ?></option></select></label>
			<label><input type="checkbox" name="filter_image_featured_only" value="1" <?php checked(isset($_GET['filter_image_featured_only'])); ?> /> <?php echo esc_html__('Featured images only', 'catalogue-image-studio'); ?></label>
			<label><input type="checkbox" name="filter_image_gallery_only" value="1" <?php checked(isset($_GET['filter_image_gallery_only'])); ?> /> <?php echo esc_html__('Gallery images only', 'catalogue-image-studio'); ?></label>
			<button class="button"><?php echo esc_html__('Apply filters', 'catalogue-image-studio'); ?></button>
		</form>
		<?php
	}

	private function render_hidden_scan_filters(array $filters): void {
		foreach (['category' => 'filter_category', 'product_type' => 'filter_product_type', 'stock_status' => 'filter_stock_status'] as $key => $name) {
			if (! empty($filters[$key])) {
				echo '<input type="hidden" name="' . esc_attr($name) . '" value="' . esc_attr((string) $filters[$key]) . '" />';
			}
		}

		if (! empty($filters['status'][0])) {
			echo '<input type="hidden" name="filter_product_status" value="' . esc_attr((string) $filters['status'][0]) . '" />';
		}

		if (! empty($_GET['filter_processing_state'])) {
			echo '<input type="hidden" name="filter_processing_state" value="' . esc_attr(sanitize_key(wp_unslash($_GET['filter_processing_state']))) . '" />';
		}

		if (empty($filters['include_featured'])) {
			echo '<input type="hidden" name="filter_image_gallery_only" value="1" />';
		}

		if (empty($filters['include_gallery'])) {
			echo '<input type="hidden" name="filter_image_featured_only" value="1" />';
		}
	}

	/**
	 * @param array<int,array<string,mixed>> $slots Slots.
	 * @return array<int,array<string,mixed>>
	 */
	private function filter_slots_by_processing_state(array $slots): array {
		$state = isset($_GET['filter_processing_state']) ? sanitize_key(wp_unslash($_GET['filter_processing_state'])) : '';

		if ('' === $state) {
			return $slots;
		}

		return array_values(array_filter($slots, function (array $slot) use ($state): bool {
			$job = $this->plugin->jobs()->find_by_slot($slot);

			if ($job) {
				$is_processed = in_array((string) $job['status'], ['completed', 'approved'], true);
				return 'processed' === $state ? $is_processed : ! $is_processed;
			}

			return 'unprocessed' === $state;
		}));
	}

	private function render_scan_slot_row(array $slot): void {
		$product_id    = (int) $slot['product_id'];
		$attachment_id = (int) $slot['attachment_id'];
		$value         = implode(':', [$product_id, $attachment_id, sanitize_key((string) $slot['image_role']), (int) $slot['gallery_index']]);
		$job           = $this->plugin->jobs()->find_by_slot($slot);
		$status        = $job ? $this->format_status((string) $job['status']) : __('Ready to queue', 'catalogue-image-studio');
		?>
		<tr>
			<th scope="row" class="check-column"><input type="checkbox" class="catalogue-image-studio-job-check" name="slots[]" value="<?php echo esc_attr($value); ?>" /></th>
			<td><?php $this->render_thumbnail((string) wp_get_attachment_image_url($attachment_id, 'thumbnail'), __('Product image', 'catalogue-image-studio')); ?></td>
			<td><strong><?php echo esc_html(get_the_title($product_id)); ?></strong><br /><a href="<?php echo esc_url(get_edit_post_link($product_id)); ?>"><?php echo esc_html__('Edit product', 'catalogue-image-studio'); ?></a></td>
			<td><?php echo esc_html((string) $slot['image_role']); ?> <?php echo 'gallery' === (string) $slot['image_role'] ? esc_html('#' . ((int) $slot['gallery_index'] + 1)) : ''; ?></td>
			<td><?php echo esc_html($status); ?></td>
		</tr>
		<?php
	}

	private function render_queue_tab(array $usage): void {
		$jobs = $this->plugin->jobs()->query(['status' => ['queued', 'processing', 'failed']], 100, 0);
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Queue', 'catalogue-image-studio'); ?></h2>
			<?php $this->render_monetisation_prompt($usage, max(0, (int) ($usage['credits_remaining'] ?? 0)), count($jobs), false); ?>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<div class="catalogue-image-studio-toolbar">
					<select name="catalogue_image_studio_action">
						<option value="process"><?php echo esc_html__('Process selected', 'catalogue-image-studio'); ?></option>
						<option value="process_next_batch"><?php echo esc_html__('Process next batch', 'catalogue-image-studio'); ?></option>
						<option value="retry"><?php echo esc_html__('Retry failed', 'catalogue-image-studio'); ?></option>
						<option value="cancel"><?php echo esc_html__('Cancel selected', 'catalogue-image-studio'); ?></option>
					</select>
					<button type="submit" class="button button-primary"><?php echo esc_html__('Apply', 'catalogue-image-studio'); ?></button>
				</div>
				<?php $this->render_jobs_table($jobs, true); ?>
			</form>
		</div>
		<?php
	}

	private function render_review_tab(): void {
		$jobs = $this->plugin->jobs()->query(['status' => ['completed', 'approved', 'rejected', 'reverted']], 100, 0);
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Review & Approve', 'catalogue-image-studio'); ?></h2>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<div class="catalogue-image-studio-toolbar">
					<select name="catalogue_image_studio_action">
						<option value="approve"><?php echo esc_html__('Approve all selected', 'catalogue-image-studio'); ?></option>
						<option value="reject"><?php echo esc_html__('Reject selected', 'catalogue-image-studio'); ?></option>
						<option value="retry"><?php echo esc_html__('Retry selected', 'catalogue-image-studio'); ?></option>
						<option value="revert"><?php echo esc_html__('Revert selected', 'catalogue-image-studio'); ?></option>
					</select>
					<button type="submit" class="button button-primary"><?php echo esc_html__('Apply', 'catalogue-image-studio'); ?></button>
				</div>
				<?php $this->render_jobs_table($jobs, true); ?>
			</form>
		</div>
		<?php
	}

	private function render_settings_tab(array $settings, array $usage): void {
		$categories = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Settings', 'catalogue-image-studio'); ?></h2>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_save_settings', 'catalogue_image_studio_settings_nonce'); ?>
				<input type="hidden" name="catalogue_image_studio_full_settings" value="1" />
				<details class="catalogue-image-studio-connected-details">
					<summary><?php echo esc_html__('Connection', 'catalogue-image-studio'); ?></summary>
					<?php $this->render_connection_status($usage, true); ?>
					<div class="catalogue-image-studio-actions">
						<button type="submit" name="disconnect_store" value="1" class="button catalogue-image-studio-danger-link"><?php echo esc_html__('Disconnect', 'catalogue-image-studio'); ?></button>
					</div>
				</details>

				<div class="catalogue-image-studio-settings-grid">
					<section>
						<h3><?php echo esc_html__('Processing defaults', 'catalogue-image-studio'); ?></h3>
						<label><input type="checkbox" name="approval_required" value="1" <?php checked(! empty($settings['approval_required'])); ?> /> <?php echo esc_html__('Approval required before replacement', 'catalogue-image-studio'); ?></label>
						<label><input type="checkbox" name="auto_process_new_images" value="1" <?php checked(! empty($settings['auto_process_new_images'])); ?> /> <?php echo esc_html__('Auto-process new product images', 'catalogue-image-studio'); ?></label>
						<label><input type="checkbox" name="process_featured_images" value="1" <?php checked(! empty($settings['process_featured_images'])); ?> /> <?php echo esc_html__('Process featured images', 'catalogue-image-studio'); ?></label>
						<label><input type="checkbox" name="process_gallery_images" value="1" <?php checked(! empty($settings['process_gallery_images'])); ?> /> <?php echo esc_html__('Process gallery images', 'catalogue-image-studio'); ?></label>
						<label><input type="checkbox" name="duplicate_detection" value="1" <?php checked(! empty($settings['duplicate_detection'])); ?> /> <?php echo esc_html__('Duplicate detection', 'catalogue-image-studio'); ?></label>
						<label><input type="checkbox" name="smart_scaling_enabled" value="1" <?php checked(! empty($settings['smart_scaling_enabled'])); ?> /> <?php echo esc_html__('Smart scaling', 'catalogue-image-studio'); ?></label>
					</section>
					<section>
						<h3><?php echo esc_html__('Category presets', 'catalogue-image-studio'); ?></h3>
						<label><?php echo esc_html__('Category', 'catalogue-image-studio'); ?><select name="category_preset_category"><option value="0"><?php echo esc_html__('Choose category', 'catalogue-image-studio'); ?></option><?php if (! is_wp_error($categories)) : foreach ($categories as $category) : ?><option value="<?php echo esc_attr((string) $category->term_id); ?>"><?php echo esc_html($category->name); ?></option><?php endforeach; endif; ?></select></label>
						<label><input type="checkbox" name="category_preset_enabled" value="1" /> <?php echo esc_html__('Enable processing for category', 'catalogue-image-studio'); ?></label>
						<label><?php echo esc_html__('Scale mode', 'catalogue-image-studio'); ?><select name="category_scale_mode"><option value="auto">Auto</option><option value="compact">Compact</option><option value="wide">Wide</option><option value="tall">Tall</option><option value="close-up">Close-up</option></select></label>
						<label><?php echo esc_html__('Background preset', 'catalogue-image-studio'); ?><input type="text" name="category_background" value="optivra-default" /></label>
						<label><?php echo esc_html__('Shadow strength', 'catalogue-image-studio'); ?><select name="category_shadow_strength"><option value="none">None</option><option value="light">Light</option><option value="medium" selected>Medium</option><option value="strong">Strong</option></select></label>
					</section>
					<section>
						<h3><?php echo esc_html__('SEO settings', 'catalogue-image-studio'); ?></h3>
						<label><input type="checkbox" name="enable_filename_seo" value="1" <?php checked(! empty($settings['enable_filename_seo'])); ?> /> <?php echo esc_html__('Generate SEO filename', 'catalogue-image-studio'); ?></label>
						<label><input type="checkbox" name="enable_alt_text" value="1" <?php checked(! empty($settings['enable_alt_text'])); ?> /> <?php echo esc_html__('Generate alt text', 'catalogue-image-studio'); ?></label>
						<label><input type="checkbox" name="only_fill_missing" value="1" <?php checked(! empty($settings['only_fill_missing'])); ?> /> <?php echo esc_html__('Only fill missing metadata', 'catalogue-image-studio'); ?></label>
						<label><input type="checkbox" name="overwrite_existing_meta" value="1" <?php checked(! empty($settings['overwrite_existing_meta'])); ?> /> <?php echo esc_html__('Overwrite existing metadata', 'catalogue-image-studio'); ?></label>
						<label><?php echo esc_html__('Custom keyword / brand suffix', 'catalogue-image-studio'); ?><input type="text" name="seo_brand_suffix" value="<?php echo esc_attr((string) ($settings['seo_brand_suffix'] ?? '')); ?>" /></label>
					</section>
					<section>
						<h3><?php echo esc_html__('Defaults', 'catalogue-image-studio'); ?></h3>
						<label><?php echo esc_html__('Background preset', 'catalogue-image-studio'); ?><input type="text" name="background" value="<?php echo esc_attr((string) $settings['background']); ?>" /></label>
						<label><?php echo esc_html__('Scale', 'catalogue-image-studio'); ?><select name="scale_percent"><option value="auto" <?php selected('auto', (string) $settings['scale_percent']); ?>>Auto</option><option value="82" <?php selected('82', (string) $settings['scale_percent']); ?>>82%</option><option value="90" <?php selected('90', (string) $settings['scale_percent']); ?>>90%</option><option value="100" <?php selected('100', (string) $settings['scale_percent']); ?>>100%</option></select></label>
						<label><input type="checkbox" name="shadow_enabled" value="1" <?php checked(! empty($settings['shadow_enabled'])); ?> /> <?php echo esc_html__('Shadow enabled', 'catalogue-image-studio'); ?></label>
						<label><?php echo esc_html__('Shadow strength', 'catalogue-image-studio'); ?><select name="shadow_strength"><option value="light" <?php selected('light', (string) $settings['shadow_strength']); ?>>Light</option><option value="medium" <?php selected('medium', (string) $settings['shadow_strength']); ?>>Medium</option><option value="strong" <?php selected('strong', (string) $settings['shadow_strength']); ?>>Strong</option></select></label>
					</section>
				</div>
				<?php $this->render_advanced_settings($settings); ?>
				<p class="submit"><button type="submit" class="button button-primary"><?php echo esc_html__('Save settings', 'catalogue-image-studio'); ?></button></p>
			</form>
		</div>
		<?php
	}

	private function render_logs_tab(): void {
		$failed = $this->plugin->jobs()->query(['status' => 'failed'], 50, 0);
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Logs', 'catalogue-image-studio'); ?></h2>
			<div class="catalogue-image-studio-log-grid">
				<section><h3><?php echo esc_html__('Connection logs', 'catalogue-image-studio'); ?></h3><p><?php echo esc_html__('Connection attempts are recorded in WooCommerce logs under source catalogue-image-studio. Secrets are never written to logs.', 'catalogue-image-studio'); ?></p></section>
				<section><h3><?php echo esc_html__('Job logs', 'catalogue-image-studio'); ?></h3><p><?php echo esc_html__('Recent failed job messages appear below. Full job events are available in WooCommerce logs.', 'catalogue-image-studio'); ?></p></section>
			</div>
			<button type="button" class="button" onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('catalogue-image-studio-diagnostics').textContent);"><?php echo esc_html__('Copy support diagnostics', 'catalogue-image-studio'); ?></button>
			<pre id="catalogue-image-studio-diagnostics"><?php echo esc_html(wp_json_encode(['plugin' => CIS_VERSION, 'site' => home_url(), 'php' => PHP_VERSION], JSON_PRETTY_PRINT)); ?></pre>
			<?php $this->render_jobs_table($failed, false); ?>
		</div>
		<?php
	}

	private function render_jobs_table(array $jobs, bool $selectable): void {
		$empty_message = $selectable
			? __('Run your first scan to find WooCommerce product images.', 'catalogue-image-studio')
			: __('No failed jobs to show.', 'catalogue-image-studio');
		?>
		<table class="widefat fixed striped catalogue-image-studio-jobs">
			<thead>
				<tr>
					<?php if ($selectable) : ?><td class="check-column"><input type="checkbox" class="catalogue-image-studio-check-all" onclick="document.querySelectorAll('.catalogue-image-studio-job-check').forEach((box) => box.checked = this.checked); catalogueImageStudioUpdateSelectedCount();" /></td><?php endif; ?>
					<th><?php echo esc_html__('Product', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('Before', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('After', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('Slot', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('Status', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('SEO filename / alt preview', 'catalogue-image-studio'); ?></th><th><?php echo esc_html__('Progress / message', 'catalogue-image-studio'); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php if (empty($jobs)) : ?>
					<tr><td colspan="<?php echo $selectable ? '8' : '7'; ?>"><?php echo esc_html($empty_message); ?></td></tr>
				<?php else : ?>
					<?php foreach ($jobs as $job) : ?>
						<?php $this->render_job_row($job, $selectable); ?>
					<?php endforeach; ?>
				<?php endif; ?>
			</tbody>
		</table>
		<?php
	}

	private function render_tabs(string $active_tab): void {
		$tabs = [
			'dashboard' => __('Dashboard', 'catalogue-image-studio'),
			'scan'      => __('Scan Catalogue', 'catalogue-image-studio'),
			'queue'     => __('Queue', 'catalogue-image-studio'),
			'review'    => __('Review & Approve', 'catalogue-image-studio'),
			'settings'  => __('Settings', 'catalogue-image-studio'),
			'logs'      => __('Logs', 'catalogue-image-studio'),
		];
		?>
		<nav class="nav-tab-wrapper catalogue-image-studio-tabs">
			<?php foreach ($tabs as $tab => $label) : ?>
				<a class="nav-tab <?php echo $tab === $active_tab ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url(add_query_arg(['page' => 'catalogue-image-studio', 'cis_tab' => $tab], admin_url('admin.php'))); ?>">
					<?php echo esc_html($label); ?>
				</a>
			<?php endforeach; ?>
		</nav>
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

		$client = new Catalogue_Image_Studio_SaaSClient(
			(string) $settings['api_base_url'],
			(string) $settings['api_token'],
			$this->plugin->logger()
		);

		return $client->get_usage();
	}

	/**
	 * @param array<string,mixed>           $settings Settings.
	 * @param array<string,mixed>|\WP_Error $usage Usage.
	 * @return void
	 */
	private function render_settings_panel(array $settings, $usage): void {
		$connected = ! is_wp_error($usage);
		?>
		<div class="catalogue-image-studio-panel catalogue-image-studio-onboarding">
			<div class="catalogue-image-studio-step">1</div>
			<h2><?php echo esc_html__('Connect Catalogue Image Studio to Optivra', 'catalogue-image-studio'); ?></h2>
			<p><?php echo esc_html__('Paste your Site API Token from your Optivra account to connect this store.', 'catalogue-image-studio'); ?></p>

			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_save_settings', 'catalogue_image_studio_settings_nonce'); ?>
				<label class="catalogue-image-studio-token-field" for="catalogue-image-studio-api-token">
					<span><?php echo esc_html__('Site API Token', 'catalogue-image-studio'); ?></span>
					<input
						type="password"
						id="catalogue-image-studio-api-token"
						name="api_token"
						class="regular-text"
						value=""
						placeholder="<?php echo esc_attr(! empty($settings['api_token']) ? __('Token saved - leave blank to keep it', 'catalogue-image-studio') : __('Paste your Site API Token', 'catalogue-image-studio')); ?>"
						autocomplete="new-password"
					/>
				</label>

				<div class="catalogue-image-studio-link-row">
					<a href="<?php echo esc_url(trailingslashit((string) $settings['api_base_url']) . 'account/sites'); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Get your API token', 'catalogue-image-studio'); ?></a>
					<a href="<?php echo esc_url(trailingslashit((string) $settings['api_base_url']) . 'signup'); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Create an Optivra account', 'catalogue-image-studio'); ?></a>
				</div>

				<div class="catalogue-image-studio-actions">
					<button type="submit" name="connect_store" value="1" class="button button-primary"><?php echo esc_html__('Connect Store', 'catalogue-image-studio'); ?></button>
					<button type="submit" name="test_connection" value="1" class="button"><?php echo esc_html__('Test Connection', 'catalogue-image-studio'); ?></button>
					<?php if (! empty($settings['api_token'])) : ?>
						<button type="submit" name="disconnect_store" value="1" class="button catalogue-image-studio-danger-link"><?php echo esc_html__('Disconnect', 'catalogue-image-studio'); ?></button>
					<?php endif; ?>
				</div>

				<?php $this->render_advanced_settings($settings); ?>
			</form>
			<?php $this->render_connection_status($usage, $connected); ?>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed>|\WP_Error $usage Usage.
	 * @return void
	 */
	private function render_advanced_settings(array $settings): void {
		?>
		<details class="catalogue-image-studio-advanced">
			<summary><?php echo esc_html__('Advanced Settings', 'catalogue-image-studio'); ?></summary>
			<p class="catalogue-image-studio-warning"><?php echo esc_html__('These settings are for development/support use only. Most users should not change them.', 'catalogue-image-studio'); ?></p>
			<div class="catalogue-image-studio-advanced-grid">
				<label>
					<span><?php echo esc_html__('API Base URL override', 'catalogue-image-studio'); ?></span>
					<input type="url" name="api_base_url" class="regular-text" value="<?php echo esc_attr((string) $settings['api_base_url']); ?>" placeholder="https://image-studio.onrender.com" />
				</label>
				<label><input type="checkbox" name="debug_mode" value="1" <?php checked(! empty($settings['debug_mode'])); ?> /> <?php echo esc_html__('Debug mode', 'catalogue-image-studio'); ?></label>
			</div>
			<button type="submit" name="clear_local_cache" value="1" class="button"><?php echo esc_html__('Clear local cache', 'catalogue-image-studio'); ?></button>
			<button type="submit" name="reset_local_data" value="1" class="button catalogue-image-studio-danger-link"><?php echo esc_html__('Reset plugin local data', 'catalogue-image-studio'); ?></button>
		</details>
		<?php
	}

	/**
	 * @param array<string,mixed>|\WP_Error $usage Usage.
	 * @return void
	 */
	private function render_connection_status($usage, bool $connected): void {
		if (! $connected || is_wp_error($usage)) {
			?>
			<div class="catalogue-image-studio-status-card catalogue-image-studio-status-card-disconnected">
				<strong><?php echo esc_html__('Not connected', 'catalogue-image-studio'); ?></strong>
				<p><?php echo esc_html__('Connect your Optivra account to view credits and process images.', 'catalogue-image-studio'); ?></p>
			</div>
			<?php
			return;
		}

		$this->render_usage($usage);
	}

	/**
	 * @param array<string,mixed>|\WP_Error $usage Usage.
	 * @return void
	 */
	private function render_usage($usage): void {
		if (is_wp_error($usage)) {
			?>
			<div class="catalogue-image-studio-status-card catalogue-image-studio-status-card-disconnected">
				<strong><?php echo esc_html__('Not connected', 'catalogue-image-studio'); ?></strong>
				<p><?php echo esc_html__('Connect your Optivra account to view credits and process images.', 'catalogue-image-studio'); ?></p>
			</div>
			<?php
			return;
		}

		?>
		<div class="catalogue-image-studio-status-card catalogue-image-studio-status-card-connected">
			<strong><?php echo esc_html__('Connected', 'catalogue-image-studio'); ?></strong>
			<?php if (! empty($usage['domain']) && is_string($usage['domain'])) : ?>
				<p><?php echo esc_html(sprintf(__('Connected domain: %s', 'catalogue-image-studio'), $usage['domain'])); ?></p>
			<?php endif; ?>
		</div>
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
			<div>
				<span><?php echo esc_html__('Current period end', 'catalogue-image-studio'); ?></span>
				<strong>
					<?php
					$period_end = isset($usage['current_period_end']) ? $usage['current_period_end'] : ($usage['next_reset_at'] ?? null);
					$period_ts  = is_string($period_end) ? strtotime($period_end) : false;
					echo esc_html($period_ts ? date_i18n(get_option('date_format'), $period_ts) : __('Unavailable', 'catalogue-image-studio'));
					?>
				</strong>
			</div>
		</div>
		<?php
		$remaining = max(0, (int) ($usage['credits_remaining'] ?? 0));
		$total     = max(0, (int) ($usage['credits_total'] ?? 0));
		$percent   = $total > 0 ? min(100, max(0, round(($remaining / $total) * 100))) : 0;
		?>
		<div class="catalogue-image-studio-credit-meter" aria-label="<?php echo esc_attr__('Credits remaining', 'catalogue-image-studio'); ?>">
			<div style="width: <?php echo esc_attr((string) $percent); ?>%;"></div>
		</div>
		<p class="catalogue-image-studio-muted">
			<?php
			$next_reset = isset($usage['next_reset_at']) && is_string($usage['next_reset_at']) ? strtotime($usage['next_reset_at']) : false;
			echo esc_html(
				$next_reset
					? sprintf(
						/* translators: %s: reset date */
						__('Next reset: %s', 'catalogue-image-studio'),
						date_i18n(get_option('date_format'), $next_reset)
					)
					: __('Next reset date unavailable.', 'catalogue-image-studio')
			);
			?>
		</p>
		<?php
	}

	/**
	 * @param array<int,array<string,mixed>> $jobs Jobs.
	 * @return void
	 */
	private function render_workflow_panel(array $jobs, $usage, array $settings, int $processable_count): void {
		$credits_remaining = is_wp_error($usage) ? 0 : max(0, (int) ($usage['credits_remaining'] ?? 0));
		$insufficient      = $processable_count > $credits_remaining;
		$connected         = ! is_wp_error($usage);
		?>
		<div class="catalogue-image-studio-panel catalogue-image-studio-panel-wide">
			<div class="catalogue-image-studio-workflow-steps">
				<div class="catalogue-image-studio-workflow-step <?php echo $connected ? 'catalogue-image-studio-workflow-step-complete' : ''; ?>"><span>1</span><?php echo esc_html__('Connect', 'catalogue-image-studio'); ?></div>
				<div class="catalogue-image-studio-workflow-step"><span>2</span><?php echo esc_html__('Scan', 'catalogue-image-studio'); ?></div>
				<div class="catalogue-image-studio-workflow-step"><span>3</span><?php echo esc_html__('Optimise', 'catalogue-image-studio'); ?></div>
				<div class="catalogue-image-studio-workflow-step"><span>4</span><?php echo esc_html__('Review & approve', 'catalogue-image-studio'); ?></div>
			</div>
			<div class="catalogue-image-studio-toolbar">
				<h2><?php echo esc_html__('Images', 'catalogue-image-studio'); ?></h2>
				<form method="post" action="">
					<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
					<input type="hidden" name="catalogue_image_studio_action" value="scan" />
					<button type="submit" class="button" <?php disabled(! $connected); ?>><?php echo esc_html__('Scan Product Images', 'catalogue-image-studio'); ?></button>
				</form>
			</div>

			<?php if (! $connected) : ?>
				<div class="catalogue-image-studio-empty-state">
					<?php echo esc_html__('Connect your Optivra account, then scan your product catalogue to find images ready for optimisation.', 'catalogue-image-studio'); ?>
				</div>
			<?php else : ?>
				<?php $this->render_monetisation_prompt($usage, $credits_remaining, $processable_count, $insufficient); ?>
			<?php endif; ?>

			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<div class="tablenav top">
					<div class="alignleft actions">
						<select name="catalogue_image_studio_action" <?php disabled(! $connected); ?>>
							<option value="process"><?php echo esc_html__('Process selected', 'catalogue-image-studio'); ?></option>
							<option value="approve"><?php echo esc_html__('Approve selected', 'catalogue-image-studio'); ?></option>
							<option value="reject"><?php echo esc_html__('Reject selected', 'catalogue-image-studio'); ?></option>
							<option value="revert"><?php echo esc_html__('Revert selected', 'catalogue-image-studio'); ?></option>
						</select>
						<button type="submit" class="button button-primary" <?php disabled(! $connected); ?>><?php echo esc_html__('Apply', 'catalogue-image-studio'); ?></button>
					</div>
				</div>

				<?php if ($connected) : ?>
					<table class="widefat fixed striped catalogue-image-studio-jobs">
						<thead>
							<tr>
								<td class="check-column"><input type="checkbox" class="catalogue-image-studio-check-all" onclick="document.querySelectorAll('.catalogue-image-studio-job-check').forEach((box) => box.checked = this.checked); catalogueImageStudioUpdateSelectedCount();" /></td>
								<th><?php echo esc_html__('Product', 'catalogue-image-studio'); ?></th>
								<th><?php echo esc_html__('Before', 'catalogue-image-studio'); ?></th>
								<th><?php echo esc_html__('After', 'catalogue-image-studio'); ?></th>
								<th><?php echo esc_html__('Slot', 'catalogue-image-studio'); ?></th>
								<th><?php echo esc_html__('Status', 'catalogue-image-studio'); ?></th>
								<th><?php echo esc_html__('SEO', 'catalogue-image-studio'); ?></th>
								<th><?php echo esc_html__('Updated', 'catalogue-image-studio'); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php if (empty($jobs)) : ?>
								<tr><td colspan="8"><?php echo esc_html__('Run your first scan to find WooCommerce product images.', 'catalogue-image-studio'); ?></td></tr>
							<?php else : ?>
								<?php foreach ($jobs as $job) : ?>
									<?php $this->render_job_row($job); ?>
								<?php endforeach; ?>
							<?php endif; ?>
						</tbody>
					</table>
				<?php endif; ?>
			</form>
		</div>
		<?php
	}

	private function render_monetisation_prompt($usage, int $credits_remaining, int $processable_count, bool $insufficient): void {
		$available_now = min($credits_remaining, $processable_count);
		?>
		<div class="catalogue-image-studio-monetisation <?php echo $insufficient ? 'catalogue-image-studio-monetisation-warning' : ''; ?>">
			<div>
				<strong>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %d: images left */
							__('You have %d images left to optimise.', 'catalogue-image-studio'),
							$credits_remaining
						)
					);
					?>
				</strong>
				<p>
					<?php echo esc_html__('Selected:', 'catalogue-image-studio'); ?>
					<span data-cis-selected-count>0</span>
					<?php echo esc_html__('image(s). Available credits:', 'catalogue-image-studio'); ?>
					<?php echo esc_html((string) $credits_remaining); ?>.
				</p>
				<?php if ($insufficient) : ?>
					<p><?php echo esc_html(sprintf(
						/* translators: %d: processable images */
						__('Process %d now, then buy credits or upgrade plan. Upgrade to process your full catalogue.', 'catalogue-image-studio'),
						$available_now
					)); ?></p>
				<?php else : ?>
					<p><?php echo esc_html__('Upgrade to process your full catalogue.', 'catalogue-image-studio'); ?></p>
				<?php endif; ?>
			</div>
			<div class="catalogue-image-studio-cta-buttons">
				<a class="button button-primary" href="<?php echo esc_url($this->get_upgrade_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Upgrade plan', 'catalogue-image-studio'); ?></a>
				<a class="button" href="<?php echo esc_url($this->get_buy_credits_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Buy credits', 'catalogue-image-studio'); ?></a>
				<a class="button" href="<?php echo esc_url($this->get_account_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Manage account', 'catalogue-image-studio'); ?></a>
			</div>
		</div>
		<?php
	}

	/**
	 * @param array<int,array<string,mixed>> $jobs Jobs.
	 */
	private function count_processable_jobs(array $jobs): int {
		$count = 0;

		foreach ($jobs as $job) {
			if (in_array((string) ($job['status'] ?? ''), ['unprocessed', 'failed', 'rejected', 'reverted'], true)) {
				$count++;
			}
		}

		return $count;
	}

	/**
	 * @param array<string,mixed>|mixed $usage Usage.
	 */
	private function get_upgrade_url($usage, array $settings = []): string {
		if (is_array($usage) && ! empty($usage['account_urls']['billing']) && is_string($usage['account_urls']['billing'])) {
			return $usage['account_urls']['billing'];
		}

		return trailingslashit((string) ($settings['api_base_url'] ?? 'https://image-studio.onrender.com')) . 'account/billing';
	}

	/**
	 * @param array<string,mixed>|mixed $usage Usage.
	 */
	private function get_buy_credits_url($usage, array $settings = []): string {
		if (is_array($usage) && ! empty($usage['account_urls']['credits']) && is_string($usage['account_urls']['credits'])) {
			return $usage['account_urls']['credits'];
		}

		return trailingslashit((string) ($settings['api_base_url'] ?? 'https://image-studio.onrender.com')) . 'account/credits';
	}

	/**
	 * @param array<string,mixed>|mixed $usage Usage.
	 */
	private function get_account_url($usage, array $settings = []): string {
		if (is_array($usage) && ! empty($usage['account_urls']['account']) && is_string($usage['account_urls']['account'])) {
			return $usage['account_urls']['account'];
		}

		return trailingslashit((string) ($settings['api_base_url'] ?? 'https://image-studio.onrender.com')) . 'account';
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return void
	 */
	private function render_job_row(array $job, bool $selectable = true): void {
		$product_id       = (int) ($job['product_id'] ?? 0);
		$attachment_id    = (int) ($job['attachment_id'] ?? 0);
		$processed_id     = (int) ($job['processed_attachment_id'] ?? 0);
		$before_url       = $attachment_id ? wp_get_attachment_image_url($attachment_id, 'thumbnail') : '';
		$processed_source = $processed_id ? wp_get_attachment_image_url($processed_id, 'thumbnail') : (string) ($job['processed_url'] ?? '');
		$product_title    = $product_id ? get_the_title($product_id) : __('Unknown product', 'catalogue-image-studio');
		?>
		<tr>
			<?php if ($selectable) : ?>
				<th scope="row" class="check-column">
					<input type="checkbox" class="catalogue-image-studio-job-check" name="job_ids[]" value="<?php echo esc_attr((string) (int) $job['id']); ?>" />
				</th>
			<?php endif; ?>
			<td>
				<strong><?php echo esc_html($product_title); ?></strong><br />
				<a href="<?php echo esc_url(get_edit_post_link($product_id)); ?>"><?php echo esc_html__('Edit product', 'catalogue-image-studio'); ?></a>
			</td>
			<td><?php $this->render_thumbnail($before_url, __('Before', 'catalogue-image-studio')); ?></td>
			<td><?php $this->render_thumbnail($processed_source, __('After', 'catalogue-image-studio')); ?></td>
			<td><?php echo esc_html((string) $job['image_role']); ?> <?php echo 'gallery' === (string) $job['image_role'] ? esc_html('#' . ((int) $job['gallery_index'] + 1)) : ''; ?></td>
			<td><span class="catalogue-image-studio-status catalogue-image-studio-status-<?php echo esc_attr(sanitize_key((string) $job['status'])); ?>"><?php echo esc_html($this->format_status((string) $job['status'])); ?></span><?php echo ! empty($job['error_message']) ? '<br /><small>' . esc_html((string) $job['error_message']) . '</small>' : ''; ?></td>
			<td><?php $this->render_seo_fields($job); ?></td>
			<td>
				<?php echo ! empty($job['error_message']) ? esc_html((string) $job['error_message']) : esc_html((string) ($job['updated_at'] ?? '')); ?>
			</td>
		</tr>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return void
	 */
	private function render_seo_fields(array $job): void {
		$job_id = (int) $job['id'];
		$fields = [
			'filename'    => __('Filename', 'catalogue-image-studio'),
			'alt_text'    => __('Alt', 'catalogue-image-studio'),
			'title'       => __('Title', 'catalogue-image-studio'),
			'caption'     => __('Caption', 'catalogue-image-studio'),
			'description' => __('Description', 'catalogue-image-studio'),
		];
		$values = [
			'filename'    => (string) ($job['seo_filename'] ?? ''),
			'alt_text'    => (string) ($job['seo_alt_text'] ?? ''),
			'title'       => (string) ($job['seo_title'] ?? ''),
			'caption'     => (string) ($job['seo_caption'] ?? ''),
			'description' => (string) ($job['seo_description'] ?? ''),
		];
		?>
		<div class="catalogue-image-studio-seo-fields">
			<?php foreach ($fields as $field => $label) : ?>
				<label>
					<span><?php echo esc_html($label); ?></span>
					<?php if ('description' === $field) : ?>
						<textarea name="seo[<?php echo esc_attr((string) $job_id); ?>][<?php echo esc_attr($field); ?>]" rows="2"><?php echo esc_textarea($values[$field]); ?></textarea>
					<?php else : ?>
						<input type="text" name="seo[<?php echo esc_attr((string) $job_id); ?>][<?php echo esc_attr($field); ?>]" value="<?php echo esc_attr($values[$field]); ?>" />
					<?php endif; ?>
				</label>
			<?php endforeach; ?>
		</div>
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

	private function format_status(string $status): string {
		return ucwords(str_replace('_', ' ', sanitize_key($status)));
	}
}
