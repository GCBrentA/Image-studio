<?php
/**
 * Core plugin bootstrap and settings defaults.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Optiimst_Plugin {
	private const SCHEMA_VERSION = '20260429_product_preservation_safety';

	/**
	 * Singleton instance.
	 *
	 * @var Optiimst_Plugin|null
	 */
	private static $instance = null;

	/**
	 * Option key for plugin settings.
	 *
	 * @var string
	 */
	private $option_name = 'optiimst_settings';

	/**
	 * Logger.
	 *
	 * @var Optiimst_Logger
	 */
	private $logger;

	/**
	 * Job repository.
	 *
	 * @var Optiimst_Job_Repository
	 */
	private $jobs;

	/**
	 * Product scanner.
	 *
	 * @var Optiimst_ProductScanner
	 */
	private $scanner;

	/**
	 * SaaS client.
	 *
	 * @var Optiimst_SaaSClient
	 */
	private $client;

	/**
	 * Media manager.
	 *
	 * @var Optiimst_MediaManager
	 */
	private $media;

	/**
	 * SEO metadata generator.
	 *
	 * @var Optiimst_SEO_Metadata_Generator
	 */
	private $seo_generator;

	/**
	 * Approval manager.
	 *
	 * @var Optiimst_ApprovalManager
	 */
	private $approval;

	/**
	 * Image processor.
	 *
	 * @var Optiimst_ImageProcessor
	 */
	private $processor;

	/**
	 * Return singleton instance.
	 *
	 * @return Optiimst_Plugin
	 */
	public static function instance(): Optiimst_Plugin {
		if (! self::$instance instanceof self) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Seed default options on activation.
	 *
	 * @return void
	 */
	public static function activate(): void {
		self::create_tables();
		optiimst_update_option('optiimst_schema_version', self::SCHEMA_VERSION, false);
		$settings = optiimst_get_option('optiimst_settings', []);

		if (! is_array($settings)) {
			$settings = [];
		}

		optiimst_update_option(
			'optiimst_settings',
			wp_parse_args($settings, self::default_settings()),
			false
		);
	}

	/**
	 * Run additive schema updates for already-installed plugin copies.
	 *
	 * @return void
	 */
	public static function maybe_upgrade_schema(): void {
		if (self::SCHEMA_VERSION === (string) optiimst_get_option('optiimst_schema_version', '')) {
			return;
		}

		self::create_tables();
		optiimst_update_option('optiimst_schema_version', self::SCHEMA_VERSION, false);
	}

	/**
	 * Create plugin database tables.
	 *
	 * @return void
	 */
	public static function create_tables(): void {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table           = optiimst_table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			product_id bigint(20) unsigned NOT NULL,
			attachment_id bigint(20) unsigned NOT NULL,
			image_role varchar(20) NOT NULL DEFAULT 'featured',
			gallery_index int(11) NOT NULL DEFAULT 0,
			original_attachment_id bigint(20) unsigned NOT NULL DEFAULT 0,
			current_attachment_id bigint(20) unsigned NOT NULL DEFAULT 0,
			processed_attachment_id bigint(20) unsigned NOT NULL DEFAULT 0,
			original_file_path text NULL,
			processed_url text NULL,
			processed_storage_bucket varchar(100) NULL,
			processed_storage_path text NULL,
			processed_mime_type varchar(100) NULL,
			processed_width int(11) NOT NULL DEFAULT 0,
			processed_height int(11) NOT NULL DEFAULT 0,
			processing_diagnostics longtext NULL,
			seo_filename text NULL,
			seo_alt_text text NULL,
			seo_title text NULL,
			seo_caption text NULL,
			seo_description longtext NULL,
			edge_to_edge_enabled tinyint(1) NOT NULL DEFAULT 0,
			edge_to_edge_left tinyint(1) NOT NULL DEFAULT 0,
			edge_to_edge_right tinyint(1) NOT NULL DEFAULT 0,
			edge_to_edge_top tinyint(1) NOT NULL DEFAULT 0,
			edge_to_edge_bottom tinyint(1) NOT NULL DEFAULT 0,
			audit_source varchar(40) NULL,
			audit_scan_id varchar(80) NULL,
			audit_recommendation_id varchar(80) NULL,
			audit_issue_id varchar(80) NULL,
			audit_queue_job_id varchar(80) NULL,
			audit_action_type varchar(40) NULL,
			audit_priority varchar(20) NULL,
			audit_background_preset varchar(100) NULL,
			audit_job_kind varchar(40) NULL,
			safety_status varchar(20) NULL,
			safety_metadata longtext NULL,
			processing_mode varchar(100) NULL,
			status varchar(20) NOT NULL DEFAULT 'unprocessed',
			error_message longtext NULL,
			approval_error longtext NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			scanned_at datetime NULL,
			queued_at datetime NULL,
			processed_at datetime NULL,
			approved_at datetime NULL,
			reverted_at datetime NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY product_slot (product_id, image_role, gallery_index),
			KEY status (status),
			KEY product_id (product_id),
			KEY attachment_id (attachment_id),
			KEY audit_source (audit_source),
			KEY audit_scan_id (audit_scan_id),
			KEY safety_status (safety_status)
		) {$charset_collate};";

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange -- dbDelta is required for the plugin's custom queue table.
		dbDelta($sql);

		$versions_table = optiimst_versions_table_name();
		$versions_sql = "CREATE TABLE {$versions_table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			job_id bigint(20) unsigned NOT NULL DEFAULT 0,
			product_id bigint(20) unsigned NOT NULL DEFAULT 0,
			image_role varchar(20) NOT NULL DEFAULT 'featured',
			gallery_index int(11) NOT NULL DEFAULT 0,
			original_attachment_id bigint(20) unsigned NOT NULL DEFAULT 0,
			original_url text NULL,
			original_file_path text NULL,
			processed_attachment_id bigint(20) unsigned NOT NULL DEFAULT 0,
			processed_url text NULL,
			processed_file_path text NULL,
			processing_mode varchar(100) NULL,
			approval_status varchar(20) NOT NULL DEFAULT 'approved',
			approved_by bigint(20) unsigned NOT NULL DEFAULT 0,
			approved_at datetime NULL,
			reverted_by bigint(20) unsigned NOT NULL DEFAULT 0,
			reverted_at datetime NULL,
			safety_status varchar(20) NULL,
			safety_metadata longtext NULL,
			audit_scan_id varchar(80) NULL,
			audit_recommendation_id varchar(80) NULL,
			audit_issue_id varchar(80) NULL,
			audit_queue_job_id varchar(80) NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY job_id (job_id),
			KEY product_id (product_id),
			KEY approval_status (approval_status),
			KEY safety_status (safety_status),
			KEY audit_scan_id (audit_scan_id)
		) {$charset_collate};";

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange -- dbDelta is required for the plugin's custom version history table.
		dbDelta($versions_sql);
	}

	/**
	 * Private constructor for singleton.
	 */
	private function __construct() {
		$this->logger = new Optiimst_Logger();
		$this->jobs   = new Optiimst_Job_Repository();
		$settings     = $this->get_settings();

		$this->scanner   = new Optiimst_ProductScanner($this->jobs, $this->logger);
		$this->client    = new Optiimst_SaaSClient(
			(string) $settings['api_base_url'],
			(string) $settings['api_token'],
			$this->logger
		);
		$this->media         = new Optiimst_MediaManager($this->logger);
		$this->seo_generator = new Optiimst_SEO_Metadata_Generator();
		$this->approval      = new Optiimst_ApprovalManager($this->jobs, $this->media, $settings, $this->logger);
		$this->processor     = new Optiimst_ImageProcessor($this->jobs, $this->client, $this->media, $this->seo_generator, $settings, $this->logger);

		add_action('optiimst_image_studio_scheduled_audit_tick', [$this, 'run_scheduled_audit_tick']);
		add_action('admin_init', [$this, 'maybe_queue_due_scheduled_audit']);
	}

	/**
	 * Get option key.
	 *
	 * @return string
	 */
	public function get_option_name(): string {
		return $this->option_name;
	}

	/**
	 * Get default settings.
	 *
	 * @return array<string, mixed>
	 */
	public function get_default_settings(): array {
		return self::default_settings();
	}

	/**
	 * Get plugin defaults without constructing the runtime singleton.
	 *
	 * @return array<string, mixed>
	 */
	public static function default_settings(): array {
		return [
			'enabled'                 => true,
			'api_base_url'            => 'https://www.optivra.app',
			'api_base_url_override'   => '',
			'api_token'               => '',
			'require_approval'        => true,
			'approval_required'       => true,
			'auto_process_new_images' => false,
			'process_featured_images' => true,
			'process_gallery_images'  => true,
			'process_category_images' => false,
			'duplicate_detection'     => true,
			'preserve_product_exactly' => false,
			'processing_mode'         => 'seo_product_feed_preserve',
			'product_fit'             => 'auto',
			'background_source'       => 'preset',
			'custom_background_attachment_id' => 0,
			'background_preset'       => 'optivra-default',
			'background'              => 'optivra-default',
			'default_scale_mode'      => 'auto',
			'scale_mode'              => 'auto',
			'scale_percent'           => 'auto',
			'framing_padding'         => 3,
			'preserve_transparent_edges' => true,
			'smart_scaling'           => true,
			'smart_scaling_enabled'   => true,
			'apply_shadow'            => true,
			'shadow_enabled'          => true,
			'auto_fail_product_altered' => true,
			'auto_fix_crop_spacing'   => true,
			'preserve_dark_detail'    => true,
			'remove_background_text_logos' => false,
			'shadow_mode'             => 'under',
			'shadow_strength'         => 'medium',
			'shadow_opacity'          => 23,
			'shadow_blur'             => 22,
			'shadow_offset_x'         => 0,
			'shadow_offset_y'         => 0,
			'shadow_spread'           => 100,
			'shadow_softness'         => 60,
			'shadow_color'            => '#000000',
			'lighting_enabled'        => true,
			'lighting_mode'           => 'auto',
			'brightness_correction'   => 0,
			'contrast_correction'     => 0,
			'highlight_recovery'      => true,
			'shadow_lift'             => true,
			'neutralize_tint'         => true,
			'lighting_strength'       => 'medium',
			'target_product_coverage' => 86,
			'max_retries'             => 2,
			'output_size'             => 1024,
			'output_aspect_ratio'     => '1:1',
			'generate_seo_filename'   => true,
			'enable_filename_seo'     => true,
			'generate_alt_text'       => true,
			'enable_alt_text'         => true,
			'generate_image_title'    => true,
			'generate_caption'        => true,
			'generate_description'    => true,
			'only_fill_missing_metadata' => true,
			'only_fill_missing'       => true,
			'overwrite_existing_metadata' => false,
			'overwrite_existing_meta' => false,
			'brand_keyword_suffix'    => '',
			'seo_brand_suffix'        => '',
			'batch_size'              => 10,
			'retry_failed_jobs'       => true,
			'pause_on_low_credits'    => true,
			'pause_low_credits'       => true,
			'auto_refresh_job_status' => true,
			'show_low_credit_warning' => true,
			'show_completion_alerts'  => true,
			'show_job_completion_alerts' => true,
			'show_failed_alerts'      => true,
			'show_failed_job_alerts'  => true,
			'email_batch_complete'    => false,
			'email_job_failed'        => false,
			'audit_schedule_frequency' => 'off',
			'audit_schedule_scan_mode' => 'updated',
			'audit_schedule_email_report' => false,
			'audit_monthly_report_enabled' => true,
			'audit_schedule_next_run_at' => '',
			'notification_email'      => '',
			'send_operational_diagnostics' => true,
			'active_brand_style_preset' => 'optivra-light',
			'brand_style_presets'     => [
				'optivra-light' => [
					'name'                            => 'Optivra light studio',
					'background_type'                 => 'optivra-light',
					'custom_background_attachment_id' => 0,
					'aspect_ratio'                    => '1:1',
					'product_padding'                 => 'balanced',
					'shadow'                          => 'subtle',
					'output_format'                   => 'original',
					'apply_scope'                     => 'all',
					'category_ids'                    => [],
				],
			],
			'category_presets'        => [],
			'debug_mode'              => false,
		];
	}

	/**
	 * Get merged plugin settings.
	 *
	 * @return array<string, mixed>
	 */
	public function get_settings(): array {
		$settings = optiimst_get_option($this->option_name, []);
		$settings = is_array($settings) ? $settings : [];
		$raw_settings = $settings;
		$settings = wp_parse_args($settings, $this->get_default_settings());

		$normalized_override = isset($settings['api_base_url_override']) ? Optiimst_SaaSClient::normalize_api_base_url((string) $settings['api_base_url_override']) : '';
		if ('' !== $normalized_override && Optiimst_SaaSClient::is_local_api_base_url($normalized_override) && empty($settings['debug_mode'])) {
			$normalized_override = '';
		}
		$settings['api_base_url_override'] = $normalized_override;
		$settings['api_base_url']          = '' !== $settings['api_base_url_override']
			? $settings['api_base_url_override']
			: Optiimst_SaaSClient::normalize_api_base_url((string) $this->get_default_settings()['api_base_url']);

		$settings['require_approval']      = array_key_exists('require_approval', $settings) ? (bool) $settings['require_approval'] : (bool) ($settings['approval_required'] ?? true);
		$settings['approval_required']     = $settings['require_approval'];
		$settings['smart_scaling']         = array_key_exists('smart_scaling', $settings) ? (bool) $settings['smart_scaling'] : (bool) ($settings['smart_scaling_enabled'] ?? true);
		$settings['smart_scaling_enabled'] = $settings['smart_scaling'];
		$settings['apply_shadow']          = array_key_exists('apply_shadow', $settings) ? (bool) $settings['apply_shadow'] : (bool) ($settings['shadow_enabled'] ?? true);
		$settings['shadow_enabled']        = $settings['apply_shadow'];
		$settings['shadow_mode']           = isset($settings['shadow_mode']) ? (string) $settings['shadow_mode'] : ($settings['apply_shadow'] ? 'under' : 'off');
		$settings['default_scale_mode']    = isset($settings['default_scale_mode']) ? (string) $settings['default_scale_mode'] : (string) ($settings['scale_mode'] ?? 'auto');
		$settings['scale_mode']            = $settings['default_scale_mode'];
		$settings['generate_seo_filename'] = array_key_exists('generate_seo_filename', $settings) ? (bool) $settings['generate_seo_filename'] : (bool) ($settings['enable_filename_seo'] ?? true);
		$settings['enable_filename_seo']   = $settings['generate_seo_filename'];
		$settings['generate_alt_text']     = array_key_exists('generate_alt_text', $settings) ? (bool) $settings['generate_alt_text'] : (bool) ($settings['enable_alt_text'] ?? true);
		$settings['enable_alt_text']       = $settings['generate_alt_text'];
		$settings['only_fill_missing_metadata'] = array_key_exists('only_fill_missing_metadata', $settings) ? (bool) $settings['only_fill_missing_metadata'] : (bool) ($settings['only_fill_missing'] ?? true);
		$settings['only_fill_missing']     = $settings['only_fill_missing_metadata'];
		$settings['overwrite_existing_metadata'] = array_key_exists('overwrite_existing_metadata', $settings) ? (bool) $settings['overwrite_existing_metadata'] : (bool) ($settings['overwrite_existing_meta'] ?? false);
		$settings['overwrite_existing_meta'] = $settings['overwrite_existing_metadata'];
		$settings['brand_keyword_suffix']  = isset($settings['brand_keyword_suffix']) ? (string) $settings['brand_keyword_suffix'] : (string) ($settings['seo_brand_suffix'] ?? '');
		$settings['seo_brand_suffix']      = $settings['brand_keyword_suffix'];
		$settings['pause_on_low_credits']  = array_key_exists('pause_on_low_credits', $settings) ? (bool) $settings['pause_on_low_credits'] : (bool) ($settings['pause_low_credits'] ?? true);
		$settings['pause_low_credits']     = $settings['pause_on_low_credits'];
		$settings['show_completion_alerts'] = array_key_exists('show_completion_alerts', $settings) ? (bool) $settings['show_completion_alerts'] : (bool) ($settings['show_job_completion_alerts'] ?? true);
		$settings['show_job_completion_alerts'] = $settings['show_completion_alerts'];
		$settings['show_failed_alerts']    = array_key_exists('show_failed_alerts', $settings) ? (bool) $settings['show_failed_alerts'] : (bool) ($settings['show_failed_job_alerts'] ?? true);
		$settings['show_failed_job_alerts'] = $settings['show_failed_alerts'];
		$settings['preserve_product_exactly'] = array_key_exists('preserve_product_exactly', $settings) ? (bool) $settings['preserve_product_exactly'] : false;
		$settings['processing_mode']      = isset($settings['processing_mode']) ? (string) $settings['processing_mode'] : 'seo_product_feed_preserve';
		$settings['product_fit']          = isset($settings['product_fit']) ? (string) $settings['product_fit'] : (string) ($settings['default_scale_mode'] ?? 'auto');
		$settings['auto_fail_product_altered'] = array_key_exists('auto_fail_product_altered', $settings) ? (bool) $settings['auto_fail_product_altered'] : true;
		$settings['auto_fix_crop_spacing'] = array_key_exists('auto_fix_crop_spacing', $settings) ? (bool) $settings['auto_fix_crop_spacing'] : true;
		$settings['preserve_dark_detail'] = array_key_exists('preserve_dark_detail', $settings) ? (bool) $settings['preserve_dark_detail'] : true;
		$settings['remove_background_text_logos'] = array_key_exists('remove_background_text_logos', $settings) ? (bool) $settings['remove_background_text_logos'] : false;

		$stored_override = isset($raw_settings['api_base_url_override']) ? (string) $raw_settings['api_base_url_override'] : '';
		$stored_base = isset($raw_settings['api_base_url']) ? (string) $raw_settings['api_base_url'] : '';
		$normalized_base = '' !== $settings['api_base_url_override'] ? $settings['api_base_url_override'] : Optiimst_SaaSClient::normalize_api_base_url((string) $this->get_default_settings()['api_base_url']);

		if (($stored_override !== (string) $normalized_override) || ($stored_base !== (string) $normalized_base)) {
			$raw_settings['api_base_url_override'] = $normalized_override;
			$raw_settings['api_base_url']          = $normalized_base;
			optiimst_update_option($this->option_name, wp_parse_args($raw_settings, $settings), false);
		}

		return $settings;
	}

	public function sync_audit_schedule(array $settings): void {
		if ('off' === (string) ($settings['audit_schedule_frequency'] ?? 'off')) {
			wp_clear_scheduled_hook('optiimst_image_studio_scheduled_audit_tick');
			optiimst_delete_option('optiimst_scheduled_scan_state');
			return;
		}

		$next_run = strtotime((string) ($settings['audit_schedule_next_run_at'] ?? ''));
		if (! $next_run || $next_run < time()) {
			$next_run = $this->calculate_next_scheduled_audit_timestamp((string) ($settings['audit_schedule_frequency'] ?? 'weekly'));
			$settings['audit_schedule_next_run_at'] = gmdate('c', $next_run);
			optiimst_update_option($this->option_name, $settings, false);
		}

		wp_clear_scheduled_hook('optiimst_image_studio_scheduled_audit_tick');
		wp_schedule_single_event($next_run, 'optiimst_image_studio_scheduled_audit_tick');

		if (empty($settings['api_token'])) {
			return;
		}

		$usage = $this->client->get_usage();
		if (is_wp_error($usage)) {
			$this->logger->warning('Could not sync audit schedule to Optivra.', ['reason' => $usage->get_error_message()]);
			return;
		}

		$store_id = $this->extract_store_id_from_usage(is_array($usage) ? $usage : []);
		if ('' === $store_id) {
			return;
		}

		$this->client->save_image_audit_schedule(
			$store_id,
			[
				'frequency'              => (string) ($settings['audit_schedule_frequency'] ?? 'off'),
				'scan_mode'              => (string) ($settings['audit_schedule_scan_mode'] ?? 'updated'),
				'email_report'           => ! empty($settings['audit_schedule_email_report']),
				'monthly_report_enabled' => ! empty($settings['audit_monthly_report_enabled']),
				'scan_options'           => $this->get_scheduled_audit_options($settings),
			]
		);
	}

	public function maybe_queue_due_scheduled_audit(): void {
		$settings = $this->get_settings();
		if ('off' === (string) ($settings['audit_schedule_frequency'] ?? 'off') || empty($settings['api_token'])) {
			return;
		}

		$state = optiimst_get_option('optiimst_scheduled_scan_state', []);
		if (is_array($state) && 'running' === (string) ($state['status'] ?? '')) {
			if (! wp_next_scheduled('optiimst_image_studio_scheduled_audit_tick')) {
				wp_schedule_single_event(time() + 60, 'optiimst_image_studio_scheduled_audit_tick');
			}
			return;
		}

		$next_run = strtotime((string) ($settings['audit_schedule_next_run_at'] ?? ''));
		if ($next_run && $next_run <= time() && ! wp_next_scheduled('optiimst_image_studio_scheduled_audit_tick')) {
			wp_schedule_single_event(time() + 30, 'optiimst_image_studio_scheduled_audit_tick');
		}
	}

	public function run_scheduled_audit_tick(): void {
		$settings = $this->get_settings();
		if ('off' === (string) ($settings['audit_schedule_frequency'] ?? 'off') || empty($settings['api_token'])) {
			return;
		}

		$state = optiimst_get_option('optiimst_scheduled_scan_state', []);
		$state = is_array($state) ? $state : [];
		$scan_id = (string) ($state['scan_id'] ?? '');
		$store_id = (string) ($state['store_id'] ?? '');
		$options = $this->get_scheduled_audit_options($settings);

		if ('' === $scan_id) {
			$usage = $this->client->get_usage();
			if (is_wp_error($usage)) {
				$this->record_scheduled_audit_error($usage->get_error_message(), $store_id);
				return;
			}
			$store_id = $this->extract_store_id_from_usage(is_array($usage) ? $usage : []);
			if ('' === $store_id) {
				$this->record_scheduled_audit_error('No connected store ID was returned by Optivra.', '');
				return;
			}

			$total = $this->scanner->count_audit_products($options);
			$result = $this->client->start_image_audit(
				$store_id,
				$options + [
					'scheduled'               => true,
					'total_products_estimate' => $total,
					'plugin_version'          => defined('OPTIIMST_VERSION') ? OPTIIMST_VERSION : '1.0.0',
					'woocommerce_version'     => defined('WC_VERSION') ? WC_VERSION : '',
				]
			);
			if (is_wp_error($result)) {
				$this->record_scheduled_audit_error($result->get_error_message(), $store_id);
				return;
			}

			$scan_id = $this->extract_scan_id_from_payload(is_array($result) ? $result : []);
			if ('' === $scan_id) {
				$this->record_scheduled_audit_error('Optivra did not return a scan ID for the scheduled audit.', $store_id);
				return;
			}

			$state = [
				'status'         => 'running',
				'scan_id'        => $scan_id,
				'store_id'       => $store_id,
				'offset'         => 0,
				'batch'          => 0,
				'total_products' => $total,
				'images_scanned' => 0,
				'started_at'     => current_time('mysql'),
			];
			optiimst_update_option('optiimst_latest_scan_id', $scan_id, false);
			optiimst_update_option('optiimst_latest_audit_store_id', $store_id, false);
			optiimst_update_option('optiimst_scheduled_scan_state', $state, false);
			$this->client->acknowledge_image_audit_schedule($store_id, ['status' => 'running', 'scan_id' => $scan_id]);
		}

		$offset = max(0, absint($state['offset'] ?? 0));
		$batch = $this->scanner->collect_audit_batch($options, $offset, 25);
		$items = isset($batch['items']) && is_array($batch['items']) ? $batch['items'] : [];
		foreach (array_chunk($items, 75) as $chunk) {
			$result = $this->client->submit_image_audit_items($scan_id, $chunk);
			if (is_wp_error($result)) {
				$this->record_scheduled_audit_error($result->get_error_message(), $store_id);
				return;
			}
		}

		$next_offset = max(0, absint($batch['next_offset'] ?? ($offset + 25)));
		$done = empty($batch['has_more']) || ((int) ($state['total_products'] ?? 0) > 0 && $next_offset >= (int) ($state['total_products'] ?? 0));
		$state['offset'] = $next_offset;
		$state['batch'] = max(1, absint($state['batch'] ?? 0) + 1);
		$state['images_scanned'] = (int) ($state['images_scanned'] ?? 0) + count($items);
		optiimst_update_option('optiimst_scheduled_scan_state', $state, false);

		if (! $done) {
			wp_schedule_single_event(time() + 60, 'optiimst_image_studio_scheduled_audit_tick');
			return;
		}

		$report = $this->client->complete_image_audit($scan_id);
		if (is_wp_error($report)) {
			$this->record_scheduled_audit_error($report->get_error_message(), $store_id);
			return;
		}

		$full_report = $this->client->get_image_audit($scan_id);
		$summary = ! is_wp_error($full_report) && is_array($full_report) ? $full_report : (is_array($report) ? $report : []);
		$score = $this->extract_health_score_from_report($summary);
		$this->store_monthly_report_summary($summary, $score, $settings);
		optiimst_update_option('optiimst_latest_health_score', $score, false);
		optiimst_update_option('optiimst_last_scan_completed_at', current_time('mysql'), false);
		optiimst_update_option('optiimst_scan_in_progress', false, false);
		optiimst_update_option('optiimst_report_summary_cache', ['latest' => $summary, 'updated_at' => current_time('mysql')], false);
		optiimst_delete_option('optiimst_scheduled_scan_state');

		$next_run = $this->calculate_next_scheduled_audit_timestamp((string) ($settings['audit_schedule_frequency'] ?? 'weekly'));
		$settings['audit_schedule_next_run_at'] = gmdate('c', $next_run);
		optiimst_update_option($this->option_name, $settings, false);
		wp_schedule_single_event($next_run, 'optiimst_image_studio_scheduled_audit_tick');
		$this->client->acknowledge_image_audit_schedule($store_id, ['status' => 'active', 'scan_id' => $scan_id, 'next_scan_at' => gmdate('c', $next_run)]);
	}

	private function get_scheduled_audit_options(array $settings): array {
		$scan_mode = (string) ($settings['audit_schedule_scan_mode'] ?? 'updated');
		$options = [
			'scan_scope'                  => 'all',
			'status'                      => 'publish',
			'category_ids'                => [],
			'include_main_images'         => true,
			'include_gallery_images'      => ! empty($settings['process_gallery_images']),
			'include_variation_images'    => true,
			'include_category_thumbnails' => ! empty($settings['process_category_images']),
			'checks'                      => ['seo', 'performance', 'consistency', 'feed_readiness'],
		];

		if ('updated' === $scan_mode) {
			$last_completed = (string) optiimst_get_option('optiimst_last_scan_completed_at', '');
			if ('' !== $last_completed) {
				$options['updated_since'] = $last_completed;
			}
		}

		return $options;
	}

	private function calculate_next_scheduled_audit_timestamp(string $frequency): int {
		$timestamp = 'monthly' === $frequency ? strtotime('+1 month') : strtotime('+1 week');
		return $timestamp ? (int) $timestamp : (time() + WEEK_IN_SECONDS);
	}

	private function extract_store_id_from_usage(array $usage): string {
		$candidates = [$usage['store_id'] ?? '', $usage['site_id'] ?? '', $usage['store']['id'] ?? '', $usage['site']['id'] ?? ''];
		foreach ($candidates as $candidate) {
			if (is_scalar($candidate) && '' !== (string) $candidate) {
				return sanitize_text_field((string) $candidate);
			}
		}
		return '';
	}

	private function extract_scan_id_from_payload(array $payload): string {
		foreach ([$payload['scan_id'] ?? '', $payload['id'] ?? '', $payload['scan']['id'] ?? ''] as $candidate) {
			if (is_scalar($candidate) && '' !== (string) $candidate) {
				return sanitize_text_field((string) $candidate);
			}
		}
		return '';
	}

	private function extract_health_score_from_report(array $summary): float {
		foreach ([$summary['metrics']['product_image_health_score'] ?? null, $summary['product_image_health_score'] ?? null, $summary['health_score'] ?? null] as $candidate) {
			if (is_numeric($candidate)) {
				return max(0, min(100, (float) $candidate));
			}
		}
		return 0;
	}

	private function store_monthly_report_summary(array $summary, float $score, array $settings): void {
		$previous = optiimst_get_option('optiimst_monthly_report_summary', []);
		$previous = is_array($previous) ? $previous : [];
		$previous_score = isset($previous['current_score']) ? (float) $previous['current_score'] : null;
		$metrics = isset($summary['metrics']) && is_array($summary['metrics']) ? $summary['metrics'] : [];
		$monthly = [
			'previous_score'                    => $previous_score,
			'current_score'                     => $score,
			'score_improvement'                 => null === $previous_score ? 0 : round($score - $previous_score, 2),
			'issues_found'                      => isset($summary['issue_summary']['total_count']) ? (int) $summary['issue_summary']['total_count'] : 0,
			'issues_resolved'                   => 0,
			'images_processed'                  => (int) ($metrics['images_processed'] ?? 0),
			'estimated_time_saved_minutes_low'  => (int) ($metrics['estimated_manual_minutes_low'] ?? 0),
			'estimated_time_saved_minutes_high' => (int) ($metrics['estimated_manual_minutes_high'] ?? 0),
			'top_remaining_opportunities'       => array_slice((array) ($summary['insights'] ?? []), 0, 5),
			'email_status'                      => ! empty($settings['audit_schedule_email_report']) ? 'queued_stub' : 'skipped',
			'updated_at'                        => current_time('mysql'),
		];
		optiimst_update_option('optiimst_monthly_report_summary', $monthly, false);
	}

	private function record_scheduled_audit_error(string $message, string $store_id): void {
		$this->logger->error('Scheduled Product Image Health scan failed.', ['reason' => $message]);
		optiimst_update_option('optiimst_scheduled_scan_state', ['status' => 'failed', 'message' => $message, 'updated_at' => current_time('mysql')], false);
		if ('' !== $store_id) {
			$this->client->acknowledge_image_audit_schedule($store_id, ['status' => 'error']);
		}
	}

	public function logger(): Optiimst_Logger {
		return $this->logger;
	}

	public function jobs(): Optiimst_Job_Repository {
		return $this->jobs;
	}

	public function scanner(): Optiimst_ProductScanner {
		return $this->scanner;
	}

	public function client(): Optiimst_SaaSClient {
		return $this->client;
	}

	public function media(): Optiimst_MediaManager {
		return $this->media;
	}

	public function seo_generator(): Optiimst_SEO_Metadata_Generator {
		return $this->seo_generator;
	}

	public function approval(): Optiimst_ApprovalManager {
		return $this->approval;
	}

	public function processor(): Optiimst_ImageProcessor {
		return $this->processor;
	}
}
