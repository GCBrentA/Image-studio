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
	private const CAPABILITY = 'manage_woocommerce';
	private const MENU_SLUG = 'optivra-image-studio';
	private const LEGACY_MENU_SLUG = 'optivra';

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
	 * Admin page hook suffixes.
	 *
	 * @var array<int,string>
	 */
	private $page_hooks = [];

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
		add_action('admin_init', [$this, 'handle_recommendation_post']);
		add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
		add_action('wp_ajax_optivra_image_audit_start', [$this, 'ajax_image_audit_start']);
		add_action('wp_ajax_optivra_image_audit_batch', [$this, 'ajax_image_audit_batch']);
		add_action('wp_ajax_optivra_image_audit_complete', [$this, 'ajax_image_audit_complete']);
		add_action('wp_ajax_optivra_image_audit_cancel', [$this, 'ajax_image_audit_cancel']);
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
	 * Register the top-level Optivra menu and supporting submenus.
	 *
	 * @return void
	 */
	public function register_menu(): void {
		if (! current_user_can(self::CAPABILITY)) {
			return;
		}

		$this->page_hook = add_menu_page(
			__('Optivra Image Studio', 'optivra-image-studio-for-woocommerce'),
			__('Optivra', 'optivra-image-studio-for-woocommerce'),
			self::CAPABILITY,
			self::MENU_SLUG,
			[$this, 'render_page'],
			'dashicons-format-image',
			56
		);
		$this->page_hooks[] = $this->page_hook;

		$submenus = [
			self::MENU_SLUG                     => __('Dashboard', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-scan'        => __('Product Scan', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-health'      => __('Health Report', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-recommendations' => __('Recommendations', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-queue'       => __('Processing Queue', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-backgrounds' => __('Backgrounds', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-seo'         => __('SEO Tools', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-settings'    => __('Settings', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-account'     => __('Account & Billing', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-support'     => __('Support', 'optivra-image-studio-for-woocommerce'),
		];

		foreach ($submenus as $slug => $label) {
			$hook = add_submenu_page(
				self::MENU_SLUG,
				__('Optivra Image Studio', 'optivra-image-studio-for-woocommerce'),
				$label,
				self::CAPABILITY,
				$slug,
				[$this, 'render_page']
			);

			if (is_string($hook)) {
				$this->page_hooks[] = $hook;
			}
		}

		$legacy_hook = add_submenu_page(
			null,
			__('Optivra Image Studio', 'optivra-image-studio-for-woocommerce'),
			__('Optivra Image Studio', 'optivra-image-studio-for-woocommerce'),
			self::CAPABILITY,
			self::LEGACY_MENU_SLUG,
			[$this, 'render_page']
		);

		if (is_string($legacy_hook)) {
			$this->page_hooks[] = $legacy_hook;
		}
	}

	/**
	 * Enqueue admin assets only on the plugin page.
	 *
	 * @param string $hook Current admin page hook.
	 * @return void
	 */
	public function enqueue_assets(string $hook): void {
		if (! in_array($hook, $this->page_hooks, true)) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_style(
			'catalogue-image-studio-admin',
			CIS_URL . 'assets/admin.css',
			[],
			CIS_VERSION . '-' . (string) filemtime(CIS_PATH . 'assets/admin.css')
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

		$scan_config = [
			'ajaxUrl' => admin_url('admin-ajax.php'),
			'nonce'   => wp_create_nonce('optivra_image_audit_scan'),
			'i18n'    => [
				'starting'   => __('Starting scan...', 'optivra-image-studio-for-woocommerce'),
				'scanning'   => __('Scanning product image metadata...', 'optivra-image-studio-for-woocommerce'),
				'completing' => __('Calculating report...', 'optivra-image-studio-for-woocommerce'),
				'completed'  => __('Scan completed. Refreshing report summary...', 'optivra-image-studio-for-woocommerce'),
				'cancelled'  => __('Scan cancelled.', 'optivra-image-studio-for-woocommerce'),
				'failed'     => __('Scan failed. Check the message and try again.', 'optivra-image-studio-for-woocommerce'),
			],
		];

		wp_add_inline_script(
			'jquery',
			'window.optivraScanConfig = ' . wp_json_encode($scan_config) . ';
			(function() {
				function ready(fn) {
					if (document.readyState !== "loading") {
						fn();
						return;
					}
					document.addEventListener("DOMContentLoaded", fn);
				}

				function post(action, payload) {
					var body = new URLSearchParams();
					body.set("action", action);
					body.set("nonce", window.optivraScanConfig.nonce);
					Object.keys(payload || {}).forEach(function(key) {
						body.set(key, payload[key]);
					});
					return fetch(window.optivraScanConfig.ajaxUrl, {
						method: "POST",
						credentials: "same-origin",
						headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
						body: body.toString()
					}).then(function(response) {
						return response.json();
					}).then(function(json) {
						if (!json || !json.success) {
							var message = json && json.data && json.data.message ? json.data.message : window.optivraScanConfig.i18n.failed;
							throw new Error(message);
						}
						return json.data || {};
					});
				}

				function checkedValues(form, name) {
					return Array.prototype.map.call(form.querySelectorAll("[name=\"" + name + "\"]:checked"), function(input) {
						return input.value;
					});
				}

				function collectOptions(form) {
					return {
						scan_scope: (form.querySelector("[name=\"scan_scope\"]:checked") || {}).value || "all",
						category_ids: checkedValues(form, "category_ids[]"),
						image_types: checkedValues(form, "image_types[]"),
						checks: checkedValues(form, "checks[]")
					};
				}

				function setText(root, name, value) {
					var node = root.querySelector("[data-optivra-scan-" + name + "]");
					if (node) {
						node.textContent = String(value);
					}
				}

				function setProgress(root, progress) {
					var total = Math.max(0, parseInt(progress.total_products || 0, 10));
					var products = Math.max(0, parseInt(progress.products_scanned || 0, 10));
					var percent = total > 0 ? Math.min(100, Math.round((products / total) * 100)) : 0;
					root.hidden = false;
					setText(root, "status", progress.status_label || progress.status || "");
					setText(root, "products", products + " / " + total);
					setText(root, "images", progress.images_scanned || 0);
					setText(root, "batch", progress.current_batch || 0);
					setText(root, "started", progress.started_at || "");
					setText(root, "message", progress.message || "");
					var bar = root.querySelector("[data-optivra-scan-bar]");
					if (bar) {
						bar.style.width = percent + "%";
					}
				}

				ready(function() {
					var form = document.getElementById("optivra-audit-scan-form");
					var progress = document.getElementById("optivra-audit-scan-progress");
					var startButton = document.getElementById("optivra-audit-start");
					var cancelButton = document.getElementById("optivra-audit-cancel");
					var cancelled = false;

					if (!form || !progress || !startButton) {
						return;
					}

					function fail(error) {
						startButton.disabled = false;
						cancelButton.disabled = false;
						cancelButton.hidden = true;
						setProgress(progress, {
							status: "failed",
							status_label: "Failed",
							message: error.message || window.optivraScanConfig.i18n.failed
						});
					}

					function runBatch(scanId, options, offset, batchNumber, totalProducts) {
						if (cancelled) {
							return post("optivra_image_audit_cancel", { scan_id: scanId }).then(function(data) {
								setProgress(progress, data.progress || { status_label: window.optivraScanConfig.i18n.cancelled });
							});
						}

						return post("optivra_image_audit_batch", {
							scan_id: scanId,
							options: JSON.stringify(options),
							offset: offset,
							batch: batchNumber
						}).then(function(data) {
							setProgress(progress, data.progress || {});
							if (data.done) {
								setProgress(progress, Object.assign({}, data.progress || {}, { status_label: window.optivraScanConfig.i18n.completing }));
								return post("optivra_image_audit_complete", { scan_id: scanId }).then(function(doneData) {
									setProgress(progress, doneData.progress || {});
									startButton.disabled = false;
									cancelButton.hidden = true;
									window.setTimeout(function() { window.location.reload(); }, 900);
								});
							}
							return window.setTimeout(function() {
								runBatch(scanId, options, data.next_offset || (offset + 25), batchNumber + 1, totalProducts).catch(fail);
							}, 150);
						});
					}

					startButton.addEventListener("click", function(event) {
						event.preventDefault();
						cancelled = false;
						startButton.disabled = true;
						cancelButton.disabled = false;
						cancelButton.hidden = false;
						var options = collectOptions(form);
						setProgress(progress, { status_label: window.optivraScanConfig.i18n.starting, message: "" });
						post("optivra_image_audit_start", { options: JSON.stringify(options) }).then(function(data) {
							setProgress(progress, data.progress || {});
							return runBatch(data.scan_id, options, 0, 1, data.total_products || 0);
						}).catch(fail);
					});

					if (cancelButton) {
						cancelButton.addEventListener("click", function(event) {
							event.preventDefault();
							cancelled = true;
							cancelButton.disabled = true;
						});
					}
				});
			})();'
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
			! current_user_can(self::CAPABILITY)
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

		$this->plugin->client()->send_event('settings_saved', [], $settings);

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
				$client->send_event(isset($_POST['connect_store']) ? 'plugin_connected' : 'connection_tested', ['connected' => true], $settings);
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
		$settings['preserve_product_exactly'] = ! empty($input['preserve_product_exactly']);
		$settings['processing_mode']         = $this->sanitize_processing_mode($input['processing_mode'] ?? $settings['processing_mode']);
		$settings['product_fit']             = $this->sanitize_product_fit($input['product_fit'] ?? $settings['product_fit']);
		$settings['smart_scaling']           = ! empty($input['smart_scaling']);
		$settings['smart_scaling_enabled']   = $settings['smart_scaling'];
		$settings['apply_shadow']            = ! empty($input['apply_shadow']);
		$settings['shadow_enabled']          = $settings['apply_shadow'];
		$settings['auto_fail_product_altered'] = ! empty($input['auto_fail_product_altered']);
		$settings['auto_fix_crop_spacing']   = ! empty($input['auto_fix_crop_spacing']);
		$settings['preserve_dark_detail']    = ! empty($input['preserve_dark_detail']);
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
		$settings['target_product_coverage'] = $this->sanitize_int_range($input['target_product_coverage'] ?? $settings['target_product_coverage'], 70, 90, 86);
		$settings['max_retries']             = $this->sanitize_int_range($input['max_retries'] ?? $settings['max_retries'], 1, 2, 2);
		$settings['output_size']             = $this->sanitize_int_range($input['output_size'] ?? $settings['output_size'], 512, 2048, 1024);
		$settings['output_aspect_ratio']     = $this->sanitize_output_aspect_ratio($input['output_aspect_ratio'] ?? $settings['output_aspect_ratio']);
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
		$settings['send_operational_diagnostics'] = ! empty($input['send_operational_diagnostics']);

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
			! current_user_can(self::CAPABILITY)
		) {
			return;
		}

		check_admin_referer('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce');

		$action  = sanitize_key((string) wp_unslash($_POST['catalogue_image_studio_action']));
		$job_ids = isset($_POST['job_ids']) ? array_map('absint', (array) wp_unslash($_POST['job_ids'])) : [];
		$job_ids = array_values(array_filter($job_ids));
		$usage   = $this->get_usage();
		$settings = $this->plugin->get_settings();

		if (is_wp_error($usage)) {
			$this->add_error(__('Connect your Optivra account before scanning or processing images.', 'optivra-image-studio-for-woocommerce'));
			return;
		}

		$this->save_posted_edge_overrides();

		if ('scan' === $action) {
			$this->plugin->client()->send_event('scan_started', [], $settings);
			$result = $this->plugin->scanner()->scan($this->get_scan_filters_from_request());
			$this->plugin->client()->send_event('scan_completed', [
				'slots_found' => (int) $result['slots_found'],
				'jobs_found'  => count((array) $result['job_ids']),
			], $settings);
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
			$this->plugin->client()->send_event('queue_created', ['jobs_queued' => count((array) $result['job_ids'])], $settings);
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
			$this->plugin->client()->send_event('image_queued', ['jobs_queued' => count($job_ids)], $settings);
			$this->add_success(sprintf(
				/* translators: %d: jobs queued */
				__('%d selected image(s) queued.', 'optivra-image-studio-for-woocommerce'),
				count($job_ids)
			));
			return;
		}

		if ('process_next_batch' === $action) {
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
			if ('process' === $action) {
				$this->plugin->client()->send_event('processing_started', ['job_id' => $job_id], $settings);
			}
			$result = $this->run_job_action($action, $job_id);

			if (is_wp_error($result)) {
				$failed++;
				if ('process' === $action) {
					$this->plugin->client()->send_event('processing_failed', ['job_id' => $job_id, 'error_code' => $result->get_error_code()], $settings);
				}
				$this->add_error($result->get_error_message());
			} else {
				$success++;
				if ('process' === $action) {
					$this->plugin->client()->send_event('processing_completed', ['job_id' => $job_id], $settings);
				} elseif ('approve' === $action) {
					$this->plugin->client()->send_event('image_approved', ['job_id' => $job_id], $settings);
				} elseif ('reject' === $action) {
					$this->plugin->client()->send_event('image_rejected', ['job_id' => $job_id], $settings);
				} elseif ('regenerate_seo' === $action) {
					$this->plugin->client()->send_event('seo_generated', ['job_id' => $job_id], $settings);
				}
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
		$seo_rows = map_deep(wp_unslash($_POST['seo']), 'sanitize_text_field');

		foreach ((array) $seo_rows as $job_id => $seo) {
			$job_id = absint($job_id);

			if (! is_array($seo)) {
				continue;
			}

			$this->plugin->jobs()->update(
				$job_id,
				[
					'seo_filename'    => isset($seo['filename']) ? sanitize_file_name((string) $seo['filename']) : '',
					'seo_alt_text'    => isset($seo['alt_text']) ? sanitize_text_field((string) $seo['alt_text']) : '',
					'seo_title'       => isset($seo['title']) ? sanitize_text_field((string) $seo['title']) : '',
					'seo_caption'     => isset($seo['caption']) ? sanitize_text_field((string) $seo['caption']) : '',
					'seo_description' => isset($seo['description']) ? sanitize_textarea_field((string) $seo['description']) : '',
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
		$posted = map_deep(wp_unslash($_POST['edge_overrides']), 'sanitize_text_field');
		$overrides = [];

		foreach ((array) $posted as $job_id => $override) {
			$job_id = absint($job_id);

			if (! is_array($override)) {
				continue;
			}

			$left    = ! empty($override['left']);
			$right   = ! empty($override['right']);
			$top     = ! empty($override['top']);
			$bottom  = ! empty($override['bottom']);

			$overrides[$job_id] = [
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
		$slots   = isset($_POST['slots']) ? array_map('sanitize_text_field', (array) wp_unslash($_POST['slots'])) : [];
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

	private function get_admin_page_slug(string $tab): string {
		$map = [
			'dashboard'       => self::MENU_SLUG,
			'scan'            => 'optivra-image-studio-scan',
			'health'          => 'optivra-image-studio-health',
			'recommendations' => 'optivra-image-studio-recommendations',
			'queue'           => 'optivra-image-studio-queue',
			'review'          => 'optivra-image-studio-queue',
			'backgrounds'     => 'optivra-image-studio-backgrounds',
			'seo'             => 'optivra-image-studio-seo',
			'settings'        => 'optivra-image-studio-settings',
			'account'         => 'optivra-image-studio-account',
			'support'         => 'optivra-image-studio-support',
			'logs'            => 'optivra-image-studio-support',
		];

		return $map[$tab] ?? self::MENU_SLUG;
	}

	private function get_admin_page_url(string $tab = 'dashboard'): string {
		$url = add_query_arg('page', $this->get_admin_page_slug($tab), admin_url('admin.php'));

		if (in_array($tab, ['review', 'logs'], true)) {
			$url = add_query_arg('cis_tab', $tab, $url);
		}

		return $url;
	}

	private function redirect_after_settings_post(): void {
		$target = $this->get_admin_page_url('settings');
		// This helper is called only from handle_settings_post(), after check_admin_referer() and manage_woocommerce checks.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by the calling admin settings handler.
		if (! empty($_POST['catalogue_image_studio_full_settings'])) {
			$target = $this->get_admin_page_url('settings');
		}

		wp_safe_redirect($target);
		exit;
	}

	public function handle_recommendation_post(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Presence check only; nonce is verified before acting.
		if (empty($_POST['optivra_recommendation_action'])) {
			return;
		}

		if (! current_user_can(self::CAPABILITY)) {
			wp_die(esc_html__('You do not have permission to manage Optivra recommendations.', 'optivra-image-studio-for-woocommerce'));
		}

		check_admin_referer('optivra_recommendation_action', 'optivra_recommendation_action_nonce');

		// phpcs:disable WordPress.Security.NonceVerification.Missing -- Nonce verified above.
		$action = sanitize_key(wp_unslash($_POST['optivra_recommendation_action']));
		$key = isset($_POST['optivra_recommendation_key']) ? sanitize_text_field(wp_unslash($_POST['optivra_recommendation_key'])) : '';
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$context = $this->get_recommendation_report_context();
		$scan_id = (string) ($context['scan_id'] ?? '');
		$recommendations = isset($context['recommendations']) && is_array($context['recommendations']) ? $context['recommendations'] : [];
		$recommendation = $this->find_recommendation_by_key($recommendations, $key);

		if ('' === $scan_id || empty($recommendation)) {
			$this->queue_notice(__('That recommendation is no longer available. Run a new scan or refresh the report.', 'optivra-image-studio-for-woocommerce'), 'error');
			wp_safe_redirect($this->get_admin_page_url('recommendations'));
			exit;
		}

		if ('dismiss_recommendation' === $action) {
			$this->dismiss_recommendation($scan_id, $key);
			$this->queue_notice(__('Recommendation dismissed for this scan.', 'optivra-image-studio-for-woocommerce'), 'success');
			wp_safe_redirect($this->get_admin_page_url('recommendations'));
			exit;
		}

		if ('queue_recommendation' === $action) {
			$recommendation_id = $this->get_recommendation_id($recommendation);
			if ('' === $recommendation_id) {
				$this->queue_notice(__('This recommendation was generated locally from the report summary, so queue creation is not available for it yet. Use Review Images to inspect the affected area.', 'optivra-image-studio-for-woocommerce'), 'error');
				wp_safe_redirect($this->get_admin_page_url('recommendations'));
				exit;
			}

			$result = $this->plugin->client()->queue_audit_recommendation($scan_id, $recommendation_id);
			if (is_wp_error($result)) {
				$this->queue_notice($result->get_error_message(), 'error');
			} else {
				$status = isset($result['status']) && is_scalar($result['status']) ? sanitize_key((string) $result['status']) : '';
				$message = isset($result['message']) && is_scalar($result['message']) ? sanitize_text_field((string) $result['message']) : '';
				if ('not_implemented' === $status) {
					$this->queue_notice('' !== $message ? $message : __('Queue integration for recommendations is not available yet.', 'optivra-image-studio-for-woocommerce'), 'error');
				} else {
					$this->queue_notice(__('Recommendation sent to the processing queue.', 'optivra-image-studio-for-woocommerce'), 'success');
				}
			}

			wp_safe_redirect($this->get_admin_page_url('recommendations'));
			exit;
		}

		$this->queue_notice(__('Unknown recommendation action.', 'optivra-image-studio-for-woocommerce'), 'error');
		wp_safe_redirect($this->get_admin_page_url('recommendations'));
		exit;
	}

	public function ajax_image_audit_start(): void {
		$this->verify_image_audit_ajax();

		$settings = $this->plugin->get_settings();
		if (empty($settings['api_token'])) {
			$this->send_audit_error(__('Connect your Optivra account before running a Product Image Health Report scan.', 'optivra-image-studio-for-woocommerce'));
		}

		$options = $this->get_audit_options_from_ajax();
		if ('categories' === (string) ($options['scan_scope'] ?? '') && empty($options['category_ids'])) {
			$this->send_audit_error(__('Choose at least one category or switch the scan scope to All products.', 'optivra-image-studio-for-woocommerce'));
		}

		$usage = $this->get_usage();
		if (is_wp_error($usage)) {
			$this->send_audit_error($usage->get_error_message());
		}

		$store_id = $this->get_audit_store_id(is_array($usage) ? $usage : []);
		$total_products = $this->plugin->scanner()->count_audit_products($options);
		$scan_options = $options + [
			'total_products_estimate' => $total_products,
			'plugin_version'          => defined('CIS_VERSION') ? CIS_VERSION : '1.0.0',
			'woocommerce_version'     => defined('WC_VERSION') ? WC_VERSION : '',
		];

		$result = $this->plugin->client()->start_image_audit($store_id, $scan_options);
		if (is_wp_error($result)) {
			$this->send_audit_error($result->get_error_message());
		}

		$scan_id = $this->extract_scan_id(is_array($result) ? $result : []);
		if ('' === $scan_id) {
			$this->send_audit_error(__('Optivra did not return a scan ID for this audit.', 'optivra-image-studio-for-woocommerce'));
		}

		update_option('optivra_latest_scan_id', $scan_id, false);
		update_option('optivra_latest_audit_store_id', $store_id, false);
		update_option('optivra_scan_in_progress', true, false);

		$progress = $this->save_audit_progress(
			[
				'scan_id'          => $scan_id,
				'status'           => 'running',
				'status_label'     => __('Running', 'optivra-image-studio-for-woocommerce'),
				'products_scanned' => 0,
				'images_scanned'   => 0,
				'total_products'   => $total_products,
				'current_batch'    => 0,
				'errors'           => [],
				'warnings'         => [],
				'started_at'       => current_time('mysql'),
				'message'          => __('Audit scan started. Metadata collection is free and does not use image processing credits.', 'optivra-image-studio-for-woocommerce'),
			]
		);

		wp_send_json_success(['scan_id' => $scan_id, 'total_products' => $total_products, 'progress' => $progress]);
	}

	public function ajax_image_audit_batch(): void {
		$this->verify_image_audit_ajax();

		// phpcs:disable WordPress.Security.NonceVerification.Missing -- Nonce is verified by verify_image_audit_ajax().
		$scan_id = isset($_POST['scan_id']) ? sanitize_text_field(wp_unslash($_POST['scan_id'])) : '';
		$offset = isset($_POST['offset']) ? max(0, absint($_POST['offset'])) : 0;
		$batch_number = isset($_POST['batch']) ? max(1, absint($_POST['batch'])) : 1;
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		if ('' === $scan_id || $scan_id !== (string) get_option('optivra_latest_scan_id', '')) {
			$this->send_audit_error(__('This scan is no longer active. Start a new scan and try again.', 'optivra-image-studio-for-woocommerce'));
		}

		$options = $this->get_audit_options_from_ajax();
		$progress = $this->get_audit_progress();
		$total_products = max(0, (int) ($progress['total_products'] ?? 0));
		$batch = $this->plugin->scanner()->collect_audit_batch($options, $offset, 25);
		$items = isset($batch['items']) && is_array($batch['items']) ? $batch['items'] : [];

		foreach (array_chunk($items, 75) as $chunk) {
			$result = $this->plugin->client()->submit_image_audit_items($scan_id, $chunk);
			if (is_wp_error($result)) {
				$progress['status'] = 'failed';
				$progress['status_label'] = __('Failed', 'optivra-image-studio-for-woocommerce');
				$progress['message'] = $result->get_error_message();
				$progress['errors'][] = $result->get_error_message();
				$this->save_audit_progress($progress);
				$this->send_audit_error($result->get_error_message());
			}
		}

		$summary = isset($batch['summary']) && is_array($batch['summary']) ? $batch['summary'] : [];
		$next_offset = isset($batch['next_offset']) ? max(0, absint($batch['next_offset'])) : $offset + 25;
		$done = empty($batch['has_more']) || ($total_products > 0 && $next_offset >= $total_products);

		$progress['status'] = 'running';
		$progress['status_label'] = __('Running', 'optivra-image-studio-for-woocommerce');
		$progress['products_scanned'] = $total_products > 0 ? min($total_products, $next_offset) : $next_offset;
		$progress['images_scanned'] = (int) ($progress['images_scanned'] ?? 0) + (int) ($summary['images_scanned'] ?? count($items));
		$progress['current_batch'] = $batch_number;
		$progress['warnings'] = array_values(array_unique(array_merge((array) ($progress['warnings'] ?? []), (array) ($batch['warnings'] ?? []))));
		$progress['errors'] = array_values(array_unique(array_merge((array) ($progress['errors'] ?? []), (array) ($batch['errors'] ?? []))));
		$progress['message'] = $done
			? __('Metadata collection finished. Optivra is calculating the health report.', 'optivra-image-studio-for-woocommerce')
			: __('Metadata batch submitted successfully.', 'optivra-image-studio-for-woocommerce');
		$progress = $this->save_audit_progress($progress);

		wp_send_json_success(['done' => $done, 'next_offset' => $next_offset, 'progress' => $progress]);
	}

	public function ajax_image_audit_complete(): void {
		$this->verify_image_audit_ajax();

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by verify_image_audit_ajax().
		$scan_id = isset($_POST['scan_id']) ? sanitize_text_field(wp_unslash($_POST['scan_id'])) : '';
		if ('' === $scan_id || $scan_id !== (string) get_option('optivra_latest_scan_id', '')) {
			$this->send_audit_error(__('This scan is no longer active. Start a new scan and try again.', 'optivra-image-studio-for-woocommerce'));
		}

		$result = $this->plugin->client()->complete_image_audit($scan_id);
		if (is_wp_error($result)) {
			$progress = $this->get_audit_progress();
			$progress['status'] = 'failed';
			$progress['status_label'] = __('Failed', 'optivra-image-studio-for-woocommerce');
			$progress['message'] = $result->get_error_message();
			$this->save_audit_progress($progress);
			update_option('optivra_scan_in_progress', false, false);
			$this->send_audit_error($result->get_error_message());
		}

		$summary = is_array($result) ? $result : [];
		$progress = $this->get_audit_progress();
		$store_id = (string) get_option('optivra_latest_audit_store_id', '');
		if ('' !== $store_id) {
			$latest = $this->plugin->client()->get_latest_image_audit($store_id);
			if (! is_wp_error($latest) && is_array($latest)) {
				$summary = $latest;
			}
		}
		$full_report = $this->plugin->client()->get_image_audit($scan_id);
		if (! is_wp_error($full_report) && is_array($full_report)) {
			$summary = $full_report;
		}
		$score = $this->extract_health_score($summary);
		update_option('optivra_latest_health_score', $score, false);
		update_option('optivra_last_scan_completed_at', current_time('mysql'), false);
		update_option('optivra_scan_in_progress', false, false);
		$this->save_report_summary($scan_id, $summary, $score);

		$progress['status'] = 'completed';
		$progress['status_label'] = __('Completed', 'optivra-image-studio-for-woocommerce');
		$progress['message'] = __('Product Image Health Report completed. Scanning did not consume image processing credits.', 'optivra-image-studio-for-woocommerce');
		$progress['completed_at'] = current_time('mysql');
		$progress = $this->save_audit_progress($progress);

		wp_send_json_success(['progress' => $progress, 'summary' => $this->summarize_report_for_ui($summary, $score)]);
	}

	public function ajax_image_audit_cancel(): void {
		$this->verify_image_audit_ajax();

		update_option('optivra_scan_in_progress', false, false);
		$progress = $this->get_audit_progress();
		$progress['status'] = 'cancelled';
		$progress['status_label'] = __('Cancelled', 'optivra-image-studio-for-woocommerce');
		$progress['message'] = __('The local scan loop was cancelled. No image processing credits were used.', 'optivra-image-studio-for-woocommerce');
		$progress = $this->save_audit_progress($progress);

		wp_send_json_success(['progress' => $progress]);
	}

	private function verify_image_audit_ajax(): void {
		if (! current_user_can(self::CAPABILITY)) {
			wp_send_json_error(['message' => __('You do not have permission to run scans.', 'optivra-image-studio-for-woocommerce')], 403);
		}

		check_ajax_referer('optivra_image_audit_scan', 'nonce');
	}

	/**
	 * @return array<string,mixed>
	 */
	private function get_audit_options_from_ajax(): array {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified by verify_image_audit_ajax().
		$raw = isset($_POST['options']) ? (string) wp_unslash($_POST['options']) : '{}';
		$decoded = json_decode($raw, true);
		$decoded = is_array($decoded) ? $decoded : [];

		$scope = sanitize_key((string) ($decoded['scan_scope'] ?? 'all'));
		if (! in_array($scope, ['all', 'categories', 'missing_main', 'updated_since_last_scan', 'unprocessed'], true)) {
			$scope = 'all';
		}

		$image_types = isset($decoded['image_types']) && is_array($decoded['image_types']) ? array_map('sanitize_key', $decoded['image_types']) : [];
		$checks = isset($decoded['checks']) && is_array($decoded['checks']) ? array_map('sanitize_key', $decoded['checks']) : [];
		$category_ids = isset($decoded['category_ids']) && is_array($decoded['category_ids']) ? array_values(array_filter(array_map('absint', $decoded['category_ids']))) : [];

		if (empty($image_types)) {
			$image_types = ['main'];
		}

		$options = [
			'scan_scope'                  => $scope,
			'status'                      => 'publish',
			'category_ids'                => 'categories' === $scope ? $category_ids : [],
			'include_main_images'         => in_array('main', $image_types, true),
			'include_gallery_images'      => in_array('gallery', $image_types, true),
			'include_variation_images'    => in_array('variation', $image_types, true),
			'include_category_thumbnails' => in_array('category', $image_types, true),
			'checks'                      => array_values(array_intersect($checks, ['seo', 'performance', 'consistency', 'feed_readiness', 'visual_quality'])),
		];

		if ('updated_since_last_scan' === $scope) {
			$last_completed = (string) get_option('optivra_last_scan_completed_at', '');
			if ('' !== $last_completed) {
				$options['updated_since'] = $last_completed;
			}
		}

		return $options;
	}

	/**
	 * @param array<string,mixed> $usage Usage response.
	 */
	private function get_audit_store_id(array $usage): string {
		$candidates = [
			$usage['store_id'] ?? '',
			$usage['site_id'] ?? '',
		];

		if (isset($usage['store']) && is_array($usage['store'])) {
			$candidates[] = $usage['store']['id'] ?? '';
		}

		if (isset($usage['site']) && is_array($usage['site'])) {
			$candidates[] = $usage['site']['id'] ?? '';
		}

		foreach ($candidates as $candidate) {
			if (is_scalar($candidate) && '' !== (string) $candidate) {
				return sanitize_text_field((string) $candidate);
			}
		}

		$install_id = (string) get_option('optivra_image_studio_install_id', '');
		if ('' === $install_id) {
			$install_id = wp_generate_uuid4();
			update_option('optivra_image_studio_install_id', $install_id, false);
		}

		return sanitize_text_field($install_id);
	}

	/**
	 * @param array<string,mixed> $payload API payload.
	 */
	private function extract_scan_id(array $payload): string {
		$candidates = [
			$payload['scan_id'] ?? '',
			$payload['id'] ?? '',
			$payload['scan']['id'] ?? '',
		];

		foreach ($candidates as $candidate) {
			if (is_scalar($candidate) && '' !== (string) $candidate) {
				return sanitize_text_field((string) $candidate);
			}
		}

		return '';
	}

	/**
	 * @return array<string,mixed>
	 */
	private function get_audit_progress(): array {
		$progress = get_option('optivra_scan_progress', []);

		return is_array($progress) ? $progress : [];
	}

	/**
	 * @param array<string,mixed> $progress Progress.
	 * @return array<string,mixed>
	 */
	private function save_audit_progress(array $progress): array {
		$progress['updated_at'] = current_time('mysql');
		update_option('optivra_scan_progress', $progress, false);

		return $progress;
	}

	/**
	 * @param array<string,mixed> $summary Report summary.
	 */
	private function extract_health_score(array $summary): float {
		$candidates = [
			$summary['metrics']['product_image_health_score'] ?? null,
			$summary['metrics']['productImageHealthScore'] ?? null,
			$summary['product_image_health_score'] ?? null,
			$summary['health_score'] ?? null,
		];

		foreach ($candidates as $candidate) {
			if (is_numeric($candidate)) {
				return max(0, min(100, (float) $candidate));
			}
		}

		return 0.0;
	}

	/**
	 * @param array<string,mixed> $summary Report summary.
	 */
	private function save_report_summary(string $scan_id, array $summary, float $score): void {
		$cache = get_option('optivra_report_summary_cache', []);
		$cache = is_array($cache) ? $cache : [];
		$history = isset($cache['history']) && is_array($cache['history']) ? $cache['history'] : [];
		$progress = $this->get_audit_progress();
		$row = [
			'scan_id'          => $scan_id,
			'created_at'       => current_time('mysql'),
			'products_scanned' => (int) ($progress['products_scanned'] ?? 0),
			'images_scanned'   => (int) ($progress['images_scanned'] ?? 0),
			'health_score'     => $score,
			'issues_found'     => $this->extract_issue_count($summary),
			'status'           => 'completed',
		];

		array_unshift($history, $row);
		$cache['latest'] = $this->summarize_report_for_ui($summary, $score) + $row;
		$cache['history'] = array_slice($history, 0, 10);

		update_option('optivra_report_summary_cache', $cache, false);
	}

	/**
	 * @param array<string,mixed> $summary Report summary.
	 */
	private function extract_issue_count(array $summary): int {
		$candidates = [
			$summary['issue_counts']['total'] ?? null,
			$summary['issue_summary']['total'] ?? null,
			$summary['issues_found'] ?? null,
			$summary['metrics']['issue_count'] ?? null,
		];

		foreach ($candidates as $candidate) {
			if (is_numeric($candidate)) {
				return max(0, (int) $candidate);
			}
		}

		return 0;
	}

	/**
	 * @param array<string,mixed> $summary Report summary.
	 * @return array<string,mixed>
	 */
	private function summarize_report_for_ui(array $summary, float $score): array {
		return [
			'health_score' => $score,
			'issues_found' => $this->extract_issue_count($summary),
			'raw'          => $summary,
		];
	}

	/**
	 * @param array<string,mixed> $latest Cached latest report row.
	 * @return array<string,mixed>
	 */
	private function get_report_payload(array $latest): array {
		if (isset($latest['raw']) && is_array($latest['raw'])) {
			return $latest['raw'];
		}

		return $latest;
	}

	/**
	 * @param array<string,mixed> $report Report payload.
	 * @return array<string,mixed>
	 */
	private function get_report_metrics(array $report): array {
		return isset($report['metrics']) && is_array($report['metrics']) ? $report['metrics'] : $report;
	}

	/**
	 * @param array<string,mixed> $source Source array.
	 * @param array<int,string>   $keys Candidate keys.
	 */
	private function report_number(array $source, array $keys, float $default = 0): float {
		foreach ($keys as $key) {
			if (isset($source[$key]) && is_numeric($source[$key])) {
				return (float) $source[$key];
			}
		}

		return $default;
	}

	/**
	 * @param array<string,mixed> $source Source array.
	 * @param array<int,string>   $keys Candidate keys.
	 */
	private function report_text(array $source, array $keys, string $default = ''): string {
		foreach ($keys as $key) {
			if (isset($source[$key]) && is_scalar($source[$key]) && '' !== trim((string) $source[$key])) {
				return sanitize_text_field((string) $source[$key]);
			}
		}

		return $default;
	}

	/**
	 * @param array<string,mixed> $source Source array.
	 * @param array<int,string>   $keys Candidate list keys.
	 * @return array<int,array<string,mixed>>
	 */
	private function report_list(array $source, array $keys, int $limit): array {
		foreach ($keys as $key) {
			if (! isset($source[$key]) || ! is_array($source[$key])) {
				continue;
			}

			$list = [];
			foreach ($source[$key] as $item) {
				if (is_array($item)) {
					$list[] = $item;
				}
			}

			return array_slice($list, 0, $limit);
		}

		return [];
	}

	/**
	 * @param array<string,mixed> $issue_summary Issue summary.
	 */
	private function render_issue_summary_cards(array $issue_summary): void {
		$by_type = isset($issue_summary['by_issue_type']) && is_array($issue_summary['by_issue_type']) ? $issue_summary['by_issue_type'] : [];
		$rows = [];

		foreach ($by_type as $issue_type => $count) {
			if (is_numeric($count) && (int) $count > 0) {
				$rows[sanitize_key((string) $issue_type)] = (int) $count;
			}
		}

		arsort($rows);
		$rows = array_slice($rows, 0, 6, true);

		if (empty($rows)) {
			$this->render_empty_state(__('No issue summary available', 'optivra-image-studio-for-woocommerce'), __('Optivra will show ranked issue types here after the report includes issue counts.', 'optivra-image-studio-for-woocommerce'));
			return;
		}

		foreach ($rows as $issue_type => $count) {
			$severity = $count >= 25 ? 'high' : ($count >= 8 ? 'medium' : 'low');
			?>
			<div class="optivra-issue-row">
				<div>
					<strong><?php echo esc_html($this->get_issue_type_label($issue_type)); ?></strong>
					<small><?php echo esc_html(sprintf(_n('%d image affected', '%d images affected', $count, 'optivra-image-studio-for-woocommerce'), $count)); ?></small>
				</div>
				<?php $this->render_severity_badge($severity); ?>
			</div>
			<?php
		}
	}

	private function get_issue_type_label(string $issue_type): string {
		$labels = [
			'missing_alt_text'            => __('Missing alt text', 'optivra-image-studio-for-woocommerce'),
			'oversized_file'              => __('Oversized files', 'optivra-image-studio-for-woocommerce'),
			'generic_filename'            => __('Generic filenames', 'optivra-image-studio-for-woocommerce'),
			'inconsistent_aspect_ratio'   => __('Inconsistent aspect ratios', 'optivra-image-studio-for-woocommerce'),
			'missing_main_image'          => __('Products missing images', 'optivra-image-studio-for-woocommerce'),
			'product_has_single_image'    => __('Products with only one image', 'optivra-image-studio-for-woocommerce'),
			'missing_webp'                => __('Modern image format opportunities', 'optivra-image-studio-for-woocommerce'),
			'low_resolution'              => __('Low resolution images', 'optivra-image-studio-for-woocommerce'),
			'google_readiness_warning'    => __('Product feed readiness warnings', 'optivra-image-studio-for-woocommerce'),
			'watermark_or_text_overlay'   => __('Watermark or text overlays', 'optivra-image-studio-for-woocommerce'),
		];

		return $labels[$issue_type] ?? ucwords(str_replace('_', ' ', sanitize_key($issue_type)));
	}

	/**
	 * @param array<string,mixed> $recommendation Recommendation row.
	 */
	private function render_audit_recommendation_card(array $recommendation): void {
		$title = $this->report_text($recommendation, ['title'], __('Recommended fix', 'optivra-image-studio-for-woocommerce'));
		$description = $this->report_text($recommendation, ['description', 'body'], '');
		$priority = $this->report_text($recommendation, ['priority', 'severity'], 'medium');
		$affected = (int) $this->report_number($recommendation, ['estimated_images_affected', 'images_affected'], 0);
		$minutes_low = (int) $this->report_number($recommendation, ['estimated_minutes_saved_low'], 0);
		$minutes_high = (int) $this->report_number($recommendation, ['estimated_minutes_saved_high'], 0);
		?>
		<section class="optivra-recommendation-card">
			<div class="optivra-card-topline">
				<h3><?php echo esc_html($title); ?></h3>
				<?php $this->render_severity_badge($priority); ?>
			</div>
			<p><?php echo esc_html($description); ?></p>
			<div class="optivra-rec-meta">
				<span><?php echo esc_html(sprintf(_n('%d image affected', '%d images affected', $affected, 'optivra-image-studio-for-woocommerce'), $affected)); ?></span>
				<span><?php echo esc_html(sprintf(__('%1$d-%2$d min saved', 'optivra-image-studio-for-woocommerce'), $minutes_low, $minutes_high)); ?></span>
			</div>
			<div class="optivra-rec-actions">
				<button type="button" class="button optivra-action-button is-secondary" disabled><?php echo esc_html__('Add to Queue', 'optivra-image-studio-for-woocommerce'); ?> - <?php echo esc_html__('Coming soon', 'optivra-image-studio-for-woocommerce'); ?></button>
				<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_admin_page_url('review')); ?>"><?php echo esc_html__('Review', 'optivra-image-studio-for-woocommerce'); ?></a>
			</div>
		</section>
		<?php
	}

	private function send_audit_error(string $message): void {
		wp_send_json_error(['message' => esc_html($message)], 400);
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
		if (! current_user_can(self::CAPABILITY)) {
			wp_die(esc_html__('You do not have permission to access this page.', 'optivra-image-studio-for-woocommerce'));
		}

		$settings = $this->plugin->get_settings();
		$usage    = $this->get_usage();
		$jobs     = $this->plugin->jobs()->query([], 100, 0);
		$connected = ! is_wp_error($usage);
		$tab       = $this->get_current_tab();
		$page_meta = $this->get_page_meta($tab);
		?>
		<div class="wrap optivra-admin-app catalogue-image-studio-admin">
			<?php $this->render_app_shell_header($tab, $page_meta, $settings, $usage); ?>
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
					case 'health':
						$this->render_health_report_tab($settings);
						break;
					case 'recommendations':
						$this->render_recommendations_tab();
						break;
					case 'queue':
						$this->render_queue_tab($usage);
						break;
					case 'review':
						$this->render_review_tab();
						break;
					case 'backgrounds':
						$this->render_backgrounds_tab($settings);
						break;
					case 'seo':
						$this->render_seo_tools_tab($settings);
						break;
					case 'settings':
						$this->render_settings_tab($settings, $usage);
						break;
					case 'account':
						$this->render_account_billing_tab($settings, $usage);
						break;
					case 'support':
						$this->render_support_tab();
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
		$page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : self::MENU_SLUG;
		$slug_map = [
			self::MENU_SLUG                         => 'dashboard',
			self::LEGACY_MENU_SLUG                  => 'dashboard',
			'optivra-image-studio-scan'             => 'scan',
			'optivra-image-studio-health'           => 'health',
			'optivra-image-studio-recommendations'  => 'recommendations',
			'optivra-image-studio-queue'            => 'queue',
			'optivra-image-studio-backgrounds'      => 'backgrounds',
			'optivra-image-studio-seo'              => 'seo',
			'optivra-image-studio-settings'         => 'settings',
			'optivra-image-studio-account'          => 'account',
			'optivra-image-studio-support'          => 'support',
		];
		$tab = $slug_map[$page] ?? 'dashboard';

		if (isset($_GET['cis_tab'])) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only legacy navigation parameter.
			$tab = sanitize_key(wp_unslash($_GET['cis_tab']));
		}

		return in_array($tab, ['dashboard', 'scan', 'health', 'recommendations', 'queue', 'review', 'backgrounds', 'seo', 'settings', 'account', 'support', 'logs'], true) ? $tab : 'dashboard';
	}

	/**
	 * @return array{title:string,description:string}
	 */
	private function get_page_meta(string $tab): array {
		$pages = [
			'dashboard'       => [
				'title'       => __('Dashboard', 'optivra-image-studio-for-woocommerce'),
				'description' => __('A command centre for product image scans, queue status, approvals, credits and account health.', 'optivra-image-studio-for-woocommerce'),
			],
			'scan'            => [
				'title'       => __('Product Scan', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Find WooCommerce product, gallery and category images that are ready for optimisation.', 'optivra-image-studio-for-woocommerce'),
			],
			'health'          => [
				'title'       => __('Health Report', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Audit catalogue images for SEO, completeness, consistency, performance and feed readiness.', 'optivra-image-studio-for-woocommerce'),
			],
			'recommendations' => [
				'title'       => __('Recommendations', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Prioritise the product-image fixes most likely to improve catalogue quality and conversion confidence.', 'optivra-image-studio-for-woocommerce'),
			],
			'queue'           => [
				'title'       => __('Processing Queue', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Process, retry and cancel image jobs while keeping approval and credit controls intact.', 'optivra-image-studio-for-woocommerce'),
			],
			'review'          => [
				'title'       => __('Review Images', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Approve, reject, retry or revert processed images before WooCommerce product images are replaced.', 'optivra-image-studio-for-woocommerce'),
			],
			'backgrounds'     => [
				'title'       => __('Backgrounds', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Manage clean product background defaults and custom background assets.', 'optivra-image-studio-for-woocommerce'),
			],
			'seo'             => [
				'title'       => __('SEO Tools', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Control generated filenames, alt text, titles, captions and attachment metadata behaviour.', 'optivra-image-studio-for-woocommerce'),
			],
			'settings'        => [
				'title'       => __('Settings', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Configure connection, processing defaults, safety rules, backgrounds, framing and metadata.', 'optivra-image-studio-for-woocommerce'),
			],
			'account'         => [
				'title'       => __('Account & Billing', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Review connection status, credits and billing links without exposing saved API tokens.', 'optivra-image-studio-for-woocommerce'),
			],
			'support'         => [
				'title'       => __('Support', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Find diagnostics, failed-job context and support links when you need help.', 'optivra-image-studio-for-woocommerce'),
			],
			'logs'            => [
				'title'       => __('Diagnostics', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Debug-focused job and connection details for authorised administrators.', 'optivra-image-studio-for-woocommerce'),
			],
		];

		return $pages[$tab] ?? $pages['dashboard'];
	}

	/**
	 * @param array{title:string,description:string} $page_meta Page metadata.
	 * @param array<string,mixed> $settings Settings.
	 * @param array<string,mixed>|\WP_Error $usage Usage.
	 */
	private function render_app_shell_header(string $tab, array $page_meta, array $settings, $usage): void {
		$connected = ! is_wp_error($usage);
		?>
		<header class="optivra-app-header">
			<div class="optivra-brand-block">
				<div class="optivra-brand-mark" aria-hidden="true">O</div>
				<div>
					<p class="optivra-kicker"><?php echo esc_html__('Optivra Image Studio', 'optivra-image-studio-for-woocommerce'); ?></p>
					<h1><?php echo esc_html($page_meta['title']); ?></h1>
					<p class="catalogue-image-studio-page-intro"><?php echo esc_html($page_meta['description']); ?></p>
				</div>
			</div>
			<div class="optivra-header-actions">
				<?php $this->render_status_badge($connected ? __('Ready', 'optivra-image-studio-for-woocommerce') : __('Needs Review', 'optivra-image-studio-for-woocommerce'), $connected ? 'ready' : 'needs-review'); ?>
				<?php $this->render_action_button(__('Scan Products', 'optivra-image-studio-for-woocommerce'), $this->get_admin_page_url('scan'), 'primary'); ?>
				<?php $this->render_action_button(__('Settings', 'optivra-image-studio-for-woocommerce'), $this->get_admin_page_url('settings'), 'secondary'); ?>
				<?php if (! empty($settings['debug_mode'])) : ?>
					<?php $this->render_status_badge(__('Debug Mode', 'optivra-image-studio-for-woocommerce'), 'processing'); ?>
				<?php endif; ?>
			</div>
		</header>
		<?php
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
					<a class="button button-primary" href="<?php echo esc_url($this->get_admin_page_url('scan')); ?>"><?php echo esc_html__('Scan Catalogue', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_admin_page_url('review')); ?>"><?php echo esc_html__('Review Images', 'optivra-image-studio-for-woocommerce'); ?></a>
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
		$this->render_metric_card($label, (string) $value);
	}

	private function render_metric_card(string $label, string $value, string $context = ''): void {
		?>
		<div class="optivra-metric-card catalogue-image-studio-metric">
			<span><?php echo esc_html($label); ?></span>
			<strong><?php echo esc_html((string) $value); ?></strong>
			<?php if ('' !== $context) : ?>
				<small><?php echo esc_html($context); ?></small>
			<?php endif; ?>
		</div>
		<?php
	}

	private function render_score_card(string $label, float $score, string $description = ''): void {
		$score = max(0, min(100, $score));
		?>
		<div class="optivra-score-card">
			<div>
				<span><?php echo esc_html($label); ?></span>
				<strong><?php echo esc_html(number_format_i18n($score, 0)); ?></strong>
			</div>
			<div class="optivra-score-ring" style="<?php echo esc_attr('--optivra-score:' . (string) $score . '%'); ?>" aria-hidden="true"></div>
			<?php if ('' !== $description) : ?>
				<p><?php echo esc_html($description); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}

	private function render_insight_card(string $title, string $body, string $severity = 'info'): void {
		?>
		<section class="optivra-insight-card">
			<div class="optivra-card-topline">
				<h3><?php echo esc_html($title); ?></h3>
				<?php $this->render_severity_badge($severity); ?>
			</div>
			<p><?php echo esc_html($body); ?></p>
		</section>
		<?php
	}

	private function render_recommendation_card(string $title, string $body, string $priority = 'medium', string $action_url = ''): void {
		?>
		<section class="optivra-recommendation-card">
			<div class="optivra-card-topline">
				<h3><?php echo esc_html($title); ?></h3>
				<?php $this->render_severity_badge($priority); ?>
			</div>
			<p><?php echo esc_html($body); ?></p>
			<?php if ('' !== $action_url) : ?>
				<?php $this->render_action_button(__('Open', 'optivra-image-studio-for-woocommerce'), $action_url, 'secondary'); ?>
			<?php endif; ?>
		</section>
		<?php
	}

	private function render_severity_badge(string $severity): void {
		$severity = sanitize_key($severity);
		$labels = [
			'critical' => __('Critical', 'optivra-image-studio-for-woocommerce'),
			'high'     => __('High', 'optivra-image-studio-for-woocommerce'),
			'medium'   => __('Medium', 'optivra-image-studio-for-woocommerce'),
			'low'      => __('Low', 'optivra-image-studio-for-woocommerce'),
			'info'     => __('Info', 'optivra-image-studio-for-woocommerce'),
		];
		?>
		<span class="optivra-severity-badge is-<?php echo esc_attr(isset($labels[$severity]) ? $severity : 'info'); ?>"><?php echo esc_html($labels[$severity] ?? $labels['info']); ?></span>
		<?php
	}

	private function render_status_badge(string $label, string $status): void {
		$status = sanitize_key($status);
		?>
		<span class="optivra-status-badge is-<?php echo esc_attr($status); ?>"><?php echo esc_html($label); ?></span>
		<?php
	}

	private function render_empty_state(string $title, string $body, string $action_label = '', string $action_url = ''): void {
		?>
		<div class="optivra-empty-state catalogue-image-studio-empty-state">
			<div class="optivra-empty-icon" aria-hidden="true"></div>
			<h3><?php echo esc_html($title); ?></h3>
			<p><?php echo esc_html($body); ?></p>
			<?php if ('' !== $action_label && '' !== $action_url) : ?>
				<?php $this->render_action_button($action_label, $action_url, 'primary'); ?>
			<?php endif; ?>
		</div>
		<?php
	}

	private function render_loading_state(string $label): void {
		?>
		<div class="optivra-loading-state" aria-live="polite">
			<span aria-hidden="true"></span>
			<?php echo esc_html($label); ?>
		</div>
		<?php
	}

	private function render_scan_progress(int $current, int $total): void {
		$percent = $total > 0 ? min(100, max(0, ($current / $total) * 100)) : 0;
		?>
		<div class="optivra-scan-progress">
			<div class="optivra-scan-progress-meta">
				<span><?php echo esc_html__('Scan progress', 'optivra-image-studio-for-woocommerce'); ?></span>
				<strong><?php echo esc_html(sprintf('%d / %d', $current, $total)); ?></strong>
			</div>
			<div class="optivra-progress-track"><span style="<?php echo esc_attr('width:' . (string) $percent . '%'); ?>"></span></div>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $progress Progress state.
	 */
	private function get_scan_progress_percent(array $progress): int {
		$total = max(0, (int) ($progress['total_products'] ?? 0));
		$current = max(0, (int) ($progress['products_scanned'] ?? 0));

		return $total > 0 ? (int) min(100, max(0, round(($current / $total) * 100))) : 0;
	}

	private function render_action_button(string $label, string $url, string $variant = 'secondary'): void {
		$variant = in_array($variant, ['primary', 'secondary', 'danger'], true) ? $variant : 'secondary';
		?>
		<a class="button optivra-action-button is-<?php echo esc_attr($variant); ?>" href="<?php echo esc_url($url); ?>"><?php echo esc_html($label); ?></a>
		<?php
	}

	private function render_settings_section(string $title, string $description): void {
		?>
		<div class="optivra-card-header">
			<h3><?php echo esc_html($title); ?></h3>
			<p><?php echo esc_html($description); ?></p>
		</div>
		<?php
	}

	private function render_scan_tab(): void {
		$categories = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
		$progress = $this->get_audit_progress();
		$scan_in_progress = (bool) get_option('optivra_scan_in_progress', false);
		$cache = get_option('optivra_report_summary_cache', []);
		$cache = is_array($cache) ? $cache : [];
		$history = isset($cache['history']) && is_array($cache['history']) ? $cache['history'] : [];
		?>
		<div class="catalogue-image-studio-panel optivra-scan-wizard">
			<div class="optivra-card-header">
				<h2><?php echo esc_html__('Product Image Health Scan', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<p><?php echo esc_html__('Scan WooCommerce product image metadata, send it to Optivra in safe batches, and generate a free Product Image Health Report.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>

			<form id="optivra-audit-scan-form" class="optivra-scan-form">
				<section class="optivra-wizard-section">
					<div class="optivra-wizard-heading">
						<span>1</span>
						<div>
							<h3><?php echo esc_html__('Scan Scope', 'optivra-image-studio-for-woocommerce'); ?></h3>
							<p><?php echo esc_html__('Choose the product set to audit. Large catalogues are scanned in small background batches.', 'optivra-image-studio-for-woocommerce'); ?></p>
						</div>
					</div>
					<div class="optivra-option-grid">
						<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="all" checked /><span><?php echo esc_html__('All products', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Audit every published WooCommerce product.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
						<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="categories" /><span><?php echo esc_html__('Selected categories', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Limit the report to the categories selected below.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
						<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="missing_main" /><span><?php echo esc_html__('Products missing main images', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Find catalogue gaps that affect trust and feeds.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
						<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="updated_since_last_scan" /><span><?php echo esc_html__('Updated since last scan', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Audit recently changed product imagery.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
						<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="unprocessed" /><span><?php echo esc_html__('Products with unprocessed images', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Focus on images not yet processed by Optivra.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
					</div>
					<?php if (! is_wp_error($categories) && ! empty($categories)) : ?>
						<div class="optivra-category-picker">
							<strong><?php echo esc_html__('Categories', 'optivra-image-studio-for-woocommerce'); ?></strong>
							<div>
								<?php foreach ($categories as $category) : ?>
									<label><input type="checkbox" name="category_ids[]" value="<?php echo esc_attr((string) $category->term_id); ?>" /> <?php echo esc_html($category->name); ?></label>
								<?php endforeach; ?>
							</div>
						</div>
					<?php endif; ?>
				</section>

				<section class="optivra-wizard-section">
					<div class="optivra-wizard-heading">
						<span>2</span>
						<div>
							<h3><?php echo esc_html__('Image Types', 'optivra-image-studio-for-woocommerce'); ?></h3>
							<p><?php echo esc_html__('Select which WooCommerce image roles should be included in the report.', 'optivra-image-studio-for-woocommerce'); ?></p>
						</div>
					</div>
					<div class="optivra-switch-grid">
						<label><input type="checkbox" name="image_types[]" value="main" checked /> <span><?php echo esc_html__('Main product images', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						<label><input type="checkbox" name="image_types[]" value="gallery" checked /> <span><?php echo esc_html__('Gallery images', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						<label><input type="checkbox" name="image_types[]" value="variation" checked /> <span><?php echo esc_html__('Variation images', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						<label><input type="checkbox" name="image_types[]" value="category" /> <span><?php echo esc_html__('Category thumbnails', 'optivra-image-studio-for-woocommerce'); ?></span></label>
					</div>
				</section>

				<section class="optivra-wizard-section">
					<div class="optivra-wizard-heading">
						<span>3</span>
						<div>
							<h3><?php echo esc_html__('Checks', 'optivra-image-studio-for-woocommerce'); ?></h3>
							<p><?php echo esc_html__('The audit uses deterministic metadata checks and placeholders for visual scoring where available.', 'optivra-image-studio-for-woocommerce'); ?></p>
						</div>
					</div>
					<div class="optivra-switch-grid">
						<label><input type="checkbox" name="checks[]" value="seo" checked /> <span><?php echo esc_html__('Image SEO metadata', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						<label><input type="checkbox" name="checks[]" value="performance" checked /> <span><?php echo esc_html__('File size / performance', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						<label><input type="checkbox" name="checks[]" value="consistency" checked /> <span><?php echo esc_html__('Catalogue consistency', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						<label><input type="checkbox" name="checks[]" value="feed_readiness" checked /> <span><?php echo esc_html__('Product feed readiness estimate', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						<label><input type="checkbox" name="checks[]" value="visual_quality" /> <span><?php echo esc_html__('Visual quality placeholders', 'optivra-image-studio-for-woocommerce'); ?></span></label>
					</div>
				</section>

				<div class="optivra-scan-actions">
					<button type="button" id="optivra-audit-start" class="button button-primary optivra-action-button is-primary"><?php echo esc_html__('Start Scan', 'optivra-image-studio-for-woocommerce'); ?></button>
					<button type="button" id="optivra-audit-cancel" class="button optivra-action-button is-secondary" <?php echo $scan_in_progress ? '' : 'hidden'; ?>><?php echo esc_html__('Cancel Scan', 'optivra-image-studio-for-woocommerce'); ?></button>
					<span><?php echo esc_html__('Scans are free and do not consume image processing credits.', 'optivra-image-studio-for-woocommerce'); ?></span>
				</div>
			</form>

			<div id="optivra-audit-scan-progress" class="optivra-scan-progress-panel" <?php echo empty($progress) && ! $scan_in_progress ? 'hidden' : ''; ?>>
				<div class="optivra-scan-progress-meta">
					<span><?php echo esc_html__('Scan status', 'optivra-image-studio-for-woocommerce'); ?></span>
					<strong data-optivra-scan-status><?php echo esc_html((string) ($progress['status_label'] ?? __('Ready', 'optivra-image-studio-for-woocommerce'))); ?></strong>
				</div>
				<div class="optivra-progress-track"><span data-optivra-scan-bar style="<?php echo esc_attr('width:' . $this->get_scan_progress_percent($progress) . '%'); ?>"></span></div>
				<div class="optivra-progress-grid">
					<div><span><?php echo esc_html__('Products scanned', 'optivra-image-studio-for-woocommerce'); ?></span><strong data-optivra-scan-products><?php echo esc_html((string) ((int) ($progress['products_scanned'] ?? 0)) . ' / ' . (string) ((int) ($progress['total_products'] ?? 0))); ?></strong></div>
					<div><span><?php echo esc_html__('Images scanned', 'optivra-image-studio-for-woocommerce'); ?></span><strong data-optivra-scan-images><?php echo esc_html((string) (int) ($progress['images_scanned'] ?? 0)); ?></strong></div>
					<div><span><?php echo esc_html__('Current batch', 'optivra-image-studio-for-woocommerce'); ?></span><strong data-optivra-scan-batch><?php echo esc_html((string) (int) ($progress['current_batch'] ?? 0)); ?></strong></div>
					<div><span><?php echo esc_html__('Start time', 'optivra-image-studio-for-woocommerce'); ?></span><strong data-optivra-scan-started><?php echo esc_html((string) ($progress['started_at'] ?? '')); ?></strong></div>
				</div>
				<p data-optivra-scan-message><?php echo esc_html((string) ($progress['message'] ?? '')); ?></p>
				<?php if (! empty($progress['warnings']) && is_array($progress['warnings'])) : ?>
					<ul class="optivra-scan-warnings"><?php foreach (array_slice($progress['warnings'], 0, 5) as $warning) : ?><li><?php echo esc_html((string) $warning); ?></li><?php endforeach; ?></ul>
				<?php endif; ?>
			</div>
		</div>

		<div class="catalogue-image-studio-panel optivra-scan-history">
			<div class="optivra-card-header">
				<h2><?php echo esc_html__('Scan History', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<p><?php echo esc_html__('Recent Product Image Health Report scans for this WooCommerce store.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>
			<table class="widefat fixed striped">
				<thead><tr><th><?php echo esc_html__('Date', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Products', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Images', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Health Score', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Issues', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></th><th><?php echo esc_html__('Report', 'optivra-image-studio-for-woocommerce'); ?></th></tr></thead>
				<tbody>
					<?php if (empty($history)) : ?>
						<tr><td colspan="7"><?php $this->render_empty_state(__('No scan history yet', 'optivra-image-studio-for-woocommerce'), __('Run your first Product Image Health scan to create a report history.', 'optivra-image-studio-for-woocommerce')); ?></td></tr>
					<?php else : ?>
						<?php foreach ($history as $row) : ?>
							<tr>
								<td><?php echo esc_html((string) ($row['created_at'] ?? '')); ?></td>
								<td><?php echo esc_html((string) (int) ($row['products_scanned'] ?? 0)); ?></td>
								<td><?php echo esc_html((string) (int) ($row['images_scanned'] ?? 0)); ?></td>
								<td><?php echo esc_html(number_format_i18n((float) ($row['health_score'] ?? 0), 0)); ?></td>
								<td><?php echo esc_html((string) (int) ($row['issues_found'] ?? 0)); ?></td>
								<td><?php $this->render_status_badge($this->format_status((string) ($row['status'] ?? 'completed')), 'approved'); ?></td>
								<td><a class="button" href="<?php echo esc_url($this->get_admin_page_url('health')); ?>"><?php echo esc_html__('View report', 'optivra-image-studio-for-woocommerce'); ?></a></td>
							</tr>
						<?php endforeach; ?>
					<?php endif; ?>
				</tbody>
			</table>
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
			<input type="hidden" name="page" value="<?php echo esc_attr($this->get_admin_page_slug('scan')); ?>" />
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
				<?php $this->render_loading_state(__('Watching active jobs. This queue refreshes automatically.', 'optivra-image-studio-for-woocommerce')); ?>
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

	private function render_health_report_tab(array $settings): void {
		$cache = get_option('optivra_report_summary_cache', []);
		$cache = is_array($cache) ? $cache : [];
		$latest = isset($cache['latest']) && is_array($cache['latest']) ? $cache['latest'] : [];
		$report = $this->get_report_payload($latest);
		$metrics = $this->get_report_metrics($report);
		$scan = isset($report['scan']) && is_array($report['scan']) ? $report['scan'] : [];
		$score = $this->report_number($metrics, ['product_image_health_score', 'productImageHealthScore'], isset($latest['health_score']) ? (float) $latest['health_score'] : (float) get_option('optivra_latest_health_score', 0));
		$last_completed = $this->report_text($scan, ['scan_completed_at', 'updated_at', 'created_at'], (string) get_option('optivra_last_scan_completed_at', ''));
		$images_scanned = (int) $this->report_number($scan, ['images_scanned'], (float) ($latest['images_scanned'] ?? 0));
		$products_scanned = (int) $this->report_number($scan, ['products_scanned'], (float) ($latest['products_scanned'] ?? 0));
		$issue_summary = isset($report['issue_summary']) && is_array($report['issue_summary']) ? $report['issue_summary'] : [];
		$issues = $this->extract_issue_count($report);
		$insights = $this->report_list($report, ['top_insights', 'insights'], 6);
		$recommendations = $this->report_list($report, ['top_recommendations', 'recommendations'], 6);
		$category_scores = $this->report_list($report, ['category_scores'], 5);
		$portal_url = trailingslashit($this->get_app_base_url([], $settings)) . 'dashboard';
		?>
		<div class="catalogue-image-studio-panel optivra-health-report">
			<?php if (empty($latest)) : ?>
				<?php $this->render_empty_state(__('No scan has been run yet.', 'optivra-image-studio-for-woocommerce'), __('Run your free Product Image Health Report to find image SEO, speed, and presentation opportunities.', 'optivra-image-studio-for-woocommerce'), __('Run Product Scan', 'optivra-image-studio-for-woocommerce'), $this->get_admin_page_url('scan')); ?>
		</div>
				<?php return; ?>
			<?php endif; ?>

			<section class="optivra-report-hero">
				<div>
					<?php $this->render_status_badge(__('Report Ready', 'optivra-image-studio-for-woocommerce'), 'ready'); ?>
					<h2><?php echo esc_html__('Your Product Image Health Report is ready', 'optivra-image-studio-for-woocommerce'); ?></h2>
					<p><?php echo esc_html__('Optivra scanned your WooCommerce catalogue and found opportunities to improve image SEO, page speed, visual consistency, and product presentation.', 'optivra-image-studio-for-woocommerce'); ?></p>
				</div>
				<div class="optivra-hero-score">
					<span><?php echo esc_html__('Product Image Health Score', 'optivra-image-studio-for-woocommerce'); ?></span>
					<strong><?php echo esc_html(number_format_i18n($score, 0)); ?></strong>
				</div>
			</section>

			<div class="optivra-report-meta-grid">
				<?php $this->render_metric_card(__('Last scan date', 'optivra-image-studio-for-woocommerce'), '' !== $last_completed ? $last_completed : __('Not available', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_metric_card(__('Images scanned', 'optivra-image-studio-for-woocommerce'), (string) $images_scanned); ?>
				<?php $this->render_metric_card(__('Products scanned', 'optivra-image-studio-for-woocommerce'), (string) $products_scanned); ?>
				<?php $this->render_metric_card(__('Issues found', 'optivra-image-studio-for-woocommerce'), (string) $issues); ?>
			</div>

			<section class="optivra-report-section">
				<h3><?php echo esc_html__('Score Breakdown', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<div class="optivra-card-grid optivra-score-grid">
					<?php $this->render_score_card(__('Image SEO Score', 'optivra-image-studio-for-woocommerce'), $this->report_number($metrics, ['seo_score'], 0)); ?>
					<?php $this->render_score_card(__('Image Quality Score', 'optivra-image-studio-for-woocommerce'), $this->report_number($metrics, ['image_quality_score', 'quality_score'], 0)); ?>
					<?php $this->render_score_card(__('Catalogue Consistency Score', 'optivra-image-studio-for-woocommerce'), $this->report_number($metrics, ['catalogue_consistency_score', 'consistency_score'], 0)); ?>
					<?php $this->render_score_card(__('Performance Score', 'optivra-image-studio-for-woocommerce'), $this->report_number($metrics, ['performance_score'], 0)); ?>
					<?php $this->render_score_card(__('Product Feed Readiness Score', 'optivra-image-studio-for-woocommerce'), $this->report_number($metrics, ['google_shopping_readiness_score', 'google_readiness_score'], 0)); ?>
					<?php $this->render_score_card(__('Completeness Score', 'optivra-image-studio-for-woocommerce'), $this->report_number($metrics, ['completeness_score'], 0)); ?>
				</div>
			</section>

			<section class="optivra-report-section optivra-value-card">
				<h3><?php echo esc_html__('Estimated Value', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<?php
				$minutes_low = $this->report_number($metrics, ['estimated_manual_minutes_low'], 0);
				$minutes_high = $this->report_number($metrics, ['estimated_manual_minutes_high'], 0);
				$hours_low = $minutes_low / 60;
				$hours_high = $minutes_high / 60;
				$cost_low = $this->report_number($metrics, ['estimated_cost_saved_low'], 0);
				$cost_high = $this->report_number($metrics, ['estimated_cost_saved_high'], 0);
				$hourly_rate = $this->report_number($metrics, ['hourly_rate_used'], 40);
				?>
				<p><?php echo esc_html(sprintf(__('Fixing these issues manually would take approximately %1$s-%2$s hours.', 'optivra-image-studio-for-woocommerce'), number_format_i18n($hours_low, 1), number_format_i18n($hours_high, 1))); ?></p>
				<div class="optivra-report-meta-grid">
					<?php $this->render_metric_card(__('Manual work estimate', 'optivra-image-studio-for-woocommerce'), sprintf('%s-%s min', number_format_i18n($minutes_low, 0), number_format_i18n($minutes_high, 0))); ?>
					<?php $this->render_metric_card(__('Estimated editing value', 'optivra-image-studio-for-woocommerce'), sprintf('$%s-$%s', number_format_i18n($cost_low, 0), number_format_i18n($cost_high, 0))); ?>
					<?php $this->render_metric_card(__('Hourly rate used', 'optivra-image-studio-for-woocommerce'), sprintf('$%s/hr', number_format_i18n($hourly_rate, 0))); ?>
				</div>
			</section>

			<section class="optivra-report-section">
				<h3><?php echo esc_html__('What Optivra Found', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<div class="optivra-card-grid">
					<?php if (empty($insights)) : ?>
						<?php $this->render_insight_card(__('No major insights available yet', 'optivra-image-studio-for-woocommerce'), __('Run a new scan after more product images are added or updated.', 'optivra-image-studio-for-woocommerce'), 'info'); ?>
					<?php else : ?>
						<?php foreach ($insights as $insight) : ?>
							<?php $this->render_insight_card($this->report_text($insight, ['title'], __('Catalogue insight', 'optivra-image-studio-for-woocommerce')), $this->report_text($insight, ['body', 'description', 'summary'], ''), $this->report_text($insight, ['severity'], 'info')); ?>
						<?php endforeach; ?>
					<?php endif; ?>
				</div>
			</section>

			<section class="optivra-report-section">
				<h3><?php echo esc_html__('Top issues holding your score back', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<div class="optivra-issue-list">
					<?php $this->render_issue_summary_cards($issue_summary); ?>
				</div>
			</section>

			<section class="optivra-report-section">
				<h3><?php echo esc_html__('Recommended fixes', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<div class="optivra-card-grid">
					<?php if (empty($recommendations)) : ?>
						<?php $this->render_recommendation_card(__('Review highest-priority images', 'optivra-image-studio-for-woocommerce'), __('Optivra will show targeted recommendations here after the backend returns report actions.', 'optivra-image-studio-for-woocommerce'), 'info', $this->get_admin_page_url('scan')); ?>
					<?php else : ?>
						<?php foreach ($recommendations as $recommendation) : ?>
							<?php $this->render_audit_recommendation_card($recommendation); ?>
						<?php endforeach; ?>
					<?php endif; ?>
				</div>
			</section>

			<section class="optivra-report-section">
				<h3><?php echo esc_html__('Category summary', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<div class="optivra-category-summary">
					<?php if (empty($category_scores)) : ?>
						<?php $this->render_empty_state(__('Category scoring is not available in this summary.', 'optivra-image-studio-for-woocommerce'), __('Open the full Optivra report or run a new scan after category scores are enabled for this store.', 'optivra-image-studio-for-woocommerce'), __('Open Portal', 'optivra-image-studio-for-woocommerce'), $portal_url); ?>
					<?php else : ?>
						<?php foreach ($category_scores as $category) : ?>
							<div class="optivra-category-row">
								<strong><?php echo esc_html($this->report_text($category, ['category_name'], __('Uncategorised', 'optivra-image-studio-for-woocommerce'))); ?></strong>
								<span><?php echo esc_html(number_format_i18n($this->report_number($category, ['health_score'], 0), 0)); ?></span>
								<?php $this->render_severity_badge($this->report_text($category, ['priority'], 'medium')); ?>
								<?php $top_issue = $this->report_text($category, ['top_issue_type'], ''); ?>
								<small><?php echo esc_html('' !== $top_issue ? $this->get_issue_type_label($top_issue) : $this->report_text($category, ['recommendation'], __('No top issue recorded', 'optivra-image-studio-for-woocommerce'))); ?></small>
							</div>
						<?php endforeach; ?>
					<?php endif; ?>
				</div>
			</section>

			<footer class="optivra-report-footer">
				<a class="button button-primary optivra-action-button is-primary" href="<?php echo esc_url($this->get_admin_page_url('scan')); ?>"><?php echo esc_html__('Run New Scan', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($portal_url); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Open Full Report on Optivra', 'optivra-image-studio-for-woocommerce'); ?></a>
				<button type="button" class="button optivra-action-button is-secondary" disabled><?php echo esc_html__('Add Recommended Fixes to Queue', 'optivra-image-studio-for-woocommerce'); ?> - <?php echo esc_html__('Coming soon', 'optivra-image-studio-for-woocommerce'); ?></button>
			</footer>
			<?php if (empty($settings['api_token'])) : ?>
				<p class="catalogue-image-studio-warning"><?php echo esc_html__('Connect your Optivra account in Settings before submitting store audit reports.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}

	private function render_recommendations_tab(): void {
		$context = $this->get_recommendation_report_context();
		$latest = isset($context['latest']) && is_array($context['latest']) ? $context['latest'] : [];
		$scan_id = (string) ($context['scan_id'] ?? '');
		$recommendations = isset($context['recommendations']) && is_array($context['recommendations']) ? $context['recommendations'] : [];
		$filters = $this->get_recommendation_filters_from_query();
		$filtered = $this->sort_recommendations($this->filter_recommendations($recommendations, $filters), (string) $filters['sort']);
		$available_count = count(array_filter($recommendations, static function ($recommendation): bool {
			return is_array($recommendation) && 'available' === (string) ($recommendation['status'] ?? 'available');
		}));
		$queued_count = count(array_filter($recommendations, static function ($recommendation): bool {
			return is_array($recommendation) && 'queued' === (string) ($recommendation['status'] ?? '');
		}));
		$dismissed_count = count(array_filter($recommendations, static function ($recommendation): bool {
			return is_array($recommendation) && 'dismissed' === (string) ($recommendation['status'] ?? '');
		}));
		$category_options = $this->get_recommendation_filter_options($recommendations, 'category');
		$image_role_options = $this->get_recommendation_filter_options($recommendations, 'image_role');
		?>
		<div class="catalogue-image-studio-panel optivra-recommendations-page">
			<?php if (empty($latest)) : ?>
				<?php $this->render_empty_state(__('No recommendations yet', 'optivra-image-studio-for-woocommerce'), __('Run your free Product Image Health Report to generate prioritised image SEO, performance and presentation recommendations.', 'optivra-image-studio-for-woocommerce'), __('Run Product Scan', 'optivra-image-studio-for-woocommerce'), $this->get_admin_page_url('scan')); ?>
		</div>
				<?php return; ?>
			<?php endif; ?>

			<section class="optivra-recommendations-hero">
				<div>
					<?php $this->render_status_badge(__('Report Actions Ready', 'optivra-image-studio-for-woocommerce'), 'ready'); ?>
					<h2><?php echo esc_html__('Prioritised image recommendations', 'optivra-image-studio-for-woocommerce'); ?></h2>
					<p><?php echo esc_html__('Review the fixes Optivra found in your latest Product Image Health Report. SEO-only recommendations do not create AI image jobs, and image cleanup defaults to preserve mode when queue integration is available.', 'optivra-image-studio-for-woocommerce'); ?></p>
				</div>
				<div class="optivra-rec-summary">
					<?php $this->render_metric_card(__('Recommendations', 'optivra-image-studio-for-woocommerce'), (string) count($recommendations)); ?>
					<?php $this->render_metric_card(__('Available', 'optivra-image-studio-for-woocommerce'), (string) $available_count); ?>
					<?php $this->render_metric_card(__('Queued', 'optivra-image-studio-for-woocommerce'), (string) $queued_count); ?>
					<?php $this->render_metric_card(__('Dismissed', 'optivra-image-studio-for-woocommerce'), (string) $dismissed_count); ?>
				</div>
			</section>

			<form class="optivra-recommendation-toolbar" method="get" action="<?php echo esc_url(admin_url('admin.php')); ?>">
				<input type="hidden" name="page" value="<?php echo esc_attr($this->get_admin_page_slug('recommendations')); ?>" />
				<label>
					<span><?php echo esc_html__('Priority', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select name="recommendation_priority">
						<?php $this->render_select_option('', __('All priorities', 'optivra-image-studio-for-woocommerce'), (string) $filters['priority']); ?>
						<?php foreach (['critical', 'high', 'medium', 'low'] as $priority) : ?>
							<?php $this->render_select_option($priority, $this->get_priority_label($priority), (string) $filters['priority']); ?>
						<?php endforeach; ?>
					</select>
				</label>
				<label>
					<span><?php echo esc_html__('Action type', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select name="recommendation_action_type">
						<?php $this->render_select_option('', __('All actions', 'optivra-image-studio-for-woocommerce'), (string) $filters['action_type']); ?>
						<?php foreach ($this->get_recommendation_action_labels() as $action_type => $label) : ?>
							<?php $this->render_select_option($action_type, $label, (string) $filters['action_type']); ?>
						<?php endforeach; ?>
					</select>
				</label>
				<label>
					<span><?php echo esc_html__('Category', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select name="recommendation_category">
						<?php $this->render_select_option('', __('All categories', 'optivra-image-studio-for-woocommerce'), (string) $filters['category']); ?>
						<?php foreach ($category_options as $category) : ?>
							<?php $this->render_select_option($category, $category, (string) $filters['category']); ?>
						<?php endforeach; ?>
					</select>
				</label>
				<label>
					<span><?php echo esc_html__('Image role', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select name="recommendation_image_role">
						<?php $this->render_select_option('', __('All image roles', 'optivra-image-studio-for-woocommerce'), (string) $filters['image_role']); ?>
						<?php foreach ($image_role_options as $image_role) : ?>
							<?php $this->render_select_option($image_role, $this->get_image_role_label($image_role), (string) $filters['image_role']); ?>
						<?php endforeach; ?>
					</select>
				</label>
				<label>
					<span><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select name="recommendation_status">
						<?php $this->render_select_option('', __('All statuses', 'optivra-image-studio-for-woocommerce'), (string) $filters['status']); ?>
						<?php foreach (['available', 'queued', 'completed', 'dismissed'] as $status) : ?>
							<?php $this->render_select_option($status, $this->get_recommendation_status_label($status), (string) $filters['status']); ?>
						<?php endforeach; ?>
					</select>
				</label>
				<label class="optivra-rec-search">
					<span><?php echo esc_html__('Search', 'optivra-image-studio-for-woocommerce'); ?></span>
					<input type="search" name="recommendation_search" value="<?php echo esc_attr((string) $filters['search']); ?>" placeholder="<?php echo esc_attr__('Search recommendations', 'optivra-image-studio-for-woocommerce'); ?>" />
				</label>
				<label>
					<span><?php echo esc_html__('Sort', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select name="recommendation_sort">
						<?php
						$sort_options = [
							'priority'            => __('Priority', 'optivra-image-studio-for-woocommerce'),
							'images_affected'     => __('Images affected', 'optivra-image-studio-for-woocommerce'),
							'estimated_time_saved' => __('Estimated time saved', 'optivra-image-studio-for-woocommerce'),
							'category'            => __('Category', 'optivra-image-studio-for-woocommerce'),
							'newest'              => __('Newest', 'optivra-image-studio-for-woocommerce'),
						];
						foreach ($sort_options as $sort_key => $sort_label) :
							?>
							<?php $this->render_select_option($sort_key, $sort_label, (string) $filters['sort']); ?>
						<?php endforeach; ?>
					</select>
				</label>
				<div class="optivra-toolbar-actions">
					<button type="submit" class="button button-primary optivra-action-button is-primary"><?php echo esc_html__('Apply Filters', 'optivra-image-studio-for-woocommerce'); ?></button>
					<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_admin_page_url('recommendations')); ?>"><?php echo esc_html__('Clear', 'optivra-image-studio-for-woocommerce'); ?></a>
				</div>
			</form>

			<section class="optivra-report-section">
				<div class="optivra-card-topline">
					<h3><?php echo esc_html__('Recommended fixes', 'optivra-image-studio-for-woocommerce'); ?></h3>
					<span class="optivra-muted-count"><?php echo esc_html(sprintf(_n('%d result', '%d results', count($filtered), 'optivra-image-studio-for-woocommerce'), count($filtered))); ?></span>
				</div>
				<?php if (empty($filtered)) : ?>
					<?php $this->render_empty_state(__('No recommendations match these filters', 'optivra-image-studio-for-woocommerce'), __('Try clearing filters or run a fresh scan if your catalogue has changed.', 'optivra-image-studio-for-woocommerce'), __('Clear Filters', 'optivra-image-studio-for-woocommerce'), $this->get_admin_page_url('recommendations')); ?>
				<?php else : ?>
					<div class="optivra-recommendation-grid">
						<?php foreach ($filtered as $recommendation) : ?>
							<?php $this->render_full_recommendation_card($recommendation, $scan_id); ?>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
			</section>

			<section class="optivra-report-section optivra-recommendation-rules">
				<h3><?php echo esc_html__('Queue behaviour', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<div class="optivra-card-grid">
					<?php $this->render_insight_card(__('SEO-only fixes stay lightweight', 'optivra-image-studio-for-woocommerce'), __('Missing alt text recommendations create metadata work only; they do not create AI image-processing jobs unless an image edit is also required.', 'optivra-image-studio-for-woocommerce'), 'info'); ?>
					<?php $this->render_insight_card(__('Optimisation can avoid AI', 'optivra-image-studio-for-woocommerce'), __('Oversized image recommendations should use resizing, compression or WebP conversion before any AI processing is considered.', 'optivra-image-studio-for-woocommerce'), 'info'); ?>
					<?php $this->render_insight_card(__('Product cleanup uses preserve mode', 'optivra-image-studio-for-woocommerce'), __('Background, crop and catalogue consistency fixes default to preserve mode and the selected Optivra background preset.', 'optivra-image-studio-for-woocommerce'), 'info'); ?>
				</div>
			</section>

			<details class="optivra-recommendation-table-wrap">
				<summary><?php echo esc_html__('Table view', 'optivra-image-studio-for-woocommerce'); ?></summary>
				<?php $this->render_recommendations_table($filtered, $scan_id); ?>
			</details>

			<footer class="optivra-report-footer">
				<a class="button button-primary optivra-action-button is-primary" href="<?php echo esc_url($this->get_admin_page_url('health')); ?>"><?php echo esc_html__('Open Health Report', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_admin_page_url('scan')); ?>"><?php echo esc_html__('Run New Scan', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_admin_page_url('queue')); ?>"><?php echo esc_html__('Open Processing Queue', 'optivra-image-studio-for-woocommerce'); ?></a>
			</footer>
		</div>
		<?php
	}

	/**
	 * @return array{latest:array<string,mixed>,report:array<string,mixed>,scan_id:string,recommendations:array<int,array<string,mixed>>}
	 */
	private function get_recommendation_report_context(): array {
		$cache = get_option('optivra_report_summary_cache', []);
		$cache = is_array($cache) ? $cache : [];
		$latest = isset($cache['latest']) && is_array($cache['latest']) ? $cache['latest'] : [];
		$report = $this->get_report_payload($latest);
		$scan = isset($report['scan']) && is_array($report['scan']) ? $report['scan'] : [];
		$scan_id = $this->report_text($latest, ['scan_id'], $this->report_text($scan, ['id', 'scan_id'], (string) get_option('optivra_latest_scan_id', '')));

		return [
			'latest'          => $latest,
			'report'          => $report,
			'scan_id'         => $scan_id,
			'recommendations' => $this->normalize_audit_recommendations($report, $scan_id),
		];
	}

	/**
	 * @param array<int,array<string,mixed>> $recommendations Recommendations.
	 * @return array<string,mixed>
	 */
	private function find_recommendation_by_key(array $recommendations, string $key): array {
		foreach ($recommendations as $recommendation) {
			if ($key === (string) ($recommendation['key'] ?? '')) {
				return $recommendation;
			}
		}

		return [];
	}

	/**
	 * @return array<string,string>
	 */
	private function get_recommendation_filters_from_query(): array {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Read-only filter parameters.
		$priority = isset($_GET['recommendation_priority']) ? sanitize_key(wp_unslash($_GET['recommendation_priority'])) : '';
		$action_type = isset($_GET['recommendation_action_type']) ? sanitize_key(wp_unslash($_GET['recommendation_action_type'])) : '';
		$category = isset($_GET['recommendation_category']) ? sanitize_text_field(wp_unslash($_GET['recommendation_category'])) : '';
		$image_role = isset($_GET['recommendation_image_role']) ? sanitize_key(wp_unslash($_GET['recommendation_image_role'])) : '';
		$status = isset($_GET['recommendation_status']) ? sanitize_key(wp_unslash($_GET['recommendation_status'])) : '';
		$search = isset($_GET['recommendation_search']) ? sanitize_text_field(wp_unslash($_GET['recommendation_search'])) : '';
		$sort = isset($_GET['recommendation_sort']) ? sanitize_key(wp_unslash($_GET['recommendation_sort'])) : 'priority';
		// phpcs:enable WordPress.Security.NonceVerification.Recommended

		if (! in_array($priority, ['', 'critical', 'high', 'medium', 'low', 'info'], true)) {
			$priority = '';
		}
		if (! array_key_exists($action_type, $this->get_recommendation_action_labels())) {
			$action_type = '';
		}
		if (! in_array($status, ['', 'available', 'queued', 'completed', 'dismissed'], true)) {
			$status = '';
		}
		if (! in_array($sort, ['priority', 'images_affected', 'estimated_time_saved', 'category', 'newest'], true)) {
			$sort = 'priority';
		}

		return [
			'priority'    => $priority,
			'action_type' => $action_type,
			'category'    => $category,
			'image_role'  => $image_role,
			'status'      => $status,
			'search'      => $search,
			'sort'        => $sort,
		];
	}

	/**
	 * @param array<string,mixed> $report Report payload.
	 * @return array<int,array<string,mixed>>
	 */
	private function normalize_audit_recommendations(array $report, string $scan_id): array {
		$rows = $this->report_list($report, ['recommendations', 'top_recommendations'], 500);
		if (empty($rows)) {
			$issue_summary = isset($report['issue_summary']) && is_array($report['issue_summary']) ? $report['issue_summary'] : [];
			$rows = $this->derive_recommendations_from_issue_summary($issue_summary);
		}

		$recommendations = [];
		foreach ($rows as $index => $row) {
			$filter = isset($row['action_filter']) && is_array($row['action_filter']) ? $row['action_filter'] : [];
			$raw_action_type = $this->report_text($row, ['action_type'], '');
			$action_type = $this->normalize_recommendation_action_type($raw_action_type);
			if ('' === $raw_action_type || ('review_manually' === $action_type && 'review_manually' !== sanitize_key($raw_action_type))) {
				$action_type = $this->infer_recommendation_action_type($row);
			}

			$key = $this->build_recommendation_key($row, $index);
			$status = $this->report_text($row, ['status'], 'available');
			if ($this->is_recommendation_dismissed($scan_id, $key)) {
				$status = 'dismissed';
			}

			$recommendations[] = [
				'key'          => $key,
				'id'           => $this->get_recommendation_id($row),
				'title'        => $this->report_text($row, ['title'], __('Recommended fix', 'optivra-image-studio-for-woocommerce')),
				'description'  => $this->report_text($row, ['description', 'body'], __('Review this recommendation from the latest image audit.', 'optivra-image-studio-for-woocommerce')),
				'priority'     => $this->normalize_priority($this->report_text($row, ['priority', 'severity'], 'medium')),
				'action_type'  => $action_type,
				'category'     => $this->report_text($row, ['category_name', 'category'], $this->report_text($filter, ['category_name', 'category'], '')),
				'image_role'   => sanitize_key($this->report_text($row, ['image_role'], $this->report_text($filter, ['image_role'], ''))),
				'status'       => $this->normalize_recommendation_status($status),
				'affected'     => max(0, (int) $this->report_number($row, ['estimated_images_affected', 'images_affected', 'affected_count'], 0)),
				'minutes_low'  => max(0, (int) $this->report_number($row, ['estimated_minutes_saved_low', 'minutes_saved_low'], 0)),
				'minutes_high' => max(0, (int) $this->report_number($row, ['estimated_minutes_saved_high', 'minutes_saved_high'], 0)),
				'created_at'   => $this->report_text($row, ['created_at'], ''),
			];
		}

		return $recommendations;
	}

	/**
	 * @param array<string,mixed> $issue_summary Issue summary.
	 * @return array<int,array<string,mixed>>
	 */
	private function derive_recommendations_from_issue_summary(array $issue_summary): array {
		$by_type = isset($issue_summary['by_issue_type']) && is_array($issue_summary['by_issue_type']) ? $issue_summary['by_issue_type'] : [];
		$templates = [
			'missing_main_image'        => [__('Review products missing main images', 'optivra-image-studio-for-woocommerce'), __('Add or select a primary product image before other image improvements are queued.', 'optivra-image-studio-for-woocommerce'), 'critical', 'add_main_image', 'main', 2, 4],
			'missing_alt_text'         => [__('Fix missing alt text', 'optivra-image-studio-for-woocommerce'), __('Generate useful, product-aware alt text for images missing SEO metadata.', 'optivra-image-studio-for-woocommerce'), 'high', 'generate_alt_text', '', 1, 2],
			'oversized_file'           => [__('Optimise oversized images', 'optivra-image-studio-for-woocommerce'), __('Compress, resize or convert heavy images before considering AI image edits.', 'optivra-image-studio-for-woocommerce'), 'high', 'optimise_image', '', 1, 2],
			'generic_filename'         => [__('Improve generic filenames', 'optivra-image-studio-for-woocommerce'), __('Review image filenames that do not help product SEO or catalogue organisation.', 'optivra-image-studio-for-woocommerce'), 'medium', 'generate_alt_text', '', 1, 1],
			'inconsistent_aspect_ratio' => [__('Standardise main image aspect ratios', 'optivra-image-studio-for-woocommerce'), __('Bring main product images into a consistent ecommerce crop for better collection pages.', 'optivra-image-studio-for-woocommerce'), 'medium', 'resize_crop', 'main', 2, 4],
			'product_has_single_image' => [__('Review products with a single image', 'optivra-image-studio-for-woocommerce'), __('Products with only one image may need gallery coverage before advanced processing.', 'optivra-image-studio-for-woocommerce'), 'medium', 'review_manually', 'main', 1, 2],
			'missing_webp'             => [__('Convert images to WebP where appropriate', 'optivra-image-studio-for-woocommerce'), __('Create modern-format opportunities for faster catalogue pages.', 'optivra-image-studio-for-woocommerce'), 'medium', 'convert_webp', '', 1, 2],
			'cluttered_background'     => [__('Replace cluttered backgrounds', 'optivra-image-studio-for-woocommerce'), __('Use preserve-mode background cleanup with your default Optivra preset.', 'optivra-image-studio-for-woocommerce'), 'high', 'replace_background', '', 4, 8],
			'inconsistent_background'  => [__('Standardise product backgrounds', 'optivra-image-studio-for-woocommerce'), __('Make catalogue backgrounds more consistent while preserving product pixels.', 'optivra-image-studio-for-woocommerce'), 'medium', 'standardise_background', '', 4, 8],
			'poor_centering'           => [__('Fix product centering', 'optivra-image-studio-for-woocommerce'), __('Review crops where the product is poorly centred or framed.', 'optivra-image-studio-for-woocommerce'), 'medium', 'resize_crop', '', 2, 4],
			'too_small_in_frame'       => [__('Improve product framing', 'optivra-image-studio-for-woocommerce'), __('Resize and recompose images where products appear too small in the frame.', 'optivra-image-studio-for-woocommerce'), 'medium', 'resize_crop', '', 2, 4],
			'too_tightly_cropped'      => [__('Review tightly cropped products', 'optivra-image-studio-for-woocommerce'), __('Check images where product edges may be too close to the canvas.', 'optivra-image-studio-for-woocommerce'), 'high', 'resize_crop', '', 2, 4],
			'google_readiness_warning' => [__('Improve product feed readiness', 'optivra-image-studio-for-woocommerce'), __('Review main images with product-feed readiness warnings before campaigns scale.', 'optivra-image-studio-for-woocommerce'), 'high', 'review_manually', 'main', 2, 4],
		];

		$recommendations = [];
		foreach ($by_type as $issue_type => $count) {
			$issue_type = sanitize_key((string) $issue_type);
			if (empty($templates[$issue_type]) || ! is_numeric($count) || (int) $count <= 0) {
				continue;
			}

			$template = $templates[$issue_type];
			$affected = (int) $count;
			$recommendations[] = [
				'title'                        => $template[0],
				'description'                  => $template[1],
				'priority'                     => $template[2],
				'action_type'                  => $template[3],
				'image_role'                   => $template[4],
				'estimated_images_affected'    => $affected,
				'estimated_minutes_saved_low'  => $affected * (int) $template[5],
				'estimated_minutes_saved_high' => $affected * (int) $template[6],
				'status'                       => 'available',
				'issue_type'                   => $issue_type,
			];
		}

		return $recommendations;
	}

	/**
	 * @param array<string,mixed> $row Recommendation row.
	 */
	private function build_recommendation_key(array $row, int $index): string {
		$id = $this->get_recommendation_id($row);
		if ('' !== $id) {
			return 'remote-' . md5($id);
		}

		$parts = [
			$this->report_text($row, ['title'], ''),
			$this->report_text($row, ['action_type'], ''),
			$this->report_text($row, ['issue_type'], ''),
			(string) $index,
		];

		return 'local-' . md5(implode('|', $parts));
	}

	/**
	 * @param array<string,mixed> $row Recommendation row.
	 */
	private function get_recommendation_id(array $row): string {
		foreach (['id', 'recommendation_id'] as $key) {
			if (isset($row[$key]) && is_scalar($row[$key]) && '' !== (string) $row[$key]) {
				return sanitize_text_field((string) $row[$key]);
			}
		}

		return '';
	}

	private function normalize_priority(string $priority): string {
		$priority = sanitize_key($priority);

		return in_array($priority, ['critical', 'high', 'medium', 'low', 'info'], true) ? $priority : 'medium';
	}

	private function normalize_recommendation_status(string $status): string {
		$status = sanitize_key($status);

		return in_array($status, ['available', 'queued', 'completed', 'dismissed'], true) ? $status : 'available';
	}

	private function normalize_recommendation_action_type(string $action_type): string {
		$action_type = sanitize_key($action_type);
		$aliases = [
			'optimize_image'           => 'optimise_image',
			'optimize_images'          => 'optimise_image',
			'optimise_images'          => 'optimise_image',
			'convert_to_webp'          => 'convert_webp',
			'webp_conversion'          => 'convert_webp',
			'resize'                   => 'resize_crop',
			'crop'                     => 'resize_crop',
			'crop_resize'              => 'resize_crop',
			'background_replacement'   => 'replace_background',
			'standardize_background'   => 'standardise_background',
			'standardize_backgrounds'  => 'standardise_background',
			'standardise_backgrounds'  => 'standardise_background',
			'add_main_image_reminder'  => 'add_main_image',
			'main_image_reminder'      => 'add_main_image',
		];

		if (isset($aliases[$action_type])) {
			$action_type = $aliases[$action_type];
		}

		return array_key_exists($action_type, $this->get_recommendation_action_labels()) ? $action_type : 'review_manually';
	}

	/**
	 * @param array<string,mixed> $row Recommendation row.
	 */
	private function infer_recommendation_action_type(array $row): string {
		$text = strtolower($this->report_text($row, ['action_type', 'issue_type', 'title', 'description'], ''));
		if (false !== strpos($text, 'alt')) {
			return 'generate_alt_text';
		}
		if (false !== strpos($text, 'webp')) {
			return 'convert_webp';
		}
		if (false !== strpos($text, 'oversized') || false !== strpos($text, 'optim')) {
			return 'optimise_image';
		}
		if (false !== strpos($text, 'background')) {
			return false !== strpos($text, 'standard') ? 'standardise_background' : 'replace_background';
		}
		if (false !== strpos($text, 'crop') || false !== strpos($text, 'ratio') || false !== strpos($text, 'cent')) {
			return 'resize_crop';
		}
		if (false !== strpos($text, 'main image')) {
			return 'add_main_image';
		}

		return 'review_manually';
	}

	/**
	 * @param array<int,array<string,mixed>> $recommendations Recommendations.
	 * @param array<string,string>          $filters Filters.
	 * @return array<int,array<string,mixed>>
	 */
	private function filter_recommendations(array $recommendations, array $filters): array {
		return array_values(array_filter($recommendations, function ($recommendation) use ($filters): bool {
			if (! is_array($recommendation)) {
				return false;
			}

			foreach (['priority', 'action_type', 'category', 'image_role', 'status'] as $field) {
				if ('' !== (string) ($filters[$field] ?? '') && (string) ($recommendation[$field] ?? '') !== (string) $filters[$field]) {
					return false;
				}
			}

			$search = strtolower((string) ($filters['search'] ?? ''));
			if ('' !== $search) {
				$haystack = strtolower(implode(' ', [
					(string) ($recommendation['title'] ?? ''),
					(string) ($recommendation['description'] ?? ''),
					(string) ($recommendation['action_type'] ?? ''),
					(string) ($recommendation['category'] ?? ''),
				]));
				if (false === strpos($haystack, $search)) {
					return false;
				}
			}

			return true;
		}));
	}

	/**
	 * @param array<int,array<string,mixed>> $recommendations Recommendations.
	 * @return array<int,array<string,mixed>>
	 */
	private function sort_recommendations(array $recommendations, string $sort): array {
		$priority_order = ['critical' => 0, 'high' => 1, 'medium' => 2, 'low' => 3, 'info' => 4];
		usort($recommendations, static function ($a, $b) use ($sort, $priority_order): int {
			$a = is_array($a) ? $a : [];
			$b = is_array($b) ? $b : [];
			if ('images_affected' === $sort) {
				return ((int) ($b['affected'] ?? 0)) <=> ((int) ($a['affected'] ?? 0));
			}
			if ('estimated_time_saved' === $sort) {
				return ((int) ($b['minutes_high'] ?? 0)) <=> ((int) ($a['minutes_high'] ?? 0));
			}
			if ('category' === $sort) {
				return strcmp((string) ($a['category'] ?? ''), (string) ($b['category'] ?? ''));
			}
			if ('newest' === $sort) {
				return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
			}

			$priority_compare = ($priority_order[(string) ($a['priority'] ?? 'info')] ?? 9) <=> ($priority_order[(string) ($b['priority'] ?? 'info')] ?? 9);
			if (0 !== $priority_compare) {
				return $priority_compare;
			}

			return ((int) ($b['affected'] ?? 0)) <=> ((int) ($a['affected'] ?? 0));
		});

		return $recommendations;
	}

	/**
	 * @param array<int,array<string,mixed>> $recommendations Recommendations.
	 * @return array<int,string>
	 */
	private function get_recommendation_filter_options(array $recommendations, string $field): array {
		$options = [];
		foreach ($recommendations as $recommendation) {
			if (is_array($recommendation) && ! empty($recommendation[$field]) && is_scalar($recommendation[$field])) {
				$options[] = sanitize_text_field((string) $recommendation[$field]);
			}
		}
		$options = array_values(array_unique(array_filter($options)));
		sort($options);

		return $options;
	}

	private function render_select_option(string $value, string $label, string $selected): void {
		?>
		<option value="<?php echo esc_attr($value); ?>" <?php selected($selected, $value); ?>><?php echo esc_html($label); ?></option>
		<?php
	}

	/**
	 * @return array<string,string>
	 */
	private function get_recommendation_action_labels(): array {
		return [
			'generate_alt_text'      => __('Generate alt text', 'optivra-image-studio-for-woocommerce'),
			'optimise_image'         => __('Optimise image', 'optivra-image-studio-for-woocommerce'),
			'replace_background'     => __('Replace background', 'optivra-image-studio-for-woocommerce'),
			'standardise_background' => __('Standardise background', 'optivra-image-studio-for-woocommerce'),
			'resize_crop'            => __('Resize or crop', 'optivra-image-studio-for-woocommerce'),
			'convert_webp'           => __('Convert to WebP', 'optivra-image-studio-for-woocommerce'),
			'review_manually'        => __('Review manually', 'optivra-image-studio-for-woocommerce'),
			'add_main_image'         => __('Add main image reminder', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_recommendation_action_label(string $action_type): string {
		$labels = $this->get_recommendation_action_labels();

		return $labels[$action_type] ?? $labels['review_manually'];
	}

	private function get_recommendation_action_note(string $action_type): string {
		$notes = [
			'generate_alt_text'      => __('SEO-only metadata work. No AI image processing job is required.', 'optivra-image-studio-for-woocommerce'),
			'optimise_image'         => __('Uses optimisation first; AI is not needed unless crop or background cleanup is selected.', 'optivra-image-studio-for-woocommerce'),
			'replace_background'     => __('Uses preserve mode with your selected default background preset.', 'optivra-image-studio-for-woocommerce'),
			'standardise_background' => __('Uses preserve mode with your catalogue background defaults.', 'optivra-image-studio-for-woocommerce'),
			'resize_crop'            => __('Uses deterministic crop/framing where possible and preserve mode for cleanup.', 'optivra-image-studio-for-woocommerce'),
			'convert_webp'           => __('Format conversion work. No AI image generation is required.', 'optivra-image-studio-for-woocommerce'),
			'review_manually'        => __('Manual review is recommended before creating processing jobs.', 'optivra-image-studio-for-woocommerce'),
			'add_main_image'         => __('Reminder workflow only. Choose a product image before processing.', 'optivra-image-studio-for-woocommerce'),
		];

		return $notes[$action_type] ?? $notes['review_manually'];
	}

	private function get_priority_label(string $priority): string {
		$labels = [
			'critical' => __('Critical', 'optivra-image-studio-for-woocommerce'),
			'high'     => __('High', 'optivra-image-studio-for-woocommerce'),
			'medium'   => __('Medium', 'optivra-image-studio-for-woocommerce'),
			'low'      => __('Low', 'optivra-image-studio-for-woocommerce'),
			'info'     => __('Info', 'optivra-image-studio-for-woocommerce'),
		];

		return $labels[$priority] ?? $labels['info'];
	}

	private function get_recommendation_status_label(string $status): string {
		$labels = [
			'available' => __('Available', 'optivra-image-studio-for-woocommerce'),
			'queued'    => __('Queued', 'optivra-image-studio-for-woocommerce'),
			'completed' => __('Completed', 'optivra-image-studio-for-woocommerce'),
			'dismissed' => __('Dismissed', 'optivra-image-studio-for-woocommerce'),
		];

		return $labels[$status] ?? $labels['available'];
	}

	private function get_image_role_label(string $image_role): string {
		$labels = [
			'main'      => __('Main product image', 'optivra-image-studio-for-woocommerce'),
			'featured'  => __('Main product image', 'optivra-image-studio-for-woocommerce'),
			'gallery'   => __('Gallery image', 'optivra-image-studio-for-woocommerce'),
			'variation' => __('Variation image', 'optivra-image-studio-for-woocommerce'),
			'category'  => __('Category thumbnail', 'optivra-image-studio-for-woocommerce'),
			'unknown'   => __('Unknown role', 'optivra-image-studio-for-woocommerce'),
		];

		return $labels[$image_role] ?? ucwords(str_replace('_', ' ', sanitize_key($image_role)));
	}

	/**
	 * @param array<string,mixed> $recommendation Recommendation.
	 */
	private function render_full_recommendation_card(array $recommendation, string $scan_id): void {
		$priority = (string) ($recommendation['priority'] ?? 'medium');
		$status = (string) ($recommendation['status'] ?? 'available');
		$action_type = (string) ($recommendation['action_type'] ?? 'review_manually');
		$affected = (int) ($recommendation['affected'] ?? 0);
		$minutes_low = (int) ($recommendation['minutes_low'] ?? 0);
		$minutes_high = (int) ($recommendation['minutes_high'] ?? 0);
		?>
		<section class="optivra-recommendation-card optivra-rec-action-card">
			<div class="optivra-card-topline">
				<div>
					<?php $this->render_severity_badge($priority); ?>
					<?php $this->render_status_badge($this->get_recommendation_status_label($status), $status); ?>
				</div>
				<span class="optivra-action-chip"><?php echo esc_html($this->get_recommendation_action_label($action_type)); ?></span>
			</div>
			<h3><?php echo esc_html((string) ($recommendation['title'] ?? __('Recommended fix', 'optivra-image-studio-for-woocommerce'))); ?></h3>
			<p><?php echo esc_html((string) ($recommendation['description'] ?? '')); ?></p>
			<div class="optivra-rec-meta">
				<span><?php echo esc_html(sprintf(_n('%d image affected', '%d images affected', $affected, 'optivra-image-studio-for-woocommerce'), $affected)); ?></span>
				<span><?php echo esc_html(sprintf(__('%1$d-%2$d min saved', 'optivra-image-studio-for-woocommerce'), $minutes_low, $minutes_high)); ?></span>
				<?php if (! empty($recommendation['category'])) : ?>
					<span><?php echo esc_html((string) $recommendation['category']); ?></span>
				<?php endif; ?>
				<?php if (! empty($recommendation['image_role'])) : ?>
					<span><?php echo esc_html($this->get_image_role_label((string) $recommendation['image_role'])); ?></span>
				<?php endif; ?>
			</div>
			<p class="optivra-action-note"><?php echo esc_html($this->get_recommendation_action_note($action_type)); ?></p>
			<div class="optivra-rec-actions">
				<form method="post" action="">
					<?php wp_nonce_field('optivra_recommendation_action', 'optivra_recommendation_action_nonce'); ?>
					<input type="hidden" name="optivra_recommendation_action" value="queue_recommendation" />
					<input type="hidden" name="optivra_recommendation_key" value="<?php echo esc_attr((string) ($recommendation['key'] ?? '')); ?>" />
					<button type="submit" class="button button-primary optivra-action-button is-primary" <?php disabled('dismissed', $status); ?>><?php echo esc_html__('Add to Queue', 'optivra-image-studio-for-woocommerce'); ?></button>
				</form>
				<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_admin_page_url('health')); ?>"><?php echo esc_html__('Review Images', 'optivra-image-studio-for-woocommerce'); ?></a>
				<form method="post" action="">
					<?php wp_nonce_field('optivra_recommendation_action', 'optivra_recommendation_action_nonce'); ?>
					<input type="hidden" name="optivra_recommendation_action" value="dismiss_recommendation" />
					<input type="hidden" name="optivra_recommendation_key" value="<?php echo esc_attr((string) ($recommendation['key'] ?? '')); ?>" />
					<button type="submit" class="button optivra-action-button is-secondary" <?php disabled('dismissed', $status); ?>><?php echo esc_html__('Dismiss', 'optivra-image-studio-for-woocommerce'); ?></button>
				</form>
			</div>
			<?php if ('' === $this->get_recommendation_id($recommendation) && '' !== $scan_id) : ?>
				<p class="catalogue-image-studio-help"><?php echo esc_html__('This action was derived from summary data. Queue creation will be available when the backend returns item-level recommendation IDs.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php endif; ?>
		</section>
		<?php
	}

	/**
	 * @param array<int,array<string,mixed>> $recommendations Recommendations.
	 */
	private function render_recommendations_table(array $recommendations, string $scan_id): void {
		?>
		<table class="widefat striped optivra-recommendation-table">
			<thead>
				<tr>
					<th><?php echo esc_html__('Recommendation', 'optivra-image-studio-for-woocommerce'); ?></th>
					<th><?php echo esc_html__('Priority', 'optivra-image-studio-for-woocommerce'); ?></th>
					<th><?php echo esc_html__('Action', 'optivra-image-studio-for-woocommerce'); ?></th>
					<th><?php echo esc_html__('Affected', 'optivra-image-studio-for-woocommerce'); ?></th>
					<th><?php echo esc_html__('Time saved', 'optivra-image-studio-for-woocommerce'); ?></th>
					<th><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php if (empty($recommendations)) : ?>
					<tr>
						<td colspan="6"><?php echo esc_html__('No recommendations to show.', 'optivra-image-studio-for-woocommerce'); ?></td>
					</tr>
				<?php else : ?>
					<?php foreach ($recommendations as $recommendation) : ?>
						<tr>
							<td>
								<strong><?php echo esc_html((string) ($recommendation['title'] ?? '')); ?></strong>
								<small><?php echo esc_html($this->get_recommendation_action_note((string) ($recommendation['action_type'] ?? 'review_manually'))); ?></small>
							</td>
							<td><?php $this->render_severity_badge((string) ($recommendation['priority'] ?? 'medium')); ?></td>
							<td><?php echo esc_html($this->get_recommendation_action_label((string) ($recommendation['action_type'] ?? 'review_manually'))); ?></td>
							<td><?php echo esc_html((string) (int) ($recommendation['affected'] ?? 0)); ?></td>
							<td><?php echo esc_html(sprintf(__('%1$d-%2$d min', 'optivra-image-studio-for-woocommerce'), (int) ($recommendation['minutes_low'] ?? 0), (int) ($recommendation['minutes_high'] ?? 0))); ?></td>
							<td><?php $this->render_status_badge($this->get_recommendation_status_label((string) ($recommendation['status'] ?? 'available')), (string) ($recommendation['status'] ?? 'available')); ?></td>
						</tr>
					<?php endforeach; ?>
				<?php endif; ?>
			</tbody>
		</table>
		<?php
	}

	private function dismiss_recommendation(string $scan_id, string $key): void {
		$dismissed = get_option('optivra_dismissed_recommendations', []);
		$dismissed = is_array($dismissed) ? $dismissed : [];
		if (! isset($dismissed[$scan_id]) || ! is_array($dismissed[$scan_id])) {
			$dismissed[$scan_id] = [];
		}

		$dismissed[$scan_id][$key] = current_time('mysql');
		update_option('optivra_dismissed_recommendations', $dismissed, false);
	}

	private function is_recommendation_dismissed(string $scan_id, string $key): bool {
		$dismissed = get_option('optivra_dismissed_recommendations', []);
		$dismissed = is_array($dismissed) ? $dismissed : [];

		return isset($dismissed[$scan_id]) && is_array($dismissed[$scan_id]) && isset($dismissed[$scan_id][$key]);
	}

	private function render_backgrounds_tab(array $settings): void {
		$background = (string) ($settings['background_preset'] ?? 'optivra-default');
		$source     = (string) ($settings['background_source'] ?? 'preset');
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Backgrounds', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<?php $this->render_settings_section(__('Background defaults', 'optivra-image-studio-for-woocommerce'), __('Manage clean product background defaults used by Optivra processing jobs.', 'optivra-image-studio-for-woocommerce')); ?>
			<p><strong><?php echo esc_html__('Current preset:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html($background); ?></p>
			<p><strong><?php echo esc_html__('Current source:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html($source); ?></p>
			<p><strong><?php echo esc_html__('Custom background:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo ! empty($settings['custom_background_attachment_id']) ? esc_html__('Configured', 'optivra-image-studio-for-woocommerce') : esc_html__('Not configured', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php if (! empty($settings['debug_mode'])) : ?>
				<p class="catalogue-image-studio-help"><strong><?php echo esc_html__('Debug attachment ID:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) (int) ($settings['custom_background_attachment_id'] ?? 0)); ?></p>
			<?php endif; ?>
			<a class="button button-primary" href="<?php echo esc_url($this->get_admin_page_url('settings')); ?>"><?php echo esc_html__('Edit Background Settings', 'optivra-image-studio-for-woocommerce'); ?></a>
		</div>
		<?php
	}

	private function render_seo_tools_tab(array $settings): void {
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('SEO Tools', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<?php $this->render_settings_section(__('Metadata automation', 'optivra-image-studio-for-woocommerce'), __('Review the SEO metadata settings Optivra uses when creating processed product images.', 'optivra-image-studio-for-woocommerce')); ?>
			<ul class="catalogue-image-studio-list">
				<li><?php echo esc_html(sprintf(__('Generate alt text: %s', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_alt_text']) ? __('Yes', 'optivra-image-studio-for-woocommerce') : __('No', 'optivra-image-studio-for-woocommerce'))); ?></li>
				<li><?php echo esc_html(sprintf(__('Generate image titles: %s', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_image_title']) ? __('Yes', 'optivra-image-studio-for-woocommerce') : __('No', 'optivra-image-studio-for-woocommerce'))); ?></li>
				<li><?php echo esc_html(sprintf(__('Generate SEO filenames: %s', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_seo_filename']) ? __('Yes', 'optivra-image-studio-for-woocommerce') : __('No', 'optivra-image-studio-for-woocommerce'))); ?></li>
			</ul>
			<a class="button button-primary" href="<?php echo esc_url($this->get_admin_page_url('settings')); ?>"><?php echo esc_html__('Edit SEO Settings', 'optivra-image-studio-for-woocommerce'); ?></a>
		</div>
		<?php
	}

	private function render_account_billing_tab(array $settings, $usage): void {
		$connected = ! is_wp_error($usage);
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Account & Billing', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<?php $this->render_connection_status($usage, $connected); ?>
			<?php if ($connected && is_array($usage)) : ?>
				<div class="catalogue-image-studio-cta-buttons">
					<a class="button button-primary" href="<?php echo esc_url($this->get_account_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Manage Account', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_buy_credits_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Buy Credits', 'optivra-image-studio-for-woocommerce'); ?></a>
				</div>
			<?php else : ?>
				<a class="button button-primary" href="<?php echo esc_url($this->get_admin_page_url('settings')); ?>"><?php echo esc_html__('Connect Store', 'optivra-image-studio-for-woocommerce'); ?></a>
			<?php endif; ?>
			<p class="catalogue-image-studio-help"><?php echo esc_html__('Saved API tokens are masked in the plugin and are never displayed directly.', 'optivra-image-studio-for-woocommerce'); ?></p>
		</div>
		<?php
	}

	private function render_support_tab(): void {
		?>
		<div class="catalogue-image-studio-panel">
			<h2><?php echo esc_html__('Support', 'optivra-image-studio-for-woocommerce'); ?></h2>
			<p><?php echo esc_html__('Use this page to find diagnostics, failed job information and account support links.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php $this->render_insight_card(__('Support-ready diagnostics', 'optivra-image-studio-for-woocommerce'), __('Debug details stay hidden unless Debug Mode is enabled in Settings, so normal admin pages do not expose technical internals.', 'optivra-image-studio-for-woocommerce'), 'info'); ?>
			<div class="catalogue-image-studio-cta-buttons">
				<a class="button button-primary" href="<?php echo esc_url($this->get_admin_page_url('logs')); ?>"><?php echo esc_html__('View Diagnostics', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a class="button" href="<?php echo esc_url('https://www.optivra.app/support'); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Contact Support', 'optivra-image-studio-for-woocommerce'); ?></a>
			</div>
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
					<?php $this->render_select_setting('processing_mode', __('Default processing mode', 'optivra-image-studio-for-woocommerce'), __('SEO/Product Feed Safe Mode with product preservation is recommended for main WooCommerce images.', 'optivra-image-studio-for-woocommerce'), $this->get_processing_modes(), (string) ($settings['processing_mode'] ?? 'seo_product_feed_preserve')); ?>
					<?php $this->render_toggle_setting('preserve_product_exactly', __('Preserve product exactly', 'optivra-image-studio-for-woocommerce'), __('Prevents AI from regenerating or changing the product. Uses expert background removal and preserves the original product pixels while replacing only the background.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['preserve_product_exactly'])); ?>
					<?php $this->render_toggle_setting('auto_fail_product_altered', __('Auto-fail if product appears altered', 'optivra-image-studio-for-woocommerce'), __('Failed preservation checks stop the image before it can be applied.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_fail_product_altered'])); ?>
					<?php $this->render_toggle_setting('auto_fix_crop_spacing', __('Auto-fix crop and spacing', 'optivra-image-studio-for-woocommerce'), __('Optivra deterministically improves excessive whitespace after background replacement.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_fix_crop_spacing'])); ?>
					<?php $this->render_toggle_setting('preserve_dark_detail', __('Preserve dark product detail', 'optivra-image-studio-for-woocommerce'), __('Avoid crushed blacks and heavy contrast changes on dark product parts.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['preserve_dark_detail'])); ?>
					<?php $this->render_toggle_setting('duplicate_detection', __('Duplicate detection', 'optivra-image-studio-for-woocommerce'), __('Reuse previous processed results when the same source image is encountered.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['duplicate_detection'])); ?>
					<?php $this->render_toggle_setting('pause_on_low_credits', __('Pause processing when credits are low', 'optivra-image-studio-for-woocommerce'), __('Stop larger queue batches before credits are exhausted.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['pause_on_low_credits'])); ?>
					<?php $this->render_toggle_setting('retry_failed_jobs', __('Retry failed jobs automatically', 'optivra-image-studio-for-woocommerce'), __('Keep failed jobs ready for a quick retry pass.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['retry_failed_jobs'])); ?>
					<?php $this->render_toggle_setting('auto_refresh_job_status', __('Auto-refresh job status', 'optivra-image-studio-for-woocommerce'), __('Refresh queue status while jobs are active.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_refresh_job_status'])); ?>
					<?php $this->render_number_setting('batch_size', __('Batch size', 'optivra-image-studio-for-woocommerce'), __('How many queued images to process at once.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['batch_size'] ?? 10), 1, 50); ?>
				</section>

				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Background', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Choose an Optivra preset or upload a brand background from the Media Library.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_select_setting('background_source', __('Default background', 'optivra-image-studio-for-woocommerce'), __('Use a clean preset or your own uploaded background image.', 'optivra-image-studio-for-woocommerce'), ['preset' => __('Preset background', 'optivra-image-studio-for-woocommerce'), 'custom' => __('Custom uploaded background', 'optivra-image-studio-for-woocommerce')], (string) ($settings['background_source'] ?? 'preset')); ?>
					<?php $this->render_select_setting('background_preset', __('Background preset', 'optivra-image-studio-for-woocommerce'), __('Default background style when using presets.', 'optivra-image-studio-for-woocommerce'), $this->get_background_presets(), (string) ($settings['background_preset'] ?? 'optivra-default')); ?>
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
					<?php $this->render_select_setting('product_fit', __('Default product fit', 'optivra-image-studio-for-woocommerce'), __('Auto chooses the right coverage for horizontal, square, and tall products.', 'optivra-image-studio-for-woocommerce'), $this->get_product_fit_modes(), (string) ($settings['product_fit'] ?? 'auto')); ?>
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
					<?php $this->render_toggle_setting('send_operational_diagnostics', __('Send operational usage diagnostics to Optivra', 'optivra-image-studio-for-woocommerce'), __('After connection, send plugin version, scan counts, queue counts, processing status, credit balance, and error diagnostics needed for account status and support. No API tokens or secret keys are sent.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['send_operational_diagnostics'])); ?>
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
			<?php $settings = $this->plugin->get_settings(); ?>
			<?php if (! empty($settings['debug_mode'])) : ?>
				<button type="button" class="button" onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('catalogue-image-studio-diagnostics').textContent);"><?php echo esc_html__('Copy support diagnostics', 'optivra-image-studio-for-woocommerce'); ?></button>
				<pre id="catalogue-image-studio-diagnostics"><?php echo esc_html(wp_json_encode(['plugin' => CIS_VERSION, 'site' => home_url(), 'php' => PHP_VERSION], JSON_PRETTY_PRINT)); ?></pre>
			<?php else : ?>
				<?php $this->render_empty_state(__('Diagnostics are hidden', 'optivra-image-studio-for-woocommerce'), __('Enable Debug Mode in Settings when Optivra support asks for technical diagnostics.', 'optivra-image-studio-for-woocommerce'), __('Open Settings', 'optivra-image-studio-for-woocommerce'), $this->get_admin_page_url('settings')); ?>
			<?php endif; ?>
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
					<tr><td colspan="<?php echo esc_attr($selectable ? '8' : '7'); ?>"><?php $this->render_empty_state(__('Nothing to show yet', 'optivra-image-studio-for-woocommerce'), $empty_message); ?></td></tr>
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
			'dashboard'       => __('Dashboard', 'optivra-image-studio-for-woocommerce'),
			'scan'            => __('Product Scan', 'optivra-image-studio-for-woocommerce'),
			'health'          => __('Health Report', 'optivra-image-studio-for-woocommerce'),
			'recommendations' => __('Recommendations', 'optivra-image-studio-for-woocommerce'),
			'queue'           => __('Queue', 'optivra-image-studio-for-woocommerce'),
			'review'          => __('Review', 'optivra-image-studio-for-woocommerce'),
			'backgrounds'     => __('Backgrounds', 'optivra-image-studio-for-woocommerce'),
			'seo'             => __('SEO Tools', 'optivra-image-studio-for-woocommerce'),
			'settings'        => __('Settings', 'optivra-image-studio-for-woocommerce'),
			'account'         => __('Account', 'optivra-image-studio-for-woocommerce'),
			'support'         => __('Support', 'optivra-image-studio-for-woocommerce'),
		];
		?>
		<nav class="nav-tab-wrapper catalogue-image-studio-tabs">
			<?php foreach ($tabs as $tab => $label) : ?>
				<a class="nav-tab <?php echo $tab === $active_tab ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url($this->get_admin_page_url($tab)); ?>">
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
			<p><?php echo esc_html__('After connection, Optivra Image Studio also sends operational data needed to provide the service, such as plugin version, WordPress/WooCommerce/PHP versions, store connection status, credit balance, scan counts, queue counts, processing status, and error diagnostics. No API tokens, passwords, order details, payment details, or secret keys are sent.', 'optivra-image-studio-for-woocommerce'); ?></p>
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
			<?php $this->render_number_setting('target_product_coverage', __('Target product coverage', 'optivra-image-studio-for-woocommerce'), __('Default target coverage percentage for long horizontal products.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['target_product_coverage'] ?? 86), 70, 90); ?>
			<?php $this->render_number_setting('max_retries', __('Max retries', 'optivra-image-studio-for-woocommerce'), __('Preserve mode is capped at 2 attempts; standard mode is capped at 1 attempt.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['max_retries'] ?? 2), 1, 2); ?>
			<?php $this->render_number_setting('output_size', __('Output size', 'optivra-image-studio-for-woocommerce'), __('Default square output size in pixels.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['output_size'] ?? 1024), 512, 2048); ?>
			<?php $this->render_select_setting('output_aspect_ratio', __('Output aspect ratio', 'optivra-image-studio-for-woocommerce'), __('Default is square for WooCommerce and product feeds.', 'optivra-image-studio-for-woocommerce'), ['1:1' => __('Square 1:1', 'optivra-image-studio-for-woocommerce')], (string) ($settings['output_aspect_ratio'] ?? '1:1')); ?>
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
		<?php if (! empty($usage['free_credit_message']) && is_string($usage['free_credit_message'])) : ?>
			<p class="catalogue-image-studio-muted"><?php echo esc_html($usage['free_credit_message']); ?></p>
		<?php endif; ?>
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
					<input type="hidden" name="<?php echo esc_attr($name); ?>" value="0" />
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
			'optivra-default' => __('Off-white studio', 'optivra-image-studio-for-woocommerce'),
			'white'           => __('Pure white', 'optivra-image-studio-for-woocommerce'),
			'light-grey'      => __('Light grey', 'optivra-image-studio-for-woocommerce'),
			'transparent'     => __('Transparent', 'optivra-image-studio-for-woocommerce'),
			'soft-white'      => __('Soft white', 'optivra-image-studio-for-woocommerce'),
			'cool-studio'     => __('Cool light grey', 'optivra-image-studio-for-woocommerce'),
			'warm-studio'     => __('Warm light grey', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_processing_modes(): array {
		return [
			'seo_product_feed_preserve' => __('Preserve product + clean background', 'optivra-image-studio-for-woocommerce'),
			'standard_ecommerce_cleanup' => __('Standard ecommerce cleanup', 'optivra-image-studio-for-woocommerce'),
			'premium_studio_background' => __('Premium studio background', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_product_fit_modes(): array {
		return [
			'auto'     => __('Auto', 'optivra-image-studio-for-woocommerce'),
			'tight'    => __('Tight', 'optivra-image-studio-for-woocommerce'),
			'balanced' => __('Balanced', 'optivra-image-studio-for-woocommerce'),
			'generous' => __('Generous', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_scale_modes(): array {
		return [
			'auto'     => __('Auto', 'optivra-image-studio-for-woocommerce'),
			'tight'    => __('Tight', 'optivra-image-studio-for-woocommerce'),
			'balanced' => __('Balanced', 'optivra-image-studio-for-woocommerce'),
			'loose'    => __('Generous', 'optivra-image-studio-for-woocommerce'),
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

	private function sanitize_processing_mode($mode): string {
		$mode = sanitize_key((string) $mode);
		return array_key_exists($mode, $this->get_processing_modes()) ? $mode : 'seo_product_feed_preserve';
	}

	private function sanitize_product_fit($mode): string {
		$mode = sanitize_key((string) $mode);
		return array_key_exists($mode, $this->get_product_fit_modes()) ? $mode : 'auto';
	}

	private function sanitize_output_aspect_ratio($ratio): string {
		$ratio = (string) $ratio;
		return '1:1' === $ratio ? '1:1' : '1:1';
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
		$scale_mode = (string) ($settings['product_fit'] ?? $settings['default_scale_mode'] ?? $settings['scale_mode'] ?? 'auto');
		$background_source = (string) ($settings['background_source'] ?? 'preset');

		$options = [];
		$custom_background_url = '';
		if ('custom' === $background_source) {
			$custom_background_url = (string) wp_get_attachment_url(absint($settings['custom_background_attachment_id'] ?? 0));
			if ($custom_background_url) {
				$options['background_image_url'] = $custom_background_url;
				$options['background_attachment_id'] = absint($settings['custom_background_attachment_id'] ?? 0);
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
			'preserveProductExactly' => ! empty($settings['preserve_product_exactly']),
			'processingMode' => (string) ($settings['processing_mode'] ?? 'seo_product_feed_preserve'),
			'promptVersion' => 'ecommerce_preserve_v2',
			'autoFailIfProductAltered' => ! empty($settings['auto_fail_product_altered']),
			'autoFixCropSpacing' => ! empty($settings['auto_fix_crop_spacing']),
			'preserveDarkDetail' => ! empty($settings['preserve_dark_detail']),
			'maxRetries' => (int) ($settings['max_retries'] ?? 2),
			'output' => [
				'size' => (int) ($settings['output_size'] ?? 1024),
				'aspectRatio' => (string) ($settings['output_aspect_ratio'] ?? '1:1'),
			],
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
				'targetCoverage'           => (int) ($settings['target_product_coverage'] ?? 86),
				'useTargetCoverage'        => 86 !== (int) ($settings['target_product_coverage'] ?? 86),
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
			'optivra-default' => 'optivra-default',
			'white'           => 'white',
			'light-grey'      => 'light-grey',
			'transparent'     => 'transparent',
			'soft-white'      => '#f8f8f5',
			'cool-studio'     => '#f4f7fb',
			'warm-studio'     => '#faf7f2',
		];

		return $map[$preset] ?? 'optivra-default';
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
				<?php $display_error = $this->format_job_error((string) ($job['error_message'] ?? '')); ?>
				<?php $this->render_status_badge($this->format_status((string) $job['status']), $this->map_job_status_to_badge((string) $job['status'])); ?><?php echo '' !== $display_error ? '<br /><small>' . esc_html($display_error) . '</small>' : ''; ?>
				<?php if (in_array((string) ($job['status'] ?? ''), ['queued', 'processing', 'failed', 'completed', 'rejected'], true)) : ?>
					<?php $this->render_job_edge_controls($job); ?>
				<?php endif; ?>
				<?php $this->render_output_validation_summary($job); ?>
				<?php $this->render_job_diagnostics($job); ?>
			</td>
			<td><?php $this->render_seo_fields($job); ?></td>
			<td>
				<?php echo '' !== $display_error ? esc_html($display_error) : esc_html((string) ($job['updated_at'] ?? '')); ?>
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
		<a href="<?php echo esc_url($url); ?>" target="_blank" rel="noopener noreferrer" class="optivra-image-thumbnail">
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
		$settings = $this->plugin->get_settings();
		if (empty($settings['debug_mode'])) {
			return;
		}

		$rows = [
			__('Job ID', 'optivra-image-studio-for-woocommerce')                  => (string) ($job['id'] ?? ''),
			__('Product ID', 'optivra-image-studio-for-woocommerce')              => (string) ($job['product_id'] ?? ''),
			__('Original attachment ID', 'optivra-image-studio-for-woocommerce')  => (string) ($job['original_attachment_id'] ?? $job['attachment_id'] ?? ''),
			__('Processed attachment ID', 'optivra-image-studio-for-woocommerce') => (string) ($job['processed_attachment_id'] ?? ''),
			__('Processed URL', 'optivra-image-studio-for-woocommerce')           => (string) ($job['processed_url'] ?? ''),
			__('Storage bucket', 'optivra-image-studio-for-woocommerce')          => (string) ($job['processed_storage_bucket'] ?? ''),
			__('Storage path', 'optivra-image-studio-for-woocommerce')            => (string) ($job['processed_storage_path'] ?? ''),
			__('Last processing error', 'optivra-image-studio-for-woocommerce')   => $this->format_job_error((string) ($job['error_message'] ?? '')),
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
			<?php $this->render_preserve_diagnostics($job); ?>
		</details>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 */
	private function render_output_validation_summary(array $job): void {
		$validation = $this->get_output_validation($job);

		if (empty($validation)) {
			return;
		}

		$status = (string) ($validation['status'] ?? '');
		$checks = isset($validation['checks']) && is_array($validation['checks']) ? $validation['checks'] : [];
		$failure_reasons = isset($validation['failureReasons']) && is_array($validation['failureReasons']) ? $validation['failureReasons'] : [];
		$scores = isset($validation['scores']) && is_array($validation['scores']) ? $validation['scores'] : [];
		?>
		<div class="optivra-validation-summary">
			<?php if ('Passed' !== $status && ! empty($failure_reasons)) : ?>
				<strong><?php echo esc_html(sprintf(__('Failed: %s', 'optivra-image-studio-for-woocommerce'), implode(', ', array_map('strval', $failure_reasons)))); ?></strong><br />
			<?php else : ?>
				<strong><?php echo esc_html('Passed' === $status ? __('Passed', 'optivra-image-studio-for-woocommerce') : $status); ?></strong><br />
			<?php endif; ?>
			<strong><?php echo esc_html__('Product Preservation:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['productPreservation'] ?? $status)); ?><br />
			<strong><?php echo esc_html__('Framing:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['framing'] ?? $status)); ?><br />
			<strong><?php echo esc_html__('Background:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['background'] ?? $status)); ?><br />
			<strong><?php echo esc_html__('Detail Preservation:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['detailPreservation'] ?? $status)); ?><br />
			<strong><?php echo esc_html__('Interior Product Dropout:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['interiorDropout'] ?? $status)); ?><br />
			<strong><?php echo esc_html__('Edge Cleanliness:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['edgeQuality'] ?? $status)); ?><br />
			<strong><?php echo esc_html__('Vision QA:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['visionQa'] ?? __('Not reached', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Product preservation score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['productPreservation'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Edge cleanliness score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['edgeCleanliness'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Background residue score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['backgroundResidue'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Alpha mask confidence score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['alphaConfidence'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Dropout score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['dropoutScore'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Vision QA ecommerce score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['visionQaEcommerce'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Coverage:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html(isset($validation['productCoveragePercent']) ? sprintf('%.2f%%', (float) $validation['productCoveragePercent']) : __('Not stored', 'optivra-image-studio-for-woocommerce')); ?><br />
			<strong><?php echo esc_html__('Prompt:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($validation['promptVersion'] ?? '')); ?><br />
			<strong><?php echo esc_html__('Mode:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($validation['processingMode'] ?? '')); ?><br />
			<strong><?php echo esc_html__('Retry count:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($validation['retryCount'] ?? '0')); ?>
			<?php if (! empty($validation['autoFixedFraming'])) : ?>
				<p class="catalogue-image-studio-help"><?php echo esc_html__('Optivra automatically improved the crop so the product fills the frame more professionally.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php endif; ?>
			<?php if (in_array((string) ($checks['productPreservation'] ?? ''), ['Failed', 'Needs Review'], true)) : ?>
				<p class="catalogue-image-studio-warning"><?php echo esc_html__('Needs Review: Optivra detected possible product changes. This image was not applied automatically.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php endif; ?>
			<?php if (in_array((string) ($checks['interiorDropout'] ?? ''), ['Failed', 'Needs Review'], true)) : ?>
				<p class="catalogue-image-studio-warning"><?php echo esc_html__('Needs Review: Optivra detected possible missing product material inside the object. This image was not applied automatically.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php endif; ?>
			<?php if (in_array('Edge Halo / Background Residue', array_map('strval', $failure_reasons), true)) : ?>
				<p class="catalogue-image-studio-warning"><?php echo esc_html__('Failed: Edge Halo / Background Residue. This image was not applied automatically.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php endif; ?>
			<?php if (in_array('AI Product Pixel Contamination', array_map('strval', $failure_reasons), true)) : ?>
				<p class="catalogue-image-studio-warning"><?php echo esc_html__('Failed: AI Product Pixel Contamination. This image was not applied automatically.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 */
	private function render_preserve_diagnostics(array $job): void {
		$diagnostics = $this->get_preserve_diagnostics($job);

		if (empty($diagnostics)) {
			return;
		}

		$mask = isset($diagnostics['mask']) && is_array($diagnostics['mask']) ? $diagnostics['mask'] : [];
		$bbox = isset($mask['bbox']) && is_array($mask['bbox']) ? $mask['bbox'] : [];
		$rgb  = isset($diagnostics['rgbIntegrity']) && is_array($diagnostics['rgbIntegrity']) ? $diagnostics['rgbIntegrity'] : [];
		$interior_dropout = isset($diagnostics['interiorDropout']) && is_array($diagnostics['interiorDropout']) ? $diagnostics['interiorDropout'] : [];
		$validation = $this->get_output_validation($job);
		$rows = [
			__('Prompt version', 'optivra-image-studio-for-woocommerce')          => (string) ($diagnostics['promptVersion'] ?? $validation['promptVersion'] ?? ''),
			__('Processing mode', 'optivra-image-studio-for-woocommerce')         => (string) ($diagnostics['processingMode'] ?? $validation['processingMode'] ?? ''),
			__('Preserve failure reason', 'optivra-image-studio-for-woocommerce') => (string) ($diagnostics['failureReason'] ?? ''),
			__('Preserve final status', 'optivra-image-studio-for-woocommerce')  => (string) ($diagnostics['finalStatus'] ?? ''),
			__('Mask source', 'optivra-image-studio-for-woocommerce')            => (string) ($diagnostics['maskSource'] ?? ''),
			__('Fallback mode', 'optivra-image-studio-for-woocommerce')          => (string) ($diagnostics['fallbackMode'] ?? ''),
			__('Provider', 'optivra-image-studio-for-woocommerce')               => (string) ($diagnostics['provider'] ?? ''),
			__('Attempts', 'optivra-image-studio-for-woocommerce')               => (string) ($diagnostics['attempts'] ?? ''),
			__('Foreground coverage', 'optivra-image-studio-for-woocommerce')    => isset($mask['alphaCoveragePercent']) ? sprintf('%.3f%%', (float) $mask['alphaCoveragePercent']) : '',
			__('Mask bounding box', 'optivra-image-studio-for-woocommerce')      => sprintf('%d,%d %dx%d', (int) ($bbox['x'] ?? 0), (int) ($bbox['y'] ?? 0), (int) ($bbox['width'] ?? 0), (int) ($bbox['height'] ?? 0)),
			__('Connected components', 'optivra-image-studio-for-woocommerce')   => (string) ($mask['connectedComponentCount'] ?? ''),
			__('Background-only blocker', 'optivra-image-studio-for-woocommerce') => ! empty($diagnostics['backgroundOnlyBlockerTriggered']) ? __('Triggered', 'optivra-image-studio-for-woocommerce') : __('Not triggered', 'optivra-image-studio-for-woocommerce'),
			__('RGB integrity', 'optivra-image-studio-for-woocommerce')          => ! empty($rgb['passed']) ? __('Passed', 'optivra-image-studio-for-woocommerce') : __('Failed or not reached', 'optivra-image-studio-for-woocommerce'),
			__('Interior dropout restored', 'optivra-image-studio-for-woocommerce') => (string) ($interior_dropout['restoredRegionCount'] ?? '0'),
			__('Interior dropout unresolved', 'optivra-image-studio-for-woocommerce') => (string) ($interior_dropout['unresolvedRegionCount'] ?? '0'),
			__('Output validation', 'optivra-image-studio-for-woocommerce')       => (string) ($validation['status'] ?? ''),
		];
		?>
		<h4><?php echo esc_html__('Preserve-mode diagnostics', 'optivra-image-studio-for-woocommerce'); ?></h4>
		<dl>
			<?php foreach ($rows as $label => $value) : ?>
				<dt><?php echo esc_html($label); ?></dt>
				<dd><?php echo '' !== trim((string) $value) ? esc_html((string) $value) : esc_html__('Not stored', 'optivra-image-studio-for-woocommerce'); ?></dd>
			<?php endforeach; ?>
		</dl>
		<?php if (! empty($mask['failureReasons']) && is_array($mask['failureReasons'])) : ?>
			<ul>
				<?php foreach ($mask['failureReasons'] as $reason) : ?>
					<li><?php echo esc_html((string) $reason); ?></li>
				<?php endforeach; ?>
			</ul>
		<?php endif; ?>
		<?php if (! empty($diagnostics['assets']) && is_array($diagnostics['assets'])) : ?>
			<ul>
				<?php foreach ($diagnostics['assets'] as $asset) : ?>
					<?php if (! is_array($asset) || empty($asset['url']) || ! is_string($asset['url'])) { continue; } ?>
					<li>
						<a href="<?php echo esc_url($asset['url']); ?>" target="_blank" rel="noopener noreferrer">
							<?php echo esc_html((string) ($asset['kind'] ?? __('Debug image', 'optivra-image-studio-for-woocommerce'))); ?>
						</a>
					</li>
				<?php endforeach; ?>
			</ul>
		<?php endif; ?>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return array<string,mixed>
	 */
	private function get_preserve_diagnostics(array $job): array {
		$raw = (string) ($job['processing_diagnostics'] ?? '');

		if ('' === trim($raw)) {
			return [];
		}

		$decoded = json_decode($raw, true);

		return is_array($decoded) ? $decoded : [];
	}

	/**
	 * @param array<string,mixed> $job Job.
	 * @return array<string,mixed>
	 */
	private function get_output_validation(array $job): array {
		$diagnostics = $this->get_preserve_diagnostics($job);

		if (isset($diagnostics['output_validation']) && is_array($diagnostics['output_validation'])) {
			return $diagnostics['output_validation'];
		}

		if (isset($diagnostics['outputValidation']) && is_array($diagnostics['outputValidation'])) {
			return $diagnostics['outputValidation'];
		}

		return [];
	}

	private function format_status(string $status): string {
		return ucwords(str_replace('_', ' ', sanitize_key($status)));
	}

	private function map_job_status_to_badge(string $status): string {
		switch (sanitize_key($status)) {
			case 'failed':
				return 'failed';
			case 'queued':
				return 'queued';
			case 'processing':
				return 'processing';
			case 'approved':
				return 'approved';
			case 'completed':
			case 'rejected':
				return 'needs-review';
			case 'reverted':
			case 'resolved':
				return 'resolved';
			case 'unprocessed':
			default:
				return 'ready';
		}
	}

	private function format_job_error(string $message): string {
		if ('' === trim($message)) {
			return '';
		}

		if (false !== stripos($message, 'Product area changed too much')) {
			return __('Legacy preservation warning from an older processing run. Reprocess this image with the current version.', 'optivra-image-studio-for-woocommerce');
		}

		return $message;
	}
}
