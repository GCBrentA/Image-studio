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
		add_action('admin_init', [$this, 'register_settings']);
		add_action('admin_init', [$this, 'handle_settings_post']);
		add_action('admin_init', [$this, 'handle_workflow_post']);
		add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
	}

	public function register_settings(): void {
		register_setting(
			'catalogue_image_studio_settings_group',
			$this->plugin->get_option_name(),
			[
				'type'              => 'array',
				'sanitize_callback' => [$this, 'sanitize_settings_payload'],
				'default'           => $this->plugin->get_default_settings(),
			]
		);
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
			__('Optivra Image Studio', 'optivra-image-studio-for-woocommerce'),
			__('Optivra Image Studio', 'optivra-image-studio-for-woocommerce'),
			'manage_woocommerce',
			'optivra',
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

		wp_enqueue_media();
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
			document.addEventListener('DOMContentLoaded', function() {
				catalogueImageStudioUpdateSelectedCount();
				var onlyFill = document.querySelector('input[name=\"only_fill_missing_metadata\"]');
				var overwrite = document.querySelector('input[name=\"overwrite_existing_metadata\"]');
				function syncSeoMetadataToggles(changed) {
					if (!onlyFill || !overwrite) {
						return;
					}
					if (changed === onlyFill && onlyFill.checked) {
						overwrite.checked = false;
					}
					if (changed === overwrite && overwrite.checked) {
						onlyFill.checked = false;
					}
				}
				if (onlyFill) {
					onlyFill.addEventListener('change', function() { syncSeoMetadataToggles(onlyFill); });
				}
				if (overwrite) {
					overwrite.addEventListener('change', function() { syncSeoMetadataToggles(overwrite); });
				}
				var button = document.getElementById('catalogue-image-studio-pick-background');
				var removeButton = document.getElementById('catalogue-image-studio-remove-background');
				if (!button || typeof wp === 'undefined' || !wp.media) {
					if (removeButton) {
						removeButton.addEventListener('click', function(event) {
							event.preventDefault();
							var attachmentField = document.getElementById('catalogue-image-studio-custom-background-id');
							var preview = document.getElementById('catalogue-image-studio-custom-background-preview');
							var filename = document.getElementById('catalogue-image-studio-custom-background-filename');
							if (attachmentField) {
								attachmentField.value = '';
							}
							if (preview) {
								preview.src = '';
								preview.hidden = true;
							}
							if (filename) {
								filename.textContent = '';
								filename.hidden = true;
							}
						});
					}
					return;
				}
				var attachmentField = document.getElementById('catalogue-image-studio-custom-background-id');
				var preview = document.getElementById('catalogue-image-studio-custom-background-preview');
				var filename = document.getElementById('catalogue-image-studio-custom-background-filename');
				var frame;
				button.addEventListener('click', function(event) {
					event.preventDefault();
					if (frame) {
						frame.open();
						return;
					}
					frame = wp.media({
						title: 'Choose background image',
						button: { text: 'Use background' },
						multiple: false,
						library: { type: 'image' }
					});
					frame.on('select', function() {
						var selection = frame.state().get('selection').first();
						if (!selection) {
							return;
						}
						var attachment = selection.toJSON();
						if (attachmentField) {
							attachmentField.value = String(attachment.id || '');
						}
						if (preview && attachment.url) {
							preview.src = attachment.url;
							preview.hidden = false;
						}
						if (filename) {
							filename.textContent = attachment.filename || '';
							filename.hidden = !(attachment.filename || '');
						}
					});
					frame.open();
				});
				if (removeButton) {
					removeButton.addEventListener('click', function(event) {
						event.preventDefault();
						if (attachmentField) {
							attachmentField.value = '';
						}
						if (preview) {
							preview.src = '';
							preview.hidden = true;
						}
						if (filename) {
							filename.textContent = '';
							filename.hidden = true;
						}
					});
				}
			});"
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
			$this->queue_notice(__('Store disconnected.', 'optivra-image-studio-for-woocommerce'), 'success');
			$this->redirect_after_settings_post();
			return;
		}

		$input = is_array($_POST) ? wp_unslash($_POST) : [];

		if (empty($input['api_token'])) {
			$input['api_token'] = (string) $settings['api_token'];
		}

		if (empty($input['catalogue_image_studio_full_settings'])) {
			$input = array_merge($settings, $input);
		}

		$settings = $this->sanitize_settings_payload($input);

		if (isset($_POST['remove_category_preset'])) {
			$category_id = isset($_POST['category_preset_category']) ? absint($_POST['category_preset_category']) : 0;
			if ($category_id > 0 && isset($settings['category_presets'][$category_id])) {
				unset($settings['category_presets'][$category_id]);
			}
		}

		$saved = update_option($this->plugin->get_option_name(), $settings, false);
		if (! $saved && get_option($this->plugin->get_option_name()) !== $settings) {
			$this->plugin->logger()->error('Optivra Image Studio settings save failed.', ['option' => $this->plugin->get_option_name()]);
			$this->queue_notice(__('Settings could not be saved. Please try again.', 'optivra-image-studio-for-woocommerce'), 'error');
			$this->redirect_after_settings_post();
			return;
		}

		if (! empty($settings['debug_mode'])) {
			$this->plugin->logger()->info(
				'Optivra Image Studio settings saved.',
				[
					'saved_option' => $this->sanitize_settings_for_debug_log($settings),
				]
			);
		}

		if (isset($_POST['clear_local_cache'])) {
			$this->plugin->jobs()->delete_all();
			$this->queue_notice(__('Local image job cache cleared.', 'optivra-image-studio-for-woocommerce'), 'success');
			$this->redirect_after_settings_post();
			return;
		}

		if (isset($_POST['reset_local_data'])) {
			$this->plugin->jobs()->delete_all();
			$this->queue_notice(__('Plugin local data reset.', 'optivra-image-studio-for-woocommerce'), 'success');
			$this->redirect_after_settings_post();
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
				$this->queue_notice($usage->get_error_message(), 'error');
			} else {
				$this->queue_notice(__('Store connected to Optivra.', 'optivra-image-studio-for-woocommerce'), 'success');
			}
		} else {
			$this->queue_notice(__('Settings saved.', 'optivra-image-studio-for-woocommerce'), 'success');
		}

		$this->redirect_after_settings_post();
	}

	public function sanitize_settings_payload($input): array {
		$defaults = $this->plugin->get_default_settings();
		$current  = $this->plugin->get_settings();
		$input    = is_array($input) ? $input : [];
		$settings = wp_parse_args($current, $defaults);

		$settings['enabled']                 = true;
		$posted_token = isset($input['api_token']) ? trim(sanitize_text_field((string) $input['api_token'])) : '';
		$placeholder_token = __('Token saved - leave blank to keep it', 'optivra-image-studio-for-woocommerce');
		$settings['api_token'] = ('' !== $posted_token && $posted_token !== $placeholder_token && false === strpos($posted_token, '*'))
			? $posted_token
			: (string) $settings['api_token'];
		$settings['api_base_url_override']   = isset($input['api_base_url_override']) ? esc_url_raw((string) $input['api_base_url_override']) : (string) ($settings['api_base_url_override'] ?? '');
		$settings['api_base_url']            = '' !== (string) $settings['api_base_url_override'] ? (string) $settings['api_base_url_override'] : (string) $defaults['api_base_url'];
		$settings['require_approval']        = ! empty($input['require_approval']);
		$settings['approval_required']       = $settings['require_approval'];
		$settings['auto_process_new_images'] = ! empty($input['auto_process_new_images']);
		$settings['process_featured_images'] = ! empty($input['process_featured_images']);
		$settings['process_gallery_images']  = ! empty($input['process_gallery_images']);
		$settings['process_category_images'] = ! empty($input['process_category_images']);
		$settings['smart_scaling']           = ! empty($input['smart_scaling']);
		$settings['smart_scaling_enabled']   = $settings['smart_scaling'];
		$settings['apply_shadow']            = ! empty($input['apply_shadow']);
		$settings['shadow_enabled']          = $settings['apply_shadow'];
		$settings['duplicate_detection']     = ! empty($input['duplicate_detection']);
		$settings['generate_seo_filename']   = ! empty($input['generate_seo_filename']);
		$settings['enable_filename_seo']     = $settings['generate_seo_filename'];
		$settings['generate_alt_text']       = ! empty($input['generate_alt_text']);
		$settings['enable_alt_text']         = $settings['generate_alt_text'];
		$settings['generate_image_title']    = ! empty($input['generate_image_title']);
		$settings['only_fill_missing_metadata'] = ! empty($input['only_fill_missing_metadata']);
		$settings['only_fill_missing']       = $settings['only_fill_missing_metadata'];
		$settings['overwrite_existing_metadata'] = ! empty($input['overwrite_existing_metadata']);
		$settings['overwrite_existing_meta'] = $settings['overwrite_existing_metadata'];
		$settings['retry_failed_jobs']       = ! empty($input['retry_failed_jobs']);
		$settings['pause_on_low_credits']    = ! empty($input['pause_on_low_credits']);
		$settings['pause_low_credits']       = $settings['pause_on_low_credits'];
		$settings['auto_refresh_job_status'] = ! empty($input['auto_refresh_job_status']);
		$settings['show_low_credit_warning'] = ! empty($input['show_low_credit_warning']);
		$settings['show_completion_alerts']  = ! empty($input['show_completion_alerts']);
		$settings['show_job_completion_alerts'] = $settings['show_completion_alerts'];
		$settings['show_failed_alerts']      = ! empty($input['show_failed_alerts']);
		$settings['show_failed_job_alerts']  = $settings['show_failed_alerts'];
		$settings['debug_mode']              = ! empty($input['debug_mode']);
		$settings['brand_keyword_suffix']    = isset($input['brand_keyword_suffix']) ? sanitize_text_field((string) $input['brand_keyword_suffix']) : '';
		$settings['seo_brand_suffix']        = $settings['brand_keyword_suffix'];
		$settings['generate_caption']        = ! empty($input['generate_caption']);
		$settings['generate_description']    = ! empty($input['generate_description']);
		$settings['background_source']       = $this->sanitize_background_source($input['background_source'] ?? $settings['background_source']);
		$settings['custom_background_attachment_id'] = isset($input['custom_background_attachment_id']) ? absint($input['custom_background_attachment_id']) : (int) ($settings['custom_background_attachment_id'] ?? 0);
		$settings['shadow_mode']             = $this->sanitize_shadow_mode($input['shadow_mode'] ?? $settings['shadow_mode']);
		$settings['shadow_strength']         = $this->sanitize_shadow_strength($input['shadow_strength'] ?? $settings['shadow_strength']);
		$settings['apply_shadow']            = 'off' !== $settings['shadow_mode'];
		$settings['shadow_enabled']          = $settings['apply_shadow'];
		$settings['shadow_opacity']          = $this->sanitize_int_range($input['shadow_opacity'] ?? $settings['shadow_opacity'], 0, 100, 23);
		$settings['shadow_blur']             = $this->sanitize_int_range($input['shadow_blur'] ?? $settings['shadow_blur'], 0, 80, 22);
		$settings['shadow_offset_x']         = $this->sanitize_int_range($input['shadow_offset_x'] ?? $settings['shadow_offset_x'], -300, 300, 0);
		$settings['shadow_offset_y']         = $this->sanitize_int_range($input['shadow_offset_y'] ?? $settings['shadow_offset_y'], -300, 300, 0);
		$settings['shadow_spread']           = $this->sanitize_int_range($input['shadow_spread'] ?? $settings['shadow_spread'], 25, 200, 100);
		$settings['shadow_softness']         = $this->sanitize_int_range($input['shadow_softness'] ?? $settings['shadow_softness'], 0, 100, 60);
		$settings['shadow_color']            = sanitize_hex_color((string) ($input['shadow_color'] ?? $settings['shadow_color'])) ?: '#000000';
		$settings['lighting_enabled']        = ! empty($input['lighting_enabled']);
		$settings['lighting_mode']           = $this->sanitize_lighting_mode($input['lighting_mode'] ?? $settings['lighting_mode']);
		$settings['brightness_correction']   = $this->sanitize_int_range($input['brightness_correction'] ?? $settings['brightness_correction'], -100, 100, 0);
		$settings['contrast_correction']     = $this->sanitize_int_range($input['contrast_correction'] ?? $settings['contrast_correction'], -100, 100, 0);
		$settings['highlight_recovery']      = ! empty($input['highlight_recovery']);
		$settings['shadow_lift']             = ! empty($input['shadow_lift']);
		$settings['neutralize_tint']         = ! empty($input['neutralize_tint']);
		$settings['lighting_strength']       = $this->sanitize_lighting_strength($input['lighting_strength'] ?? $settings['lighting_strength']);
		$settings['background_preset']       = $this->sanitize_background_preset($input['background_preset'] ?? $settings['background_preset']);
		$settings['background']              = $settings['background_preset'];
		$settings['default_scale_mode']      = $this->sanitize_scale_mode($input['default_scale_mode'] ?? $settings['default_scale_mode']);
		$settings['scale_mode']              = $settings['default_scale_mode'];
		$settings['scale_percent']           = $this->map_scale_mode_to_percent($settings['default_scale_mode']);
		$settings['framing_padding']         = $this->sanitize_int_range($input['framing_padding'] ?? $settings['framing_padding'], 0, 30, 3);
		$settings['preserve_transparent_edges'] = ! empty($input['preserve_transparent_edges']);
		$settings['batch_size']              = isset($input['batch_size']) ? max(1, min(50, absint($input['batch_size']))) : (int) $defaults['batch_size'];
		$settings['email_batch_complete']    = ! empty($input['email_batch_complete']);
		$settings['email_job_failed']        = ! empty($input['email_job_failed']);
		$settings['notification_email']      = isset($input['notification_email']) ? sanitize_email((string) $input['notification_email']) : '';

		if ($settings['only_fill_missing_metadata'] && $settings['overwrite_existing_metadata']) {
			$settings['overwrite_existing_metadata'] = false;
			$settings['overwrite_existing_meta'] = false;
		}

		$presets = isset($settings['category_presets']) && is_array($settings['category_presets']) ? $settings['category_presets'] : [];

		if (isset($input['category_preset_category'])) {
			$category_id = absint($input['category_preset_category']);
			if ($category_id > 0) {
				$presets[$category_id] = [
					'enabled'           => ! empty($input['category_preset_enabled']),
					'scale_mode'        => $this->sanitize_scale_mode($input['category_scale_mode'] ?? 'auto'),
					'background_preset' => $this->sanitize_background_preset($input['category_background_preset'] ?? 'optivra-default'),
					'background'        => $this->sanitize_background_preset($input['category_background_preset'] ?? 'optivra-default'),
					'background_source' => $this->sanitize_background_source($input['category_background_source'] ?? 'preset'),
					'shadow_strength'   => $this->sanitize_shadow_strength($input['category_shadow_strength'] ?? 'medium'),
				];
			}
		}

		$settings['category_presets'] = $presets;

		return $settings;
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
			$this->add_error(__('Connect your Optivra account before scanning or processing images.', 'optivra-image-studio-for-woocommerce'));
			return;
		}

		$this->save_posted_edge_overrides();

		if ('scan' === $action) {
			$result = $this->plugin->scanner()->scan($this->get_scan_filters_from_request());
			if ((int) $result['slots_found'] <= 0) {
				$this->add_error(__('No images found. Check product status/category filters or run with debug mode enabled.', 'optivra-image-studio-for-woocommerce'));
			} else {
				$this->add_success(
					sprintf(
						/* translators: 1: slots found, 2: jobs created/refreshed */
						__('Scan complete. Found %1$d images and refreshed %2$d jobs.', 'optivra-image-studio-for-woocommerce'),
						(int) $result['slots_found'],
						count((array) $result['job_ids'])
					)
				);
			}
			return;
		}

		if ('queue_visible' === $action || 'queue_category' === $action) {
			$result = $this->plugin->scanner()->scan($this->get_scan_filters_from_request());
			$this->plugin->jobs()->update_statuses((array) $result['job_ids'], 'queued');
			$this->add_success(sprintf(
				/* translators: %d: jobs queued */
				__('%d image(s) queued.', 'optivra-image-studio-for-woocommerce'),
				count((array) $result['job_ids'])
			));
			return;
		}

		if ('queue_selected_slots' === $action) {
			$job_ids = $this->queue_selected_slots();
			$this->plugin->jobs()->update_statuses($job_ids, 'queued');
			$this->add_success(sprintf(
				/* translators: %d: jobs queued */
				__('%d selected image(s) queued.', 'optivra-image-studio-for-woocommerce'),
				count($job_ids)
			));
			return;
		}

		if ('process_next_batch' === $action) {
			$settings = $this->plugin->get_settings();
			if (! empty($settings['pause_low_credits']) && $this->is_low_credit_state($usage)) {
				$this->add_error(__('Processing is paused because credits are running low. Buy credits or disable the pause setting to continue.', 'optivra-image-studio-for-woocommerce'));
				return;
			}

			$queued  = $this->plugin->jobs()->query(['status' => 'queued'], max(1, (int) ($settings['batch_size'] ?? 10)), 0);
			$job_ids = array_map('absint', wp_list_pluck($queued, 'id'));
			$action  = 'process';
		}

		if (empty($job_ids)) {
			$this->add_error('approve' === $action ? __('Select at least one image to approve.', 'optivra-image-studio-for-woocommerce') : __('Select at least one image.', 'optivra-image-studio-for-woocommerce'));
			return;
		}

		if ('process' === $action) {
			$credits_remaining = max(0, (int) ($usage['credits_remaining'] ?? 0));

			if ($credits_remaining < count($job_ids)) {
				$job_ids = array_slice($job_ids, 0, $credits_remaining);

				$this->add_error(__('Insufficient credits. Processing available images only; buy credits or upgrade plan to process the rest.', 'optivra-image-studio-for-woocommerce'));
			}

			if (empty($job_ids)) {
				$this->add_error(__('No credits available. Buy credits or upgrade plan to continue.', 'optivra-image-studio-for-woocommerce'));
				return;
			}
		}

		if ('cancel' === $action) {
			$updated = $this->plugin->jobs()->update_statuses($job_ids, 'unprocessed');
			$this->add_success(sprintf(
				/* translators: %d: jobs cancelled */
				__('%d image(s) removed from queue.', 'optivra-image-studio-for-woocommerce'),
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
			if ('approve' === $action) {
				$this->add_success(
					sprintf(
						/* translators: %d: approved images */
						_n('%d image approved and applied.', '%d images approved and applied.', $success, 'optivra-image-studio-for-woocommerce'),
						$success
					)
				);
				$success = 0;
			}
		}

		if ($success > 0) {
				$this->add_success(
					sprintf(
						/* translators: 1: action, 2: count */
						__('%1$s complete for %2$d image(s).', 'optivra-image-studio-for-woocommerce'),
					ucfirst(str_replace('_', ' ', $action)),
					$success
				)
			);
		}

		if ($failed > 0) {
			$this->add_error(
				sprintf(
					/* translators: %d: count */
					__('%d image action(s) failed.', 'optivra-image-studio-for-woocommerce'),
					$failed
				)
			);
		}
	}

	private function save_posted_seo_metadata(): void {
		// This helper is called only from handle_workflow_post(), after check_admin_referer() and manage_woocommerce checks.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by the calling admin action handler.
		if (empty($_POST['seo']) || ! is_array($_POST['seo'])) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by the calling admin action handler.
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

	private function save_posted_edge_overrides(): void {
		// This helper is called only from handle_workflow_post(), after check_admin_referer() and manage_woocommerce checks.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by the calling admin action handler.
		if (empty($_POST['edge_overrides']) || ! is_array($_POST['edge_overrides'])) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by the calling admin action handler.
		$posted = wp_unslash($_POST['edge_overrides']);
		$overrides = [];

		foreach ((array) $posted as $job_id => $override) {
			if (! is_array($override)) {
				continue;
			}

			$left    = ! empty($override['left']);
			$right   = ! empty($override['right']);
			$top     = ! empty($override['top']);
			$bottom  = ! empty($override['bottom']);

			$overrides[absint($job_id)] = [
				'enabled' => ! empty($override['enabled']) || $left || $right || $top || $bottom,
				'left'    => $left,
				'right'   => $right,
				'top'     => $top,
				'bottom'  => $bottom,
			];
		}

		$this->plugin->jobs()->update_edge_overrides($overrides);
	}

	/**
	 * @return array<string,mixed>
	 */
	private function get_scan_filters_from_request(): array {
		$settings = $this->plugin->get_settings();
		$include_featured_default = ! empty($settings['process_featured_images']);
		$include_gallery_default  = ! empty($settings['process_gallery_images']);
		$include_category_default = ! empty($settings['process_category_images']);
		// This helper is called only from handle_workflow_post(), after check_admin_referer() and manage_woocommerce checks.
		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$filters = [
			'category'         => isset($_POST['filter_category']) ? absint($_POST['filter_category']) : 0,
			'product_type'     => isset($_POST['filter_product_type']) ? sanitize_key(wp_unslash($_POST['filter_product_type'])) : '',
			'stock_status'     => isset($_POST['filter_stock_status']) ? sanitize_key(wp_unslash($_POST['filter_stock_status'])) : '',
			'include_category' => isset($_POST['filter_include_category']) ? true : $include_category_default,
			'include_featured' => isset($_POST['filter_image_gallery_only']) ? false : $include_featured_default,
			'include_gallery'  => isset($_POST['filter_image_featured_only']) ? false : $include_gallery_default,
		];

		$filters['status'] = ! empty($_POST['filter_product_status'])
			? sanitize_key(wp_unslash($_POST['filter_product_status']))
			: 'publish';
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		return $filters;
	}

	/**
	 * @return array<int,int>
	 */
	private function queue_selected_slots(): array {
		// This helper is called only from handle_workflow_post(), after check_admin_referer() and manage_woocommerce checks.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by the calling admin action handler.
		$slots   = isset($_POST['slots']) ? (array) wp_unslash($_POST['slots']) : [];
		$job_ids = [];
		$allowed_roles = ['featured', 'gallery', 'category'];

		foreach ($slots as $slot_value) {
			$parts = explode(':', sanitize_text_field((string) $slot_value));

			if (4 !== count($parts)) {
				continue;
			}

			$image_role = sanitize_key($parts[2]);

			if (! in_array($image_role, $allowed_roles, true)) {
				continue;
			}

			$job_ids[] = $this->plugin->jobs()->upsert_from_slot(
				[
					'product_id'    => absint($parts[0]),
					'attachment_id' => absint($parts[1]),
					'image_role'    => $image_role,
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
				return $this->plugin->processor()->process($job_id, $this->get_processing_options_for_job($job_id));
			case 'approve':
				return $this->plugin->approval()->approve($job_id);
			case 'regenerate_seo':
				return $this->regenerate_job_seo($job_id);
			case 'reject':
				return $this->plugin->approval()->reject($job_id);
			case 'revert':
				return $this->plugin->approval()->revert($job_id);
			default:
				return new WP_Error('catalogue_image_studio_unknown_action', __('Unknown action.', 'optivra-image-studio-for-woocommerce'));
		}
	}

	/**
	 * @return true|\WP_Error
	 */
	private function regenerate_job_seo(int $job_id) {
		$job = $this->plugin->jobs()->find($job_id);

		if (! $job) {
			return new WP_Error('catalogue_image_studio_missing_job', __('Job not found.', 'optivra-image-studio-for-woocommerce'));
		}

		$processed_url = (string) ($job['processed_url'] ?? '');
		$processed_filename = '' !== $processed_url ? (string) wp_basename((string) wp_parse_url($processed_url, PHP_URL_PATH)) : '';
		$original_filename = (string) wp_basename((string) get_attached_file((int) ($job['attachment_id'] ?? 0)));
		$seo = $this->plugin->seo_generator()->generate(
			(int) ($job['product_id'] ?? 0),
			(int) ($job['attachment_id'] ?? 0),
			(string) ($job['image_role'] ?? 'featured'),
			$original_filename,
			$processed_filename,
			$this->plugin->get_settings()
		);

		$this->plugin->jobs()->update(
			$job_id,
			[
				'seo_filename'    => $seo['filename'],
				'seo_alt_text'    => $seo['alt_text'],
				'seo_title'       => $seo['title'],
				'seo_caption'     => $seo['caption'],
				'seo_description' => $seo['description'],
			]
		);

		return true;
	}

	private function add_success(string $message): void {
		add_settings_error('catalogue_image_studio_messages', uniqid('catalogue_image_studio_', true), $message, 'success');
	}

	private function add_error(string $message): void {
		add_settings_error('catalogue_image_studio_messages', uniqid('catalogue_image_studio_', true), $message, 'error');
	}

	private function queue_notice(string $message, string $type = 'success'): void {
		$user_id = get_current_user_id();
		if ($user_id <= 0) {
			return;
		}

		$notices   = get_transient($this->get_notice_transient_key($user_id));
		$notices   = is_array($notices) ? $notices : [];
		$notices[] = [
			'message' => $message,
			'type'    => 'error' === $type ? 'error' : 'success',
		];

		set_transient($this->get_notice_transient_key($user_id), $notices, MINUTE_IN_SECONDS);
	}

	private function render_queued_notices(): void {
		$user_id = get_current_user_id();
		if ($user_id <= 0) {
			return;
		}

		$key     = $this->get_notice_transient_key($user_id);
		$notices = get_transient($key);
		delete_transient($key);

		if (! is_array($notices) || empty($notices)) {
			return;
		}

		foreach ($notices as $notice) {
			$type = ! empty($notice['type']) && 'error' === $notice['type'] ? 'notice-error' : 'notice-success';
			echo '<div class="notice ' . esc_attr($type) . ' is-dismissible"><p>' . esc_html((string) ($notice['message'] ?? '')) . '</p></div>';
		}
	}

	private function get_notice_transient_key(int $user_id): string {
		return 'catalogue_image_studio_notices_' . $user_id;
	}

	private function redirect_after_settings_post(): void {
		$target = admin_url('admin.php?page=optivra');
		// This helper is called only from handle_settings_post(), after check_admin_referer() and manage_woocommerce checks.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by the calling admin settings handler.
		if (! empty($_POST['catalogue_image_studio_full_settings'])) {
			$target = add_query_arg('cis_tab', 'settings', $target);
		}

		wp_safe_redirect($target);
		exit;
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 * @return array<string,mixed>
	 */
	private function sanitize_settings_for_debug_log(array $settings): array {
		$debug_settings = $settings;
		if (! empty($debug_settings['api_token'])) {
			$debug_settings['api_token'] = $this->mask_token((string) $debug_settings['api_token']);
		}

		return $debug_settings;
	}

	/**
	 * Render admin page.
	 *
	 * @return void
	 */
	public function render_page(): void {
		if (! current_user_can('manage_woocommerce')) {
			wp_die(esc_html__('You do not have permission to access this page.', 'optivra-image-studio-for-woocommerce'));
		}

		$settings = $this->plugin->get_settings();
		$usage    = $this->get_usage();
		$jobs     = $this->plugin->jobs()->query([], 100, 0);
		$connected = ! is_wp_error($usage);
		$tab       = $this->get_current_tab();
		?>
		<div class="wrap catalogue-image-studio-admin">
			<h1><?php echo esc_html__('Optivra Image Studio', 'optivra-image-studio-for-woocommerce'); ?></h1>
			<p class="catalogue-image-studio-page-intro"><?php echo esc_html__('Configure how Optivra optimises and writes product images back to your store.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php $this->render_queued_notices(); ?>
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
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only admin navigation parameter.
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
					<h2><?php echo esc_html__('Welcome to Optivra Image Studio', 'optivra-image-studio-for-woocommerce'); ?></h2>
					<?php $this->render_usage($usage); ?>
				</div>
				<div class="catalogue-image-studio-cta-buttons">
					<a class="button button-primary" href="<?php echo esc_url(add_query_arg(['page' => 'optivra', 'cis_tab' => 'scan'], admin_url('admin.php'))); ?>"><?php echo esc_html__('Scan Catalogue', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a class="button" href="<?php echo esc_url(add_query_arg(['page' => 'optivra', 'cis_tab' => 'review'], admin_url('admin.php'))); ?>"><?php echo esc_html__('Review Images', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_buy_credits_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Buy Credits', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_account_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Manage Account', 'optivra-image-studio-for-woocommerce'); ?></a>
				</div>
			</div>
			<div class="catalogue-image-studio-metrics">
				<?php
				$this->render_metric(__('Images scanned', 'optivra-image-studio-for-woocommerce'), $images_scanned);
				$this->render_metric(__('Queued', 'optivra-image-studio-for-woocommerce'), (int) ($counts['queued'] ?? 0));
				$this->render_metric(__('Processing', 'optivra-image-studio-for-woocommerce'), (int) ($counts['processing'] ?? 0));
				$this->render_metric(__('Completed', 'optivra-image-studio-for-woocommerce'), (int) ($counts['completed'] ?? 0));
				$this->render_metric(__('Failed', 'optivra-image-studio-for-woocommerce'), (int) ($counts['failed'] ?? 0));
				$this->render_metric(__('Awaiting approval', 'optivra-image-studio-for-woocommerce'), $awaiting_approval);
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
			<h2><?php echo esc_html__('Scan Catalogue', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<?php $this->render_scan_filters($filters); ?>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<?php $this->render_hidden_scan_filters($filters); ?>
				<div class="catalogue-image-studio-toolbar">
					<?php /* translators: %d: number of visible scanned images. */ ?>
					<strong><?php echo esc_html(sprintf(__('%d image(s) visible', 'optivra-image-studio-for-woocommerce'), count($slots))); ?></strong>
					<div class="catalogue-image-studio-cta-buttons">
						<button type="submit" name="catalogue_image_studio_action" value="scan" class="button"><?php echo esc_html__('Scan all product images', 'optivra-image-studio-for-woocommerce'); ?></button>
						<button type="submit" name="catalogue_image_studio_action" value="queue_selected_slots" class="button button-primary"><?php echo esc_html__('Queue selected', 'optivra-image-studio-for-woocommerce'); ?></button>
						<button type="submit" name="catalogue_image_studio_action" value="queue_visible" class="button"><?php echo esc_html__('Queue all visible', 'optivra-image-studio-for-woocommerce'); ?></button>
						<button type="submit" name="catalogue_image_studio_action" value="queue_category" class="button"><?php echo esc_html__('Queue category', 'optivra-image-studio-for-woocommerce'); ?></button>
					</div>
				</div>
				<table class="widefat fixed striped catalogue-image-studio-jobs">
					<thead><tr><td class="check-column"><input type="checkbox" class="catalogue-image-studio-check-all" onclick="document.querySelectorAll('.catalogue-image-studio-job-check').forEach((box) => box.checked = this.checked); catalogueImageStudioUpdateSelectedCount();" /></td><th><?php echo esc_html__('Image', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Product', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Slot', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></th></tr></thead>
					<tbody>
						<?php if (empty($slots)) : ?>
							<tr><td colspan="5"><?php echo esc_html__('No images found. Check product status/category filters or run with debug mode enabled.', 'optivra-image-studio-for-woocommerce'); ?></td></tr>
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
		$include_category_default = ! empty($settings['process_category_images']);
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Read-only filter controls for the scan screen.
		$filters = [
			'category'         => isset($_GET['filter_category']) ? absint($_GET['filter_category']) : 0,
			'product_type'     => isset($_GET['filter_product_type']) ? sanitize_key(wp_unslash($_GET['filter_product_type'])) : '',
			'stock_status'     => isset($_GET['filter_stock_status']) ? sanitize_key(wp_unslash($_GET['filter_stock_status'])) : '',
			'include_category' => isset($_GET['filter_include_category']) ? true : $include_category_default,
			'include_featured' => isset($_GET['filter_image_gallery_only']) ? false : $include_featured_default,
			'include_gallery'  => isset($_GET['filter_image_featured_only']) ? false : $include_gallery_default,
		];

		$filters['status'] = ! empty($_GET['filter_product_status'])
			? sanitize_key(wp_unslash($_GET['filter_product_status']))
			: 'publish';
		// phpcs:enable WordPress.Security.NonceVerification.Recommended

		return $filters;
	}

	private function render_scan_filters(array $filters): void {
		$categories = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
		$processing_state = $this->get_processing_state_filter();
		?>
		<form method="get" action="" class="catalogue-image-studio-filters">
			<input type="hidden" name="page" value="optivra" />
			<input type="hidden" name="cis_tab" value="scan" />
			<label><span><?php echo esc_html__('Category', 'optivra-image-studio-for-woocommerce'); ?></span><select name="filter_category"><option value="0"><?php echo esc_html__('All categories', 'optivra-image-studio-for-woocommerce'); ?></option><?php if (! is_wp_error($categories)) : foreach ($categories as $category) : ?><option value="<?php echo esc_attr((string) $category->term_id); ?>" <?php selected((int) ($filters['category'] ?? 0), (int) $category->term_id); ?>><?php echo esc_html($category->name); ?></option><?php endforeach; endif; ?></select></label>
			<label><span><?php echo esc_html__('Product status', 'optivra-image-studio-for-woocommerce'); ?></span><select name="filter_product_status"><option value="publish" <?php selected('publish', (string) ($filters['status'] ?? 'publish')); ?>><?php echo esc_html__('Published', 'optivra-image-studio-for-woocommerce'); ?></option><option value="draft" <?php selected('draft', (string) ($filters['status'] ?? 'publish')); ?>><?php echo esc_html__('Draft', 'optivra-image-studio-for-woocommerce'); ?></option><option value="private" <?php selected('private', (string) ($filters['status'] ?? 'publish')); ?>><?php echo esc_html__('Private', 'optivra-image-studio-for-woocommerce'); ?></option><option value="all" <?php selected('all', (string) ($filters['status'] ?? 'publish')); ?>><?php echo esc_html__('All', 'optivra-image-studio-for-woocommerce'); ?></option></select></label>
			<label><span><?php echo esc_html__('Product type', 'optivra-image-studio-for-woocommerce'); ?></span><select name="filter_product_type"><option value=""><?php echo esc_html__('All types', 'optivra-image-studio-for-woocommerce'); ?></option><option value="simple" <?php selected('simple', (string) ($filters['product_type'] ?? '')); ?>><?php echo esc_html__('Simple', 'optivra-image-studio-for-woocommerce'); ?></option><option value="variable" <?php selected('variable', (string) ($filters['product_type'] ?? '')); ?>><?php echo esc_html__('Variable', 'optivra-image-studio-for-woocommerce'); ?></option></select></label>
			<label><span><?php echo esc_html__('Processing state', 'optivra-image-studio-for-woocommerce'); ?></span><select name="filter_processing_state"><option value=""><?php echo esc_html__('All', 'optivra-image-studio-for-woocommerce'); ?></option><option value="unprocessed" <?php selected('unprocessed', $processing_state); ?>><?php echo esc_html__('Unprocessed', 'optivra-image-studio-for-woocommerce'); ?></option><option value="processed" <?php selected('processed', $processing_state); ?>><?php echo esc_html__('Already processed', 'optivra-image-studio-for-woocommerce'); ?></option></select></label>
			<label><span><?php echo esc_html__('Stock', 'optivra-image-studio-for-woocommerce'); ?></span><select name="filter_stock_status"><option value=""><?php echo esc_html__('Any stock status', 'optivra-image-studio-for-woocommerce'); ?></option><option value="instock" <?php selected('instock', (string) ($filters['stock_status'] ?? '')); ?>><?php echo esc_html__('In stock', 'optivra-image-studio-for-woocommerce'); ?></option><option value="outofstock" <?php selected('outofstock', (string) ($filters['stock_status'] ?? '')); ?>><?php echo esc_html__('Out of stock', 'optivra-image-studio-for-woocommerce'); ?></option></select></label>
			<label class="catalogue-image-studio-filter-check"><input type="checkbox" name="filter_image_featured_only" value="1" <?php checked($this->is_readonly_filter_enabled('filter_image_featured_only')); ?> /><span><?php echo esc_html__('Featured images only', 'optivra-image-studio-for-woocommerce'); ?></span></label>
			<label class="catalogue-image-studio-filter-check"><input type="checkbox" name="filter_image_gallery_only" value="1" <?php checked($this->is_readonly_filter_enabled('filter_image_gallery_only')); ?> /><span><?php echo esc_html__('Gallery images only', 'optivra-image-studio-for-woocommerce'); ?></span></label>
			<label class="catalogue-image-studio-filter-check"><input type="checkbox" name="filter_include_category" value="1" <?php checked(! empty($filters['include_category'])); ?> /><span><?php echo esc_html__('Include category images', 'optivra-image-studio-for-woocommerce'); ?></span></label>
			<div class="catalogue-image-studio-filter-actions"><button class="button button-primary"><?php echo esc_html__('Apply filters', 'optivra-image-studio-for-woocommerce'); ?></button></div>
		</form>
		<?php
	}

	private function render_hidden_scan_filters(array $filters): void {
		foreach (['category' => 'filter_category', 'product_type' => 'filter_product_type', 'stock_status' => 'filter_stock_status'] as $key => $name) {
			if (! empty($filters[$key])) {
				echo '<input type="hidden" name="' . esc_attr($name) . '" value="' . esc_attr((string) $filters[$key]) . '" />';
			}
		}

		echo '<input type="hidden" name="filter_product_status" value="' . esc_attr((string) ($filters['status'] ?? 'publish')) . '" />';

		$processing_state = $this->get_processing_state_filter();
		if ('' !== $processing_state) {
			echo '<input type="hidden" name="filter_processing_state" value="' . esc_attr($processing_state) . '" />';
		}

		if (! empty($filters['include_category'])) {
			echo '<input type="hidden" name="filter_include_category" value="1" />';
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
		$state = $this->get_processing_state_filter();

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

	private function get_processing_state_filter(): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only scan filter parameter.
		$state = isset($_GET['filter_processing_state']) ? sanitize_key(wp_unslash($_GET['filter_processing_state'])) : '';

		return in_array($state, ['processed', 'unprocessed'], true) ? $state : '';
	}

	private function is_readonly_filter_enabled(string $name): bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only scan filter parameter.
		return isset($_GET[$name]);
	}

	private function render_scan_slot_row(array $slot): void {
		$product_id    = (int) $slot['product_id'];
		$attachment_id = (int) $slot['attachment_id'];
		$value         = implode(':', [$product_id, $attachment_id, sanitize_key((string) $slot['image_role']), (int) $slot['gallery_index']]);
		$job           = $this->plugin->jobs()->find_by_slot($slot);
		$status        = $job ? $this->format_status((string) $job['status']) : __('Ready to queue', 'optivra-image-studio-for-woocommerce');
		$product_name  = ! empty($slot['product_name']) ? (string) $slot['product_name'] : get_the_title($product_id);
		$slot_label    = (string) $slot['image_role'];
		if ('gallery' === $slot_label) {
			$slot_label .= ' #' . ((int) $slot['gallery_index'] + 1);
		} elseif ('category' === $slot_label && ! empty($slot['category_name'])) {
			$slot_label .= ': ' . (string) $slot['category_name'];
		}
		?>
		<tr>
			<th scope="row" class="check-column"><input type="checkbox" class="catalogue-image-studio-job-check" name="slots[]" value="<?php echo esc_attr($value); ?>" /></th>
			<td><?php $this->render_thumbnail((string) ($slot['image_url'] ?? wp_get_attachment_image_url($attachment_id, 'thumbnail')), __('Product image', 'optivra-image-studio-for-woocommerce')); ?></td>
			<td><strong><?php echo esc_html($product_name); ?></strong><br /><a href="<?php echo esc_url(get_edit_post_link($product_id)); ?>"><?php echo esc_html__('Edit product', 'optivra-image-studio-for-woocommerce'); ?></a></td>
			<td><?php echo esc_html($slot_label); ?></td>
			<td><?php echo esc_html($status); ?></td>
		</tr>
		<?php
	}

	private function render_queue_tab(array $usage): void {
		$jobs = $this->plugin->jobs()->query(['status' => ['queued', 'processing', 'failed']], 100, 0);
		$settings = $this->plugin->get_settings();
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Queue', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<?php if (! empty($settings['show_low_credit_warning'])) : ?>
				<?php $this->render_monetisation_prompt($usage, max(0, (int) ($usage['credits_remaining'] ?? 0)), count($jobs), false); ?>
			<?php endif; ?>
			<?php if (! empty($settings['auto_refresh_job_status']) && ! empty($jobs)) : ?>
				<p class="catalogue-image-studio-help"><?php echo esc_html__('This queue refreshes automatically while jobs are active.', 'optivra-image-studio-for-woocommerce'); ?></p>
				<script>window.setTimeout(function () { window.location.reload(); }, 15000);</script>
			<?php endif; ?>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<div class="catalogue-image-studio-toolbar">
					<select name="catalogue_image_studio_action">
						<option value="process"><?php echo esc_html__('Process selected', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="process_next_batch"><?php echo esc_html__('Process next batch', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="retry"><?php echo esc_html__('Retry failed', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="cancel"><?php echo esc_html__('Cancel selected', 'optivra-image-studio-for-woocommerce'); ?></option>
					</select>
					<button type="submit" class="button button-primary"><?php echo esc_html__('Apply', 'optivra-image-studio-for-woocommerce'); ?></button>
				</div>
				<?php $this->render_jobs_table($jobs, true); ?>
			</form>
		</div>
		<?php
	}

	private function render_review_tab(): void {
		$jobs = $this->plugin->jobs()->query(['status' => ['completed', 'approved', 'rejected']], 100, 0);
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Optivra Image Studio — Review & Approve', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<div class="catalogue-image-studio-toolbar">
					<select name="catalogue_image_studio_action">
						<option value="approve"><?php echo esc_html__('Approve all selected', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="reject"><?php echo esc_html__('Reject selected', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="retry"><?php echo esc_html__('Retry selected', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="regenerate_seo"><?php echo esc_html__('Regenerate SEO selected', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="revert"><?php echo esc_html__('Revert selected', 'optivra-image-studio-for-woocommerce'); ?></option>
					</select>
					<button type="submit" class="button button-primary"><?php echo esc_html__('Apply', 'optivra-image-studio-for-woocommerce'); ?></button>
				</div>
				<?php $this->render_jobs_table($jobs, true); ?>
			</form>
		</div>
		<?php
	}

	private function render_settings_tab(array $settings, array $usage): void {
		$custom_background = $this->get_custom_background_preview($settings);
		?>
		<div class="optivra-settings-page">
			<div class="optivra-settings-header">
				<div>
					<h2><?php echo esc_html__('Optivra Image Studio Settings', 'optivra-image-studio-for-woocommerce'); ?></h2>
					<p><?php echo esc_html__('Configure how Optivra scans, processes, reviews and publishes product images.', 'optivra-image-studio-for-woocommerce'); ?></p>
				</div>
				<span class="optivra-status-pill <?php echo is_wp_error($usage) ? 'is-disconnected' : 'is-connected'; ?>"><?php echo is_wp_error($usage) ? esc_html__('Not connected', 'optivra-image-studio-for-woocommerce') : esc_html__('Connected', 'optivra-image-studio-for-woocommerce'); ?></span>
			</div>
			<?php if (! is_wp_error($usage)) : ?>
				<div class="optivra-summary-grid">
					<?php $this->render_summary_card(__('Plan', 'optivra-image-studio-for-woocommerce'), (string) ($usage['plan'] ?? __('Unknown', 'optivra-image-studio-for-woocommerce'))); ?>
					<?php $this->render_summary_card(__('Credits', 'optivra-image-studio-for-woocommerce'), (string) ((int) ($usage['credits_remaining'] ?? 0) . ' / ' . (int) ($usage['credits_total'] ?? 0))); ?>
					<?php $this->render_summary_card(__('Reset date', 'optivra-image-studio-for-woocommerce'), (string) ($usage['current_period_end'] ?? __('Not available', 'optivra-image-studio-for-woocommerce'))); ?>
				</div>
			<?php endif; ?>
			<form method="post" action="" class="optivra-settings-form">
				<?php settings_fields('catalogue_image_studio_settings_group'); ?>
				<?php wp_nonce_field('catalogue_image_studio_save_settings', 'catalogue_image_studio_settings_nonce'); ?>
				<input type="hidden" name="catalogue_image_studio_full_settings" value="1" />

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Connection', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Connect this store with the Site API Token from your Optivra account.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<div class="optivra-connection-grid">
						<div>
							<?php $this->render_text_setting('api_token', __('Site API Token', 'optivra-image-studio-for-woocommerce'), __('Leave this blank to keep the existing saved token.', 'optivra-image-studio-for-woocommerce'), '', 'password', ! empty($settings['api_token']) ? __('Token saved - leave blank to keep existing token', 'optivra-image-studio-for-woocommerce') : __('Paste your Site API Token', 'optivra-image-studio-for-woocommerce')); ?>
							<?php if (! empty($settings['api_token'])) : ?><p class="optivra-muted"><?php /* translators: %s: masked site API token. */ echo esc_html(sprintf(__('Saved token: %s', 'optivra-image-studio-for-woocommerce'), $this->mask_token((string) $settings['api_token']))); ?></p><?php endif; ?>
							<div class="optivra-button-row">
								<button type="submit" name="connect_store" value="1" class="button button-primary"><?php echo esc_html__('Connect', 'optivra-image-studio-for-woocommerce'); ?></button>
								<button type="submit" name="test_connection" value="1" class="button"><?php echo esc_html__('Test connection', 'optivra-image-studio-for-woocommerce'); ?></button>
								<?php if (! empty($settings['api_token'])) : ?><button type="submit" name="disconnect_store" value="1" class="button optivra-danger-button"><?php echo esc_html__('Disconnect', 'optivra-image-studio-for-woocommerce'); ?></button><?php endif; ?>
							</div>
							<div class="optivra-link-row">
								<a href="<?php echo esc_url($this->get_sites_url(is_array($usage) ? $usage : [], $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Get API token', 'optivra-image-studio-for-woocommerce'); ?></a>
								<a href="<?php echo esc_url(trailingslashit((string) $this->get_app_base_url($usage, $settings)) . 'signup'); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Create an Optivra account', 'optivra-image-studio-for-woocommerce'); ?></a>
							</div>
						</div>
						<div class="optivra-status-panel"><?php $this->render_connection_status($usage, ! is_wp_error($usage)); ?></div>
					</div>
				</section>

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Processing Defaults', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Choose the default scan, queue and publish behaviour for product images.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_toggle_setting('require_approval', __('Require review before replacing images', 'optivra-image-studio-for-woocommerce'), __('Processed images wait for approval before WooCommerce product images are replaced.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['require_approval'])); ?>
					<?php $this->render_toggle_setting('auto_process_new_images', __('Auto-process newly scanned images', 'optivra-image-studio-for-woocommerce'), __('Newly discovered images can be queued for processing automatically.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_process_new_images'])); ?>
					<?php $this->render_toggle_setting('process_featured_images', __('Include featured/product images', 'optivra-image-studio-for-woocommerce'), __('Scan and queue main product images by default.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['process_featured_images'])); ?>
					<?php $this->render_toggle_setting('process_gallery_images', __('Include gallery images', 'optivra-image-studio-for-woocommerce'), __('Scan and queue WooCommerce gallery images by default.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['process_gallery_images'])); ?>
					<?php $this->render_toggle_setting('process_category_images', __('Include category thumbnail images', 'optivra-image-studio-for-woocommerce'), __('Allow scans to include product category thumbnails when selected.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['process_category_images'])); ?>
					<?php $this->render_toggle_setting('duplicate_detection', __('Duplicate detection', 'optivra-image-studio-for-woocommerce'), __('Reuse previous processed results when the same source image is encountered.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['duplicate_detection'])); ?>
					<?php $this->render_toggle_setting('pause_on_low_credits', __('Pause processing when credits are low', 'optivra-image-studio-for-woocommerce'), __('Stop larger queue batches before credits are exhausted.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['pause_on_low_credits'])); ?>
					<?php $this->render_toggle_setting('retry_failed_jobs', __('Retry failed jobs automatically', 'optivra-image-studio-for-woocommerce'), __('Keep failed jobs ready for a quick retry pass.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['retry_failed_jobs'])); ?>
					<?php $this->render_toggle_setting('auto_refresh_job_status', __('Auto-refresh job status', 'optivra-image-studio-for-woocommerce'), __('Refresh queue status while jobs are active.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_refresh_job_status'])); ?>
					<?php $this->render_number_setting('batch_size', __('Batch size', 'optivra-image-studio-for-woocommerce'), __('How many queued images to process at once.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['batch_size'] ?? 10), 1, 50); ?>
				</section>

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Background', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Choose an Optivra preset or upload a brand background from the Media Library.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_select_setting('background_source', __('Background source', 'optivra-image-studio-for-woocommerce'), __('Use an Optivra preset or your own uploaded background image.', 'optivra-image-studio-for-woocommerce'), ['preset' => __('Optivra preset', 'optivra-image-studio-for-woocommerce'), 'custom' => __('Custom uploaded background', 'optivra-image-studio-for-woocommerce')], (string) ($settings['background_source'] ?? 'preset')); ?>
					<?php $this->render_select_setting('background_preset', __('Background preset', 'optivra-image-studio-for-woocommerce'), __('Default background style when using Optivra presets.', 'optivra-image-studio-for-woocommerce'), $this->get_background_presets(), (string) ($settings['background_preset'] ?? 'optivra-default')); ?>
					<div class="optivra-setting-row">
						<div><strong class="optivra-setting-label"><?php echo esc_html__('Custom background upload', 'optivra-image-studio-for-woocommerce'); ?></strong><p class="optivra-setting-description"><?php echo esc_html__('Preview stays contained here; the full image is never rendered in the admin screen.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
						<div class="optivra-setting-control">
							<input type="hidden" id="catalogue-image-studio-custom-background-id" name="custom_background_attachment_id" value="<?php echo esc_attr((string) ($settings['custom_background_attachment_id'] ?? 0)); ?>" />
							<div class="optivra-button-row"><button type="button" class="button" id="catalogue-image-studio-pick-background"><?php echo esc_html__('Choose background', 'optivra-image-studio-for-woocommerce'); ?></button><button type="button" class="button" id="catalogue-image-studio-remove-background"><?php echo esc_html__('Remove background', 'optivra-image-studio-for-woocommerce'); ?></button></div>
							<div class="optivra-preview-card">
								<img id="catalogue-image-studio-custom-background-preview" class="optivra-background-preview catalogue-image-studio-background-preview" src="<?php echo esc_url((string) ($custom_background['url'] ?? '')); ?>" alt="" <?php echo empty($custom_background['url']) ? 'hidden' : ''; ?> />
								<small id="catalogue-image-studio-custom-background-filename" <?php echo empty($custom_background['filename']) ? 'hidden' : ''; ?>><?php echo ! empty($custom_background['filename']) ? esc_html($custom_background['filename']) : ''; ?></small>
							</div>
						</div>
					</div>
				</section>

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Framing', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Global framing defaults. Image-to-edge is controlled per queued image.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_select_setting('default_scale_mode', __('Default image framing', 'optivra-image-studio-for-woocommerce'), __('Choose the default amount of space around the product.', 'optivra-image-studio-for-woocommerce'), $this->get_scale_modes(), (string) ($settings['default_scale_mode'] ?? 'auto')); ?>
					<?php $this->render_toggle_setting('smart_scaling', __('Smart product framing', 'optivra-image-studio-for-woocommerce'), __('Let Optivra keep products comfortably framed without clipping.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['smart_scaling'])); ?>
					<?php $this->render_number_setting('framing_padding', __('Product padding / safe margin', 'optivra-image-studio-for-woocommerce'), __('Default safe margin around products, expressed as a percentage.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['framing_padding'] ?? 8), 0, 30); ?>
					<?php $this->render_toggle_setting('preserve_transparent_edges', __('Preserve transparent product edges', 'optivra-image-studio-for-woocommerce'), __('Avoid trimming subtle transparent edges unless a job override says otherwise.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['preserve_transparent_edges'])); ?>
				</section>

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Shadow', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Control the product shadow style used during processing.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_select_setting('shadow_mode', __('Shadow mode', 'optivra-image-studio-for-woocommerce'), __('Off disables shadow entirely. Under product creates a contact shadow; behind product adds depth.', 'optivra-image-studio-for-woocommerce'), $this->get_shadow_modes(), (string) ($settings['shadow_mode'] ?? 'under')); ?>
					<?php $this->render_select_setting('shadow_strength', __('Shadow strength', 'optivra-image-studio-for-woocommerce'), __('Preset shadow intensity.', 'optivra-image-studio-for-woocommerce'), $this->get_shadow_strengths(), (string) ($settings['shadow_strength'] ?? 'medium')); ?>
					<details class="optivra-subdetails"><summary><?php echo esc_html__('Advanced shadow settings', 'optivra-image-studio-for-woocommerce'); ?></summary>
						<?php $this->render_range_setting('shadow_opacity', __('Shadow opacity', 'optivra-image-studio-for-woocommerce'), __('Opacity percentage for custom shadows.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['shadow_opacity'] ?? 23), 0, 100); ?>
						<?php $this->render_range_setting('shadow_blur', __('Shadow blur', 'optivra-image-studio-for-woocommerce'), __('Blur radius for soft edges.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['shadow_blur'] ?? 22), 0, 80); ?>
						<?php $this->render_number_setting('shadow_offset_x', __('Shadow offset X', 'optivra-image-studio-for-woocommerce'), __('Horizontal shadow offset in pixels.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['shadow_offset_x'] ?? 0), -300, 300); ?>
						<?php $this->render_number_setting('shadow_offset_y', __('Shadow offset Y', 'optivra-image-studio-for-woocommerce'), __('Vertical shadow offset in pixels.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['shadow_offset_y'] ?? 0), -300, 300); ?>
						<?php $this->render_range_setting('shadow_spread', __('Shadow spread / scale', 'optivra-image-studio-for-woocommerce'), __('Relative spread percentage for the shadow.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['shadow_spread'] ?? 100), 25, 200); ?>
						<?php $this->render_range_setting('shadow_softness', __('Shadow softness', 'optivra-image-studio-for-woocommerce'), __('Extra softness applied to shadow edges.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['shadow_softness'] ?? 60), 0, 100); ?>
						<?php $this->render_text_setting('shadow_color', __('Shadow colour', 'optivra-image-studio-for-woocommerce'), __('Default is black.', 'optivra-image-studio-for-woocommerce'), (string) ($settings['shadow_color'] ?? '#000000'), 'color'); ?>
					</details>
				</section>

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Lighting Enhancement', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Improve product lighting before the final image is saved.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_toggle_setting('lighting_enabled', __('Enable lighting enhancement', 'optivra-image-studio-for-woocommerce'), __('Apply lighting correction during processing.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['lighting_enabled'])); ?>
					<?php $this->render_select_setting('lighting_mode', __('Enhancement mode', 'optivra-image-studio-for-woocommerce'), __('Choose whether lighting corrections target the product or full image.', 'optivra-image-studio-for-woocommerce'), $this->get_lighting_modes(), (string) ($settings['lighting_mode'] ?? 'auto')); ?>
					<?php $this->render_range_setting('brightness_correction', __('Brightness correction', 'optivra-image-studio-for-woocommerce'), __('Adjust brightness from -100 to 100.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['brightness_correction'] ?? 0), -100, 100); ?>
					<?php $this->render_range_setting('contrast_correction', __('Contrast correction', 'optivra-image-studio-for-woocommerce'), __('Adjust contrast from -100 to 100.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['contrast_correction'] ?? 0), -100, 100); ?>
					<?php $this->render_toggle_setting('highlight_recovery', __('Highlight recovery', 'optivra-image-studio-for-woocommerce'), __('Reduce harsh highlights where possible.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['highlight_recovery'])); ?>
					<?php $this->render_toggle_setting('shadow_lift', __('Shadow lift', 'optivra-image-studio-for-woocommerce'), __('Recover detail in dark product areas.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['shadow_lift'])); ?>
					<?php $this->render_toggle_setting('neutralize_tint', __('Colour balance / neutralise tint', 'optivra-image-studio-for-woocommerce'), __('Balance colour casts for more natural product colour.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['neutralize_tint'])); ?>
					<?php $this->render_select_setting('lighting_strength', __('Strength', 'optivra-image-studio-for-woocommerce'), __('Overall lighting enhancement strength.', 'optivra-image-studio-for-woocommerce'), $this->get_lighting_strengths(), (string) ($settings['lighting_strength'] ?? 'medium')); ?>
				</section>

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('SEO Metadata', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Control generated filenames and attachment metadata.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_toggle_setting('generate_seo_filename', __('Generate SEO filename', 'optivra-image-studio-for-woocommerce'), __('Rename processed files to cleaner, search-friendly filenames.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_seo_filename'])); ?>
					<?php $this->render_toggle_setting('generate_alt_text', __('Generate alt text', 'optivra-image-studio-for-woocommerce'), __('Fill image alt text suggestions automatically.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_alt_text'])); ?>
					<?php $this->render_toggle_setting('generate_image_title', __('Generate image title', 'optivra-image-studio-for-woocommerce'), __('Fill the WordPress media title with the suggested image title.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_image_title'])); ?>
					<?php $this->render_toggle_setting('generate_caption', __('Generate caption', 'optivra-image-studio-for-woocommerce'), __('Generate an attachment caption when available.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_caption'])); ?>
					<?php $this->render_toggle_setting('generate_description', __('Generate description', 'optivra-image-studio-for-woocommerce'), __('Generate an attachment description when available.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_description'])); ?>
					<?php $this->render_toggle_setting('only_fill_missing_metadata', __('Only fill missing metadata', 'optivra-image-studio-for-woocommerce'), __('Leave existing attachment metadata alone unless a field is blank.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['only_fill_missing_metadata'])); ?>
					<?php $this->render_toggle_setting('overwrite_existing_metadata', __('Override existing metadata', 'optivra-image-studio-for-woocommerce'), __('Allow generated metadata to replace existing values. This cannot be combined with only-fill-missing.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['overwrite_existing_metadata'])); ?>
					<?php $this->render_text_setting('brand_keyword_suffix', __('Brand keyword suffix', 'optivra-image-studio-for-woocommerce'), __('Optional brand or collection term to append to generated SEO suggestions.', 'optivra-image-studio-for-woocommerce'), (string) ($settings['brand_keyword_suffix'] ?? '')); ?>
					<?php $this->render_seo_preview_example($settings); ?>
				</section>

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Notifications', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Choose how Optivra reports completed and failed work.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_toggle_setting('show_completion_alerts', __('Show admin notices for completed batches', 'optivra-image-studio-for-woocommerce'), __('Display success notices after processing or approval actions complete.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['show_completion_alerts'])); ?>
					<?php $this->render_toggle_setting('show_failed_alerts', __('Show admin notices for failed jobs', 'optivra-image-studio-for-woocommerce'), __('Display failure notices when the API or processing workflow returns an error.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['show_failed_alerts'])); ?>
					<?php $this->render_toggle_setting('email_batch_complete', __('Email admin when batch completes', 'optivra-image-studio-for-woocommerce'), __('Send an email when a processing batch finishes.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['email_batch_complete'])); ?>
					<?php $this->render_toggle_setting('email_job_failed', __('Email admin when job fails', 'optivra-image-studio-for-woocommerce'), __('Send an email when an image job fails.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['email_job_failed'])); ?>
					<?php $this->render_text_setting('notification_email', __('Notification email address', 'optivra-image-studio-for-woocommerce'), __('Optional. Defaults to the WordPress admin email if left blank.', 'optivra-image-studio-for-woocommerce'), (string) ($settings['notification_email'] ?? ''), 'email'); ?>
				</section>

				<?php $this->render_advanced_settings($settings); ?>
				<div class="optivra-save-bar"><button type="submit" class="button button-primary"><?php echo esc_html__('Save Settings', 'optivra-image-studio-for-woocommerce'); ?></button></div>
			</form>
		</div>
		<?php
	}

	private function render_logs_tab(): void {
		$failed = $this->plugin->jobs()->query(['status' => 'failed'], 50, 0);
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Optivra Image Studio Diagnostics', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<div class="catalogue-image-studio-log-grid">
				<section><h3><?php echo esc_html__('Connection logs', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Connection attempts are recorded in WooCommerce logs under source catalogue-image-studio. Secrets are never written to logs.', 'optivra-image-studio-for-woocommerce'); ?></p></section>
				<section><h3><?php echo esc_html__('Job logs', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Recent failed job messages appear below. Full job events are available in WooCommerce logs.', 'optivra-image-studio-for-woocommerce'); ?></p></section>
			</div>
			<button type="button" class="button" onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('catalogue-image-studio-diagnostics').textContent);"><?php echo esc_html__('Copy support diagnostics', 'optivra-image-studio-for-woocommerce'); ?></button>
			<pre id="catalogue-image-studio-diagnostics"><?php echo esc_html(wp_json_encode(['plugin' => CIS_VERSION, 'site' => home_url(), 'php' => PHP_VERSION], JSON_PRETTY_PRINT)); ?></pre>
			<?php $this->render_jobs_table($failed, false); ?>
		</div>
		<?php
	}

	private function render_jobs_table(array $jobs, bool $selectable): void {
		$empty_message = $selectable
			? __('Run your first scan to find WooCommerce product images.', 'optivra-image-studio-for-woocommerce')
			: __('No failed jobs to show.', 'optivra-image-studio-for-woocommerce');
		?>
		<table class="widefat fixed striped catalogue-image-studio-jobs">
			<thead>
				<tr>
					<?php if ($selectable) : ?><td class="check-column"><input type="checkbox" class="catalogue-image-studio-check-all" onclick="document.querySelectorAll('.catalogue-image-studio-job-check').forEach((box) => box.checked = this.checked); catalogueImageStudioUpdateSelectedCount();" /></td><?php endif; ?>
					<th><?php echo esc_html__('Product', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Before', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('After', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Slot', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('SEO filename / alt preview', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Progress / message', 'optivra-image-studio-for-woocommerce'); ?></th>
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
			'dashboard' => __('Dashboard', 'optivra-image-studio-for-woocommerce'),
			'scan'      => __('Scan Catalogue', 'optivra-image-studio-for-woocommerce'),
			'queue'     => __('Queue', 'optivra-image-studio-for-woocommerce'),
			'review'    => __('Review & Approve', 'optivra-image-studio-for-woocommerce'),
			'settings'  => __('Settings', 'optivra-image-studio-for-woocommerce'),
			'logs'      => __('Logs', 'optivra-image-studio-for-woocommerce'),
		];
		?>
		<nav class="nav-tab-wrapper catalogue-image-studio-tabs">
			<?php foreach ($tabs as $tab => $label) : ?>
				<a class="nav-tab <?php echo $tab === $active_tab ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url(add_query_arg(['page' => 'optivra', 'cis_tab' => $tab], admin_url('admin.php'))); ?>">
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
			return new WP_Error('catalogue_image_studio_not_connected', __('Not connected.', 'optivra-image-studio-for-woocommerce'));
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
		?>
		<div class="catalogue-image-studio-panel catalogue-image-studio-onboarding">
			<div class="catalogue-image-studio-step">1</div>
			<h2><?php echo esc_html__('Connect your WooCommerce store to Optivra Image Studio', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<p><?php echo esc_html__('Paste your Site API Token from your Optivra account to connect this store.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php $this->render_external_service_disclosure(); ?>
			<?php $this->render_connection_form($settings, $usage, false, true); ?>
		</div>
		<?php
	}

	private function render_external_service_disclosure(): void {
		?>
		<div class="catalogue-image-studio-disclosure">
			<strong><?php echo esc_html__('External service disclosure', 'optivra-image-studio-for-woocommerce'); ?></strong>
			<p><?php echo esc_html__('Optivra Image Studio connects your WooCommerce store to Optivra\'s external image processing service. When you scan or process images, selected product image data, image URLs, product names, categories, and related metadata may be sent to Optivra for image background replacement, optimisation, review workflow support, and SEO metadata generation. An Optivra account and Site API Token are required.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<p><?php echo esc_html__('No product or image data is sent until you connect your Site API Token and intentionally start scanning or processing. Image processing uses credits from your Optivra account.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<div class="catalogue-image-studio-link-row">
				<a href="<?php echo esc_url('https://www.optivra.app'); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Service: Optivra Image Studio', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="<?php echo esc_url(CIS_TERMS_URL); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Terms of Service', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="<?php echo esc_url(CIS_PRIVACY_URL); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Privacy Policy', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="<?php echo esc_url(CIS_DATA_URL); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Data Processing', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="<?php echo esc_url(CIS_SUPPORT_URL); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Support', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="<?php echo esc_url('mailto:' . CIS_SUPPORT_EMAIL); ?>"><?php echo esc_html(CIS_SUPPORT_EMAIL); ?></a>
			</div>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed>|\WP_Error $usage Usage.
	 * @return void
	 */
	private function render_advanced_settings(array $settings): void {
		?>
		<details class="catalogue-image-studio-advanced optivra-card">
			<summary><?php echo esc_html__('Advanced (for support / development only)', 'optivra-image-studio-for-woocommerce'); ?></summary>
			<p class="catalogue-image-studio-warning"><?php echo esc_html__('These settings are for development/support use only. Most users should not change them.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php $this->render_text_setting('api_base_url_override', __('API Base URL override', 'optivra-image-studio-for-woocommerce'), __('Only change this when support asks you to point the plugin at a different Optivra API.', 'optivra-image-studio-for-woocommerce'), (string) ($settings['api_base_url_override'] ?? ''), 'url'); ?>
			<?php $this->render_toggle_setting('debug_mode', __('Debug mode', 'optivra-image-studio-for-woocommerce'), __('Enable detailed logging for support and troubleshooting.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['debug_mode'])); ?>
			<div class="optivra-button-row">
				<button type="submit" name="clear_local_cache" value="1" class="button"><?php echo esc_html__('Clear local cache', 'optivra-image-studio-for-woocommerce'); ?></button>
				<button type="submit" name="reset_local_data" value="1" class="button optivra-danger-button"><?php echo esc_html__('Reset plugin local data', 'optivra-image-studio-for-woocommerce'); ?></button>
			</div>
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
				<strong><?php echo esc_html__('Not connected', 'optivra-image-studio-for-woocommerce'); ?></strong>
				<p><?php echo esc_html__('Connect your Optivra account to view credits and process images.', 'optivra-image-studio-for-woocommerce'); ?></p>
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
				<strong><?php echo esc_html__('Not connected', 'optivra-image-studio-for-woocommerce'); ?></strong>
				<p><?php echo esc_html__('Connect your Optivra account to view credits and process images.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>
			<?php
			return;
		}

		?>
		<div class="catalogue-image-studio-status-card catalogue-image-studio-status-card-connected">
			<strong><?php echo esc_html__('Connected', 'optivra-image-studio-for-woocommerce'); ?></strong>
			<?php if (! empty($usage['domain']) && is_string($usage['domain'])) : ?>
				<p><?php /* translators: %s: connected store domain. */ echo esc_html(sprintf(__('Connected domain: %s', 'optivra-image-studio-for-woocommerce'), $usage['domain'])); ?></p>
			<?php endif; ?>
		</div>
		<div class="catalogue-image-studio-usage">
			<div>
				<span><?php echo esc_html__('Plan', 'optivra-image-studio-for-woocommerce'); ?></span>
				<strong><?php echo esc_html(ucfirst((string) ($usage['plan'] ?? 'unknown'))); ?></strong>
			</div>
			<div>
				<span><?php echo esc_html__('Credits', 'optivra-image-studio-for-woocommerce'); ?></span>
				<strong><?php echo esc_html((string) ($usage['credits_remaining'] ?? 0)); ?> / <?php echo esc_html((string) ($usage['credits_total'] ?? 0)); ?></strong>
			</div>
			<div>
				<span><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></span>
				<strong><?php echo esc_html(ucfirst((string) ($usage['subscription_status'] ?? 'unknown'))); ?></strong>
			</div>
			<div>
				<span><?php echo esc_html__('Reset date', 'optivra-image-studio-for-woocommerce'); ?></span>
				<strong>
					<?php
					$period_end = isset($usage['current_period_end']) ? $usage['current_period_end'] : ($usage['next_reset_at'] ?? null);
					$period_ts  = is_string($period_end) ? strtotime($period_end) : false;
					echo esc_html($period_ts ? date_i18n(get_option('date_format'), $period_ts) : __('Unavailable', 'optivra-image-studio-for-woocommerce'));
					?>
				</strong>
			</div>
		</div>
		<?php
		$remaining = max(0, (int) ($usage['credits_remaining'] ?? 0));
		$total     = max(0, (int) ($usage['credits_total'] ?? 0));
		$percent   = $total > 0 ? min(100, max(0, round(($remaining / $total) * 100))) : 0;
		?>
		<div class="catalogue-image-studio-credit-meter" aria-label="<?php echo esc_attr__('Credits remaining', 'optivra-image-studio-for-woocommerce'); ?>">
			<div style="width: <?php echo esc_attr((string) $percent); ?>%;"></div>
		</div>
		<p class="catalogue-image-studio-muted">
			<?php
			$next_reset = isset($usage['next_reset_at']) && is_string($usage['next_reset_at']) ? strtotime($usage['next_reset_at']) : false;
			echo esc_html(
				$next_reset
					? sprintf(
						/* translators: %s: reset date */
						__('Next reset: %s', 'optivra-image-studio-for-woocommerce'),
						date_i18n(get_option('date_format'), $next_reset)
					)
					: __('Next reset date unavailable.', 'optivra-image-studio-for-woocommerce')
			);
			?>
		</p>
		<div class="catalogue-image-studio-cta-buttons">
			<a class="button button-primary" href="<?php echo esc_url($this->get_upgrade_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Upgrade plan', 'optivra-image-studio-for-woocommerce'); ?></a>
			<a class="button" href="<?php echo esc_url($this->get_upgrade_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Manage billing', 'optivra-image-studio-for-woocommerce'); ?></a>
		</div>
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
				<div class="catalogue-image-studio-workflow-step <?php echo $connected ? 'catalogue-image-studio-workflow-step-complete' : ''; ?>"><span>1</span><?php echo esc_html__('Connect', 'optivra-image-studio-for-woocommerce'); ?></div>
				<div class="catalogue-image-studio-workflow-step"><span>2</span><?php echo esc_html__('Scan', 'optivra-image-studio-for-woocommerce'); ?></div>
				<div class="catalogue-image-studio-workflow-step"><span>3</span><?php echo esc_html__('Optimise', 'optivra-image-studio-for-woocommerce'); ?></div>
				<div class="catalogue-image-studio-workflow-step"><span>4</span><?php echo esc_html__('Review & approve', 'optivra-image-studio-for-woocommerce'); ?></div>
			</div>
			<div class="catalogue-image-studio-toolbar">
				<h2><?php echo esc_html__('Images', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<form method="post" action="">
					<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
					<input type="hidden" name="catalogue_image_studio_action" value="scan" />
					<button type="submit" class="button" <?php disabled(! $connected); ?>><?php echo esc_html__('Scan Product Images', 'optivra-image-studio-for-woocommerce'); ?></button>
				</form>
			</div>

			<?php if (! $connected) : ?>
				<div class="catalogue-image-studio-empty-state">
					<?php echo esc_html__('Connect your Optivra account, then scan your product catalogue to find images ready for optimisation.', 'optivra-image-studio-for-woocommerce'); ?>
				</div>
			<?php else : ?>
				<?php $this->render_monetisation_prompt($usage, $credits_remaining, $processable_count, $insufficient); ?>
			<?php endif; ?>

			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<div class="tablenav top">
					<div class="alignleft actions">
						<select name="catalogue_image_studio_action" <?php disabled(! $connected); ?>>
							<option value="process"><?php echo esc_html__('Process selected', 'optivra-image-studio-for-woocommerce'); ?></option>
							<option value="approve"><?php echo esc_html__('Approve selected', 'optivra-image-studio-for-woocommerce'); ?></option>
							<option value="reject"><?php echo esc_html__('Reject selected', 'optivra-image-studio-for-woocommerce'); ?></option>
							<option value="revert"><?php echo esc_html__('Revert selected', 'optivra-image-studio-for-woocommerce'); ?></option>
						</select>
						<button type="submit" class="button button-primary" <?php disabled(! $connected); ?>><?php echo esc_html__('Apply', 'optivra-image-studio-for-woocommerce'); ?></button>
					</div>
				</div>

				<?php if ($connected) : ?>
					<table class="widefat fixed striped catalogue-image-studio-jobs">
						<thead>
							<tr>
								<td class="check-column"><input type="checkbox" class="catalogue-image-studio-check-all" onclick="document.querySelectorAll('.catalogue-image-studio-job-check').forEach((box) => box.checked = this.checked); catalogueImageStudioUpdateSelectedCount();" /></td>
								<th><?php echo esc_html__('Product', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Before', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('After', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Slot', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('SEO', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Updated', 'optivra-image-studio-for-woocommerce'); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php if (empty($jobs)) : ?>
								<tr><td colspan="8"><?php echo esc_html__('Run your first scan to find WooCommerce product images.', 'optivra-image-studio-for-woocommerce'); ?></td></tr>
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
							__('You have %d images left to optimise.', 'optivra-image-studio-for-woocommerce'),
							$credits_remaining
						)
					);
					?>
				</strong>
				<p>
					<?php echo esc_html__('Selected:', 'optivra-image-studio-for-woocommerce'); ?>
					<span data-cis-selected-count>0</span>
					<?php echo esc_html__('image(s). Available credits:', 'optivra-image-studio-for-woocommerce'); ?>
					<?php echo esc_html((string) $credits_remaining); ?>.
				</p>
				<?php if ($insufficient) : ?>
					<p><?php echo esc_html(sprintf(
						/* translators: %d: processable images */
						__('Process %d now, then buy credits or upgrade plan. Upgrade to process your full catalogue.', 'optivra-image-studio-for-woocommerce'),
						$available_now
					)); ?></p>
				<?php else : ?>
					<p><?php echo esc_html__('Upgrade to process your full catalogue.', 'optivra-image-studio-for-woocommerce'); ?></p>
				<?php endif; ?>
			</div>
			<div class="catalogue-image-studio-cta-buttons">
				<a class="button button-primary" href="<?php echo esc_url($this->get_upgrade_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Upgrade plan', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a class="button" href="<?php echo esc_url($this->get_buy_credits_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Buy credits', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a class="button" href="<?php echo esc_url($this->get_account_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Manage account', 'optivra-image-studio-for-woocommerce'); ?></a>
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

	private function render_connection_form(array $settings, $usage, bool $show_status_inline = true, bool $wrap_form = true): void {
		$connected = ! is_wp_error($usage);
		?>
		<div class="catalogue-image-studio-connection-card">
			<?php if ($wrap_form) : ?><form method="post" action="" class="catalogue-image-studio-connection-form"><?php else : ?><div class="catalogue-image-studio-connection-form"><?php endif; ?>
				<?php if ($wrap_form) : ?>
					<?php settings_fields('catalogue_image_studio_settings_group'); ?>
					<?php wp_nonce_field('catalogue_image_studio_save_settings', 'catalogue_image_studio_settings_nonce'); ?>
				<?php endif; ?>
				<label class="catalogue-image-studio-token-field" for="catalogue-image-studio-api-token">
					<span><?php echo esc_html__('Site API Token', 'optivra-image-studio-for-woocommerce'); ?></span>
					<input
						type="password"
						id="catalogue-image-studio-api-token"
						name="api_token"
						class="regular-text"
						value=""
						placeholder="<?php echo esc_attr(! empty($settings['api_token']) ? __('Token saved - leave blank to keep it', 'optivra-image-studio-for-woocommerce') : __('Paste your Site API Token', 'optivra-image-studio-for-woocommerce')); ?>"
						autocomplete="new-password"
					/>
					<?php if (! empty($settings['api_token'])) : ?>
						<small class="catalogue-image-studio-help"><?php /* translators: %s: masked site API token. */ echo esc_html(sprintf(__('Saved token: %s', 'optivra-image-studio-for-woocommerce'), $this->mask_token((string) $settings['api_token']))); ?></small>
					<?php endif; ?>
				</label>

				<div class="catalogue-image-studio-link-row">
					<a href="<?php echo esc_url($this->get_sites_url(is_array($usage) ? $usage : [], $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Get your API token', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a href="<?php echo esc_url(trailingslashit((string) $this->get_app_base_url($usage, $settings)) . 'signup'); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Create an Optivra account', 'optivra-image-studio-for-woocommerce'); ?></a>
				</div>

				<div class="catalogue-image-studio-actions">
					<button type="submit" name="connect_store" value="1" class="button button-primary"><?php echo esc_html__('Connect', 'optivra-image-studio-for-woocommerce'); ?></button>
					<button type="submit" name="test_connection" value="1" class="button"><?php echo esc_html__('Test', 'optivra-image-studio-for-woocommerce'); ?></button>
					<?php if (! empty($settings['api_token'])) : ?>
						<button type="submit" name="disconnect_store" value="1" class="button catalogue-image-studio-danger-link"><?php echo esc_html__('Disconnect', 'optivra-image-studio-for-woocommerce'); ?></button>
					<?php endif; ?>
				</div>

				<?php if (! $show_status_inline) : ?>
					<?php $this->render_advanced_settings($settings); ?>
				<?php endif; ?>
			<?php if ($wrap_form) : ?></form><?php else : ?></div><?php endif; ?>
			<div class="catalogue-image-studio-connection-status-panel">
				<?php $this->render_connection_status($usage, $connected); ?>
			</div>
		</div>
		<?php
	}

	private function render_toggle_field(string $name, string $label, bool $checked, string $help): void {
		?>
		<label class="catalogue-image-studio-toggle">
			<span class="catalogue-image-studio-toggle-content">
				<span class="catalogue-image-studio-toggle-copy">
					<strong><?php echo esc_html($label); ?></strong>
					<small class="catalogue-image-studio-help"><?php echo esc_html($help); ?></small>
				</span>
				<input type="checkbox" name="<?php echo esc_attr($name); ?>" value="1" <?php checked($checked); ?> />
			</span>
		</label>
		<?php
	}

	private function render_summary_card(string $label, string $value): void {
		?>
		<div class="optivra-summary-card"><span><?php echo esc_html($label); ?></span><strong><?php echo esc_html($value); ?></strong></div>
		<?php
	}

	private function render_toggle_setting(string $name, string $label, string $description, bool $checked): void {
		?>
		<div class="optivra-setting-row">
			<div>
				<strong class="optivra-setting-label"><?php echo esc_html($label); ?></strong>
				<p class="optivra-setting-description"><?php echo esc_html($description); ?></p>
			</div>
			<div class="optivra-setting-control">
				<label class="optivra-toggle">
					<input type="checkbox" name="<?php echo esc_attr($name); ?>" value="1" <?php checked($checked); ?> />
					<span></span>
				</label>
			</div>
		</div>
		<?php
	}

	/**
	 * @param array<string,string> $options Options.
	 */
	private function render_select_setting(string $name, string $label, string $description, array $options, string $selected): void {
		?>
		<div class="optivra-setting-row">
			<div>
				<strong class="optivra-setting-label"><?php echo esc_html($label); ?></strong>
				<p class="optivra-setting-description"><?php echo esc_html($description); ?></p>
			</div>
			<div class="optivra-setting-control">
				<select name="<?php echo esc_attr($name); ?>">
					<?php foreach ($options as $value => $option_label) : ?>
						<option value="<?php echo esc_attr((string) $value); ?>" <?php selected($selected, (string) $value); ?>><?php echo esc_html($option_label); ?></option>
					<?php endforeach; ?>
				</select>
			</div>
		</div>
		<?php
	}

	private function render_text_setting(string $name, string $label, string $description, string $value, string $type = 'text', string $placeholder = ''): void {
		?>
		<div class="optivra-setting-row">
			<div>
				<strong class="optivra-setting-label"><?php echo esc_html($label); ?></strong>
				<p class="optivra-setting-description"><?php echo esc_html($description); ?></p>
			</div>
			<div class="optivra-setting-control">
				<input type="<?php echo esc_attr($type); ?>" name="<?php echo esc_attr($name); ?>" value="<?php echo esc_attr($value); ?>" placeholder="<?php echo esc_attr($placeholder); ?>" autocomplete="<?php echo 'password' === $type ? 'new-password' : 'off'; ?>" />
			</div>
		</div>
		<?php
	}

	private function render_number_setting(string $name, string $label, string $description, int $value, int $min, int $max): void {
		?>
		<div class="optivra-setting-row">
			<div>
				<strong class="optivra-setting-label"><?php echo esc_html($label); ?></strong>
				<p class="optivra-setting-description"><?php echo esc_html($description); ?></p>
			</div>
			<div class="optivra-setting-control optivra-compact-control">
				<input type="number" name="<?php echo esc_attr($name); ?>" value="<?php echo esc_attr((string) $value); ?>" min="<?php echo esc_attr((string) $min); ?>" max="<?php echo esc_attr((string) $max); ?>" />
			</div>
		</div>
		<?php
	}

	private function render_range_setting(string $name, string $label, string $description, int $value, int $min, int $max): void {
		?>
		<div class="optivra-setting-row">
			<div>
				<strong class="optivra-setting-label"><?php echo esc_html($label); ?></strong>
				<p class="optivra-setting-description"><?php echo esc_html($description); ?></p>
			</div>
			<div class="optivra-setting-control optivra-range-control">
				<input type="range" name="<?php echo esc_attr($name); ?>" value="<?php echo esc_attr((string) $value); ?>" min="<?php echo esc_attr((string) $min); ?>" max="<?php echo esc_attr((string) $max); ?>" oninput="this.nextElementSibling.value=this.value" />
				<output><?php echo esc_html((string) $value); ?></output>
			</div>
		</div>
		<?php
	}

	private function render_category_presets_summary(array $settings): void {
		$presets = isset($settings['category_presets']) && is_array($settings['category_presets']) ? $settings['category_presets'] : [];

		if (empty($presets)) {
			echo '<p class="catalogue-image-studio-help">' . esc_html__('No category presets saved yet. Categories without a preset use your defaults.', 'optivra-image-studio-for-woocommerce') . '</p>';
			return;
		}

		echo '<div class="catalogue-image-studio-presets-list">';
		foreach ($presets as $category_id => $preset) {
			$term = get_term((int) $category_id, 'product_cat');
			if (! $term || is_wp_error($term)) {
				continue;
			}

			echo '<div class="catalogue-image-studio-preset-chip">';
			echo '<strong>' . esc_html($term->name) . '</strong>';
			echo '<span>' . esc_html($this->get_scale_modes()[(string) ($preset['scale_mode'] ?? 'auto')] ?? __('Auto', 'optivra-image-studio-for-woocommerce')) . '</span>';
			echo '<span>' . esc_html($this->get_background_presets()[(string) ($preset['background_preset'] ?? 'optivra-default')] ?? __('Optivra Default', 'optivra-image-studio-for-woocommerce')) . '</span>';
			echo '</div>';
		}
		echo '</div>';
	}

	private function render_seo_preview_example(array $settings): void {
		$suffix = trim((string) ($settings['brand_keyword_suffix'] ?? $settings['seo_brand_suffix'] ?? ''));
		$example_filename = 'black-leather-wallet';
		if ('' !== $suffix) {
			$example_filename .= '-' . sanitize_title($suffix);
		}
		?>
		<div class="catalogue-image-studio-example">
			<strong><?php echo esc_html__('Preview example', 'optivra-image-studio-for-woocommerce'); ?></strong>
			<p><?php echo esc_html($example_filename . '.webp'); ?></p>
			<p><?php echo esc_html__('Alt text: Black Leather Wallet product image', 'optivra-image-studio-for-woocommerce'); ?></p>
		</div>
		<?php
	}

	private function get_background_presets(): array {
		return [
			'optivra-default' => __('Optivra Default', 'optivra-image-studio-for-woocommerce'),
			'soft-white'      => __('Soft White', 'optivra-image-studio-for-woocommerce'),
			'cool-studio'     => __('Cool Studio', 'optivra-image-studio-for-woocommerce'),
			'warm-studio'     => __('Warm Studio', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_scale_modes(): array {
		return [
			'auto'     => __('Auto', 'optivra-image-studio-for-woocommerce'),
			'tight'    => __('Tight', 'optivra-image-studio-for-woocommerce'),
			'balanced' => __('Balanced', 'optivra-image-studio-for-woocommerce'),
			'loose'    => __('Loose', 'optivra-image-studio-for-woocommerce'),
			'close-up' => __('Close-up', 'optivra-image-studio-for-woocommerce'),
			'wide'     => __('Wide', 'optivra-image-studio-for-woocommerce'),
			'tall'     => __('Tall', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_shadow_modes(): array {
		return [
			'off'    => __('Off', 'optivra-image-studio-for-woocommerce'),
			'under'  => __('Under product', 'optivra-image-studio-for-woocommerce'),
			'behind' => __('Behind product', 'optivra-image-studio-for-woocommerce'),
			'custom' => __('Custom', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_shadow_strengths(): array {
		return [
			'light'  => __('Light', 'optivra-image-studio-for-woocommerce'),
			'medium' => __('Medium', 'optivra-image-studio-for-woocommerce'),
			'strong' => __('Strong', 'optivra-image-studio-for-woocommerce'),
			'custom' => __('Custom', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_lighting_modes(): array {
		return [
			'auto'          => __('Auto', 'optivra-image-studio-for-woocommerce'),
			'product-only'  => __('Product only', 'optivra-image-studio-for-woocommerce'),
			'whole-image'   => __('Whole image', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_lighting_strengths(): array {
		return [
			'low'    => __('Low', 'optivra-image-studio-for-woocommerce'),
			'medium' => __('Medium', 'optivra-image-studio-for-woocommerce'),
			'high'   => __('High', 'optivra-image-studio-for-woocommerce'),
			'custom' => __('Custom', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function sanitize_background_preset($preset): string {
		$preset = sanitize_key((string) $preset);
		return array_key_exists($preset, $this->get_background_presets()) ? $preset : 'optivra-default';
	}

	private function sanitize_background_source($source): string {
		$source = sanitize_key((string) $source);
		return in_array($source, ['preset', 'custom'], true) ? $source : 'preset';
	}

	private function sanitize_scale_mode($mode): string {
		$mode = sanitize_key((string) $mode);
		return array_key_exists($mode, $this->get_scale_modes()) ? $mode : 'auto';
	}

	private function sanitize_shadow_mode($mode): string {
		$mode = sanitize_key((string) $mode);
		return array_key_exists($mode, $this->get_shadow_modes()) ? $mode : 'under';
	}

	private function sanitize_shadow_strength($strength): string {
		$strength = sanitize_key((string) $strength);
		return array_key_exists($strength, $this->get_shadow_strengths()) ? $strength : 'medium';
	}

	private function sanitize_lighting_mode($mode): string {
		$mode = sanitize_key((string) $mode);
		return array_key_exists($mode, $this->get_lighting_modes()) ? $mode : 'auto';
	}

	private function sanitize_lighting_strength($strength): string {
		$strength = sanitize_key((string) $strength);
		return array_key_exists($strength, $this->get_lighting_strengths()) ? $strength : 'medium';
	}

	private function sanitize_int_range($value, int $min, int $max, int $fallback): int {
		$value = is_numeric($value) ? (int) $value : $fallback;
		return min($max, max($min, $value));
	}

	private function map_scale_mode_to_percent(string $scale_mode) {
		$map = [
			'auto'     => 'auto',
			'tight'    => 88,
			'balanced' => 82,
			'loose'    => 76,
			'close-up' => 88,
			'wide'     => 76,
			'tall'     => 82,
		];

		return $map[$scale_mode] ?? 'auto';
	}

	private function get_processing_options_for_job(int $job_id): array {
		$job = $this->plugin->jobs()->find($job_id);
		$settings = $this->plugin->get_settings();
		$background_preset = (string) ($settings['background_preset'] ?? 'optivra-default');
		$scale_mode = (string) ($settings['default_scale_mode'] ?? $settings['scale_mode'] ?? 'auto');
		$background_source = (string) ($settings['background_source'] ?? 'preset');

		$options = [];
		$custom_background_url = '';
		if ('custom' === $background_source) {
			$custom_background_url = (string) wp_get_attachment_url(absint($settings['custom_background_attachment_id'] ?? 0));
			if ($custom_background_url) {
				$options['background_image_url'] = $custom_background_url;
			}
		}

		if (empty($options['background_image_url'])) {
			$options['background'] = $this->resolve_background_value($background_preset);
		}

		$scale_percent = $this->map_scale_mode_to_percent($scale_mode);
		if ('auto' !== $scale_percent) {
			$options['scale_percent'] = (int) $scale_percent;
		}

		$options['settings'] = [
			'background' => [
				'source'              => $background_source,
				'preset'              => $background_preset,
				'customBackgroundUrl' => $custom_background_url ?: null,
				'customBackgroundId'  => absint($settings['custom_background_attachment_id'] ?? 0) ?: null,
			],
			'framing' => [
				'mode'                     => $scale_mode,
				'smartScaling'             => ! empty($settings['smart_scaling']),
				'padding'                  => (int) ($settings['framing_padding'] ?? 8),
				'preserveTransparentEdges' => ! empty($settings['preserve_transparent_edges']),
			],
			'shadow' => [
				'mode'     => (string) ($settings['shadow_mode'] ?? 'under'),
				'strength' => (string) ($settings['shadow_strength'] ?? 'medium'),
				'opacity'  => (int) ($settings['shadow_opacity'] ?? 23),
				'blur'     => (int) ($settings['shadow_blur'] ?? 22),
				'offsetX'  => (int) ($settings['shadow_offset_x'] ?? 0),
				'offsetY'  => (int) ($settings['shadow_offset_y'] ?? 0),
				'spread'   => (int) ($settings['shadow_spread'] ?? 100),
				'softness' => (int) ($settings['shadow_softness'] ?? 60),
				'color'    => (string) ($settings['shadow_color'] ?? '#000000'),
			],
			'lighting' => [
				'enabled'           => ! empty($settings['lighting_enabled']),
				'mode'              => (string) ($settings['lighting_mode'] ?? 'auto'),
				'brightness'        => (int) ($settings['brightness_correction'] ?? 0),
				'contrast'          => (int) ($settings['contrast_correction'] ?? 0),
				'highlightRecovery' => ! empty($settings['highlight_recovery']),
				'shadowLift'        => ! empty($settings['shadow_lift']),
				'neutralizeTint'    => ! empty($settings['neutralize_tint']),
				'strength'          => (string) ($settings['lighting_strength'] ?? 'medium'),
			],
			'seo' => [
				'generateFilename'    => ! empty($settings['generate_seo_filename']),
				'generateAltText'     => ! empty($settings['generate_alt_text']),
				'generateTitle'       => ! empty($settings['generate_image_title']),
				'generateCaption'     => ! empty($settings['generate_caption']),
				'generateDescription' => ! empty($settings['generate_description']),
				'onlyFillMissing'     => ! empty($settings['only_fill_missing_metadata']),
				'overrideExisting'    => ! empty($settings['overwrite_existing_metadata']),
				'brandKeywordSuffix'  => (string) ($settings['brand_keyword_suffix'] ?? ''),
			],
		];

		$options['job_overrides'] = [
			'edgeToEdge' => [
				'enabled' => ! empty($job['edge_to_edge_enabled']),
				'left'    => ! empty($job['edge_to_edge_left']),
				'right'   => ! empty($job['edge_to_edge_right']),
				'top'     => ! empty($job['edge_to_edge_top']),
				'bottom'  => ! empty($job['edge_to_edge_bottom']),
			],
		];

		return $options;
	}

	private function resolve_background_value(string $preset): string {
		$map = [
			'optivra-default' => '#f4f6f8',
			'soft-white'      => '#ffffff',
			'cool-studio'     => '#eef4ff',
			'warm-studio'     => '#fff5ec',
		];

		return $map[$preset] ?? '#f4f6f8';
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 * @return array{url:string,filename:string}
	 */
	private function get_custom_background_preview(array $settings): array {
		$attachment_id = absint($settings['custom_background_attachment_id'] ?? 0);
		if ($attachment_id <= 0) {
			return [
				'url'      => '',
				'filename' => '',
			];
		}

		return [
			'url'      => (string) wp_get_attachment_image_url($attachment_id, 'medium'),
			'filename' => (string) wp_basename((string) get_attached_file($attachment_id)),
		];
	}

	private function is_low_credit_state(array $usage): bool {
		$remaining = max(0, (int) ($usage['credits_remaining'] ?? 0));
		$total = max(0, (int) ($usage['credits_total'] ?? 0));

		if ($remaining <= 1) {
			return true;
		}

		return $total > 0 && ($remaining / $total) <= 0.05;
	}

	private function mask_token(string $token): string {
		$length = strlen($token);
		if ($length <= 8) {
			return str_repeat('*', max(0, $length - 2)) . substr($token, -2);
		}

		return substr($token, 0, 4) . str_repeat('*', max(0, $length - 8)) . substr($token, -4);
	}

	/**
	 * @param array<string,mixed>|mixed $usage Usage.
	 */
	private function get_app_base_url($usage, array $settings = []): string {
		if (is_array($usage) && ! empty($usage['app_url']) && is_string($usage['app_url'])) {
			return untrailingslashit($usage['app_url']);
		}

		if (is_array($usage) && ! empty($usage['account_urls']['account']) && is_string($usage['account_urls']['account'])) {
			$path = wp_parse_url($usage['account_urls']['account'], PHP_URL_PATH);
			if (is_string($path) && false !== strpos($path, '/account')) {
				return untrailingslashit((string) str_replace($path, '', $usage['account_urls']['account']));
			}
		}

		return untrailingslashit((string) ($settings['api_base_url'] ?? 'https://www.optivra.app'));
	}

	private function normalize_account_url(string $url, string $fallback_path): string {
		$url = trim($url);
		if ('' === $url) {
			return '';
		}

		$path = (string) wp_parse_url($url, PHP_URL_PATH);
		$query = (string) wp_parse_url($url, PHP_URL_QUERY);
		$base = untrailingslashit((string) str_replace($path, '', $url));

		if ('/account' === untrailingslashit($path)) {
			return trailingslashit($base) . ltrim($fallback_path, '/');
		}

		if ('/account/dashboard' === untrailingslashit($path) || '/account/sites' === untrailingslashit($path)) {
			return trailingslashit($base) . 'dashboard';
		}

		if ('/account/credits' === untrailingslashit($path)) {
			return trailingslashit($base) . 'account/billing#buy-credits';
		}

		if ('' !== $query && false === strpos($url, '?')) {
			return $url;
		}

		return $url;
	}

	/**
	 * @param array<string,mixed>|mixed $usage Usage.
	 */
	private function get_upgrade_url($usage, array $settings = []): string {
		if (is_array($usage) && ! empty($usage['account_urls']['billing']) && is_string($usage['account_urls']['billing'])) {
			return $this->normalize_account_url($usage['account_urls']['billing'], 'account/billing');
		}

		return trailingslashit($this->get_app_base_url($usage, $settings)) . 'account/billing';
	}

	/**
	 * @param array<string,mixed>|mixed $usage Usage.
	 */
	private function get_buy_credits_url($usage, array $settings = []): string {
		if (is_array($usage) && ! empty($usage['account_urls']['credits']) && is_string($usage['account_urls']['credits'])) {
			return $this->normalize_account_url($usage['account_urls']['credits'], 'account/billing#buy-credits');
		}

		return trailingslashit($this->get_app_base_url($usage, $settings)) . 'account/billing#buy-credits';
	}

	/**
	 * @param array<string,mixed>|mixed $usage Usage.
	 */
	private function get_account_url($usage, array $settings = []): string {
		if (is_array($usage) && ! empty($usage['account_urls']['account']) && is_string($usage['account_urls']['account'])) {
			return $this->normalize_account_url($usage['account_urls']['account'], 'dashboard');
		}

		return trailingslashit($this->get_app_base_url($usage, $settings)) . 'dashboard';
	}

	private function get_sites_url($usage, array $settings = []): string {
		return trailingslashit($this->get_app_base_url($usage, $settings)) . 'dashboard';
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return void
	 */
	private function render_job_row(array $job, bool $selectable = true): void {
		$product_id       = (int) ($job['product_id'] ?? 0);
		$attachment_id    = (int) ($job['attachment_id'] ?? 0);
		$before_url       = $attachment_id ? wp_get_attachment_image_url($attachment_id, 'thumbnail') : '';
		$processed_links  = $this->get_processed_image_links($job);
		$product_title    = $product_id ? get_the_title($product_id) : __('Unknown product', 'optivra-image-studio-for-woocommerce');
		?>
		<tr>
			<?php if ($selectable) : ?>
				<th scope="row" class="check-column">
					<input type="checkbox" class="catalogue-image-studio-job-check" name="job_ids[]" value="<?php echo esc_attr((string) (int) $job['id']); ?>" />
				</th>
			<?php endif; ?>
			<td>
				<strong><?php echo esc_html($product_title); ?></strong><br />
				<a href="<?php echo esc_url(get_edit_post_link($product_id)); ?>"><?php echo esc_html__('Edit product', 'optivra-image-studio-for-woocommerce'); ?></a>
			</td>
			<td><?php $this->render_thumbnail($before_url, __('Before', 'optivra-image-studio-for-woocommerce')); ?></td>
			<td><?php $this->render_after_thumbnail($processed_links, $job); ?></td>
			<td><?php echo esc_html((string) $job['image_role']); ?> <?php echo 'gallery' === (string) $job['image_role'] ? esc_html('#' . ((int) $job['gallery_index'] + 1)) : ''; ?></td>
			<td>
				<span class="catalogue-image-studio-status catalogue-image-studio-status-<?php echo esc_attr(sanitize_key((string) $job['status'])); ?>"><?php echo esc_html($this->format_status((string) $job['status'])); ?></span><?php echo ! empty($job['error_message']) ? '<br /><small>' . esc_html((string) $job['error_message']) . '</small>' : ''; ?>
				<?php if (in_array((string) ($job['status'] ?? ''), ['queued', 'processing', 'failed', 'completed', 'rejected'], true)) : ?>
					<?php $this->render_job_edge_controls($job); ?>
				<?php endif; ?>
				<?php $this->render_job_diagnostics($job); ?>
			</td>
			<td><?php $this->render_seo_fields($job); ?></td>
			<td>
				<?php echo ! empty($job['error_message']) ? esc_html((string) $job['error_message']) : esc_html((string) ($job['updated_at'] ?? '')); ?>
			</td>
		</tr>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 */
	private function render_job_edge_controls(array $job): void {
		$job_id = (int) ($job['id'] ?? 0);
		?>
		<details class="optivra-job-options">
			<summary><?php echo esc_html__('Framing overrides', 'optivra-image-studio-for-woocommerce'); ?></summary>
			<label class="optivra-inline-check"><input type="checkbox" name="edge_overrides[<?php echo esc_attr((string) $job_id); ?>][enabled]" value="1" <?php checked(! empty($job['edge_to_edge_enabled'])); ?> /> <?php echo esc_html__('Image to edge', 'optivra-image-studio-for-woocommerce'); ?></label>
			<small class="catalogue-image-studio-help"><?php echo esc_html__('Choosing any edge automatically enables the override for this image.', 'optivra-image-studio-for-woocommerce'); ?></small>
			<div class="optivra-edge-grid">
				<label><input type="checkbox" name="edge_overrides[<?php echo esc_attr((string) $job_id); ?>][left]" value="1" <?php checked(! empty($job['edge_to_edge_left'])); ?> /> <?php echo esc_html__('Left edge', 'optivra-image-studio-for-woocommerce'); ?></label>
				<label><input type="checkbox" name="edge_overrides[<?php echo esc_attr((string) $job_id); ?>][right]" value="1" <?php checked(! empty($job['edge_to_edge_right'])); ?> /> <?php echo esc_html__('Right edge', 'optivra-image-studio-for-woocommerce'); ?></label>
				<label><input type="checkbox" name="edge_overrides[<?php echo esc_attr((string) $job_id); ?>][top]" value="1" <?php checked(! empty($job['edge_to_edge_top'])); ?> /> <?php echo esc_html__('Top edge', 'optivra-image-studio-for-woocommerce'); ?></label>
				<label><input type="checkbox" name="edge_overrides[<?php echo esc_attr((string) $job_id); ?>][bottom]" value="1" <?php checked(! empty($job['edge_to_edge_bottom'])); ?> /> <?php echo esc_html__('Bottom edge', 'optivra-image-studio-for-woocommerce'); ?></label>
			</div>
			<?php if ('completed' === (string) ($job['status'] ?? '')) : ?>
				<small class="catalogue-image-studio-help"><?php echo esc_html__('Process this image again to apply changed framing overrides.', 'optivra-image-studio-for-woocommerce'); ?></small>
			<?php endif; ?>
		</details>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return void
	 */
	private function render_seo_fields(array $job): void {
		$job_id = (int) $job['id'];
		$fields = [
			'filename'    => __('Filename', 'optivra-image-studio-for-woocommerce'),
			'alt_text'    => __('Alt', 'optivra-image-studio-for-woocommerce'),
			'title'       => __('Title', 'optivra-image-studio-for-woocommerce'),
			'caption'     => __('Caption', 'optivra-image-studio-for-woocommerce'),
			'description' => __('Description', 'optivra-image-studio-for-woocommerce'),
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
			echo '<span class="catalogue-image-studio-muted">' . esc_html__('None', 'optivra-image-studio-for-woocommerce') . '</span>';
			return;
		}

		?>
		<a href="<?php echo esc_url($url); ?>" target="_blank" rel="noopener noreferrer">
			<img src="<?php echo esc_url($url); ?>" alt="<?php echo esc_attr($label); ?>" class="catalogue-image-studio-thumb" />
		</a>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return array{preview:string,full:string,source:string}
	 */
	private function get_processed_image_links(array $job): array {
		$attachment_id = (int) ($job['processed_attachment_id'] ?? 0);

		if ($attachment_id > 0 && get_post($attachment_id)) {
			$preview = (string) wp_get_attachment_image_url($attachment_id, 'thumbnail');
			$full    = (string) wp_get_attachment_url($attachment_id);

			if ('' !== $preview && '' !== $full) {
				return [
					'preview' => $preview,
					'full'    => $full,
					'source'  => 'attachment',
				];
			}
		}

		$url = isset($job['processed_url']) ? $this->normalize_supabase_storage_url((string) $job['processed_url']) : '';
		if ('' !== $url && wp_http_validate_url($url)) {
			return [
				'preview' => esc_url_raw($url),
				'full'    => esc_url_raw($url),
				'source'  => 'remote',
			];
		}

		return [
			'preview' => '',
			'full'    => '',
			'source'  => 'missing',
		];
	}

	private function normalize_supabase_storage_url(string $url): string {
		$url = html_entity_decode(trim($url), ENT_QUOTES, 'UTF-8');

		if (false !== strpos($url, '.supabase.co/object/sign/')) {
			$url = str_replace('.supabase.co/object/sign/', '.supabase.co/storage/v1/object/sign/', $url);
		}

		if (false !== strpos($url, '.supabase.co/object/public/')) {
			$url = str_replace('.supabase.co/object/public/', '.supabase.co/storage/v1/object/public/', $url);
		}

		return $url;
	}

	/**
	 * @param array{preview:string,full:string,source:string} $links Processed image links.
	 * @param array<string,mixed>                             $job Job.
	 */
	private function render_after_thumbnail(array $links, array $job): void {
		$status = (string) ($job['status'] ?? '');

		if (in_array($status, ['unprocessed', 'queued', 'processing'], true)) {
			echo '<div class="catalogue-image-studio-after-pending">';
			echo '<span>' . esc_html__('Not processed yet', 'optivra-image-studio-for-woocommerce') . '</span>';
			echo '<small>' . esc_html__('Process this queued image to create an after preview.', 'optivra-image-studio-for-woocommerce') . '</small>';
			echo '</div>';
			return;
		}

		if ('' === $links['preview'] || '' === $links['full']) {
			echo '<div class="catalogue-image-studio-missing-after">';
			echo '<span>' . esc_html__('Processed image file missing', 'optivra-image-studio-for-woocommerce') . '</span>';
			echo '<small>' . esc_html__('Reprocess this image before approving.', 'optivra-image-studio-for-woocommerce') . '</small>';
			echo '<button type="submit" class="button button-small" name="catalogue_image_studio_action" value="retry" onclick="var box=this.closest(\'tr\').querySelector(\'.catalogue-image-studio-job-check\'); if (box) { box.checked = true; }">' . esc_html__('Reprocess', 'optivra-image-studio-for-woocommerce') . '</button>';
			echo '</div>';
			return;
		}

		?>
		<a href="<?php echo esc_url($links['full']); ?>" target="_blank" rel="noopener noreferrer" class="catalogue-image-studio-after-link">
			<img src="<?php echo esc_url($links['preview']); ?>" alt="<?php echo esc_attr__('After', 'optivra-image-studio-for-woocommerce'); ?>" class="catalogue-image-studio-thumb" />
		</a>
		<?php if ('remote' === $links['source']) : ?>
			<small class="catalogue-image-studio-help"><?php echo esc_html__('Remote preview. Approving will import this file into Media Library.', 'optivra-image-studio-for-woocommerce'); ?></small>
		<?php endif; ?>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 */
	private function render_job_diagnostics(array $job): void {
		$rows = [
			__('Job ID', 'optivra-image-studio-for-woocommerce')                  => (string) ($job['id'] ?? ''),
			__('Product ID', 'optivra-image-studio-for-woocommerce')              => (string) ($job['product_id'] ?? ''),
			__('Original attachment ID', 'optivra-image-studio-for-woocommerce')  => (string) ($job['original_attachment_id'] ?? $job['attachment_id'] ?? ''),
			__('Processed attachment ID', 'optivra-image-studio-for-woocommerce') => (string) ($job['processed_attachment_id'] ?? ''),
			__('Processed URL', 'optivra-image-studio-for-woocommerce')           => (string) ($job['processed_url'] ?? ''),
			__('Storage bucket', 'optivra-image-studio-for-woocommerce')          => (string) ($job['processed_storage_bucket'] ?? ''),
			__('Storage path', 'optivra-image-studio-for-woocommerce')            => (string) ($job['processed_storage_path'] ?? ''),
			__('Last processing error', 'optivra-image-studio-for-woocommerce')   => (string) ($job['error_message'] ?? ''),
			__('Last approval error', 'optivra-image-studio-for-woocommerce')     => (string) ($job['approval_error'] ?? ''),
		];
		?>
		<details class="optivra-job-diagnostics">
			<summary><?php echo esc_html__('Technical details', 'optivra-image-studio-for-woocommerce'); ?></summary>
			<dl>
				<?php foreach ($rows as $label => $value) : ?>
					<dt><?php echo esc_html($label); ?></dt>
					<dd><?php echo '' !== trim($value) ? esc_html($value) : esc_html__('Not stored', 'optivra-image-studio-for-woocommerce'); ?></dd>
				<?php endforeach; ?>
			</dl>
		</details>
		<?php
	}

	private function format_status(string $status): string {
		return ucwords(str_replace('_', ' ', sanitize_key($status)));
	}
}
