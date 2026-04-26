<?php
/**
 * Core plugin bootstrap and settings defaults.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_Plugin {
	/**
	 * Singleton instance.
	 *
	 * @var Catalogue_Image_Studio_Plugin|null
	 */
	private static $instance = null;

	/**
	 * Option key for plugin settings.
	 *
	 * @var string
	 */
	private $option_name = 'catalogue_image_studio_settings';

	/**
	 * Logger.
	 *
	 * @var Catalogue_Image_Studio_Logger
	 */
	private $logger;

	/**
	 * Job repository.
	 *
	 * @var Catalogue_Image_Studio_Job_Repository
	 */
	private $jobs;

	/**
	 * Product scanner.
	 *
	 * @var Catalogue_Image_Studio_ProductScanner
	 */
	private $scanner;

	/**
	 * SaaS client.
	 *
	 * @var Catalogue_Image_Studio_SaaSClient
	 */
	private $client;

	/**
	 * Media manager.
	 *
	 * @var Catalogue_Image_Studio_MediaManager
	 */
	private $media;

	/**
	 * SEO metadata generator.
	 *
	 * @var Catalogue_Image_Studio_SEO_Metadata_Generator
	 */
	private $seo_generator;

	/**
	 * Approval manager.
	 *
	 * @var Catalogue_Image_Studio_ApprovalManager
	 */
	private $approval;

	/**
	 * Image processor.
	 *
	 * @var Catalogue_Image_Studio_ImageProcessor
	 */
	private $processor;

	/**
	 * Return singleton instance.
	 *
	 * @return Catalogue_Image_Studio_Plugin
	 */
	public static function instance(): Catalogue_Image_Studio_Plugin {
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
		$settings = get_option('catalogue_image_studio_settings', []);

		if (! is_array($settings)) {
			$settings = [];
		}

		update_option(
			'catalogue_image_studio_settings',
			wp_parse_args($settings, self::default_settings()),
			false
		);
	}

	/**
	 * Create plugin database tables.
	 *
	 * @return void
	 */
	public static function create_tables(): void {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table           = catalogue_image_studio_table_name();
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
			KEY attachment_id (attachment_id)
		) {$charset_collate};";

		dbDelta($sql);
		self::ensure_job_table_columns($table);
	}

	private static function ensure_job_table_columns(string $table): void {
		global $wpdb;

		$columns = (array) $wpdb->get_col("SHOW COLUMNS FROM {$table}", 0);
		$columns = array_map('strval', $columns);

		$required = [
			'processed_storage_bucket' => 'varchar(100) NULL',
			'processed_storage_path'   => 'text NULL',
			'processed_mime_type'      => 'varchar(100) NULL',
			'processed_width'          => 'int(11) NOT NULL DEFAULT 0',
			'processed_height'         => 'int(11) NOT NULL DEFAULT 0',
			'approval_error'           => 'longtext NULL',
		];

		foreach ($required as $column => $definition) {
			if (in_array($column, $columns, true)) {
				continue;
			}

			$wpdb->query("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
		}
	}

	/**
	 * Private constructor for singleton.
	 */
	private function __construct() {
		$this->logger = new Catalogue_Image_Studio_Logger();
		$this->jobs   = new Catalogue_Image_Studio_Job_Repository();
		$settings     = $this->get_settings();

		$this->scanner   = new Catalogue_Image_Studio_ProductScanner($this->jobs, $this->logger);
		$this->client    = new Catalogue_Image_Studio_SaaSClient(
			(string) $settings['api_base_url'],
			(string) $settings['api_token'],
			$this->logger
		);
		$this->media         = new Catalogue_Image_Studio_MediaManager($this->logger);
		$this->seo_generator = new Catalogue_Image_Studio_SEO_Metadata_Generator();
		$this->approval      = new Catalogue_Image_Studio_ApprovalManager($this->jobs, $this->media, $settings, $this->logger);
		$this->processor     = new Catalogue_Image_Studio_ImageProcessor($this->jobs, $this->client, $this->media, $this->seo_generator, $settings, $this->logger);
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
			'background_source'       => 'preset',
			'custom_background_attachment_id' => 0,
			'background_preset'       => 'optivra-default',
			'background'              => 'optivra-default',
			'default_scale_mode'      => 'auto',
			'scale_mode'              => 'auto',
			'scale_percent'           => 'auto',
			'framing_padding'         => 8,
			'preserve_transparent_edges' => true,
			'smart_scaling'           => true,
			'smart_scaling_enabled'   => true,
			'apply_shadow'            => true,
			'shadow_enabled'          => true,
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
			'notification_email'      => '',
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
		$settings = get_option($this->option_name, []);
		$settings = is_array($settings) ? $settings : [];
		$settings = wp_parse_args($settings, $this->get_default_settings());

		$settings['api_base_url_override'] = isset($settings['api_base_url_override']) ? (string) $settings['api_base_url_override'] : '';
		$settings['api_base_url']          = '' !== $settings['api_base_url_override']
			? $settings['api_base_url_override']
			: (string) $this->get_default_settings()['api_base_url'];

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

		return $settings;
	}

	public function logger(): Catalogue_Image_Studio_Logger {
		return $this->logger;
	}

	public function jobs(): Catalogue_Image_Studio_Job_Repository {
		return $this->jobs;
	}

	public function scanner(): Catalogue_Image_Studio_ProductScanner {
		return $this->scanner;
	}

	public function client(): Catalogue_Image_Studio_SaaSClient {
		return $this->client;
	}

	public function media(): Catalogue_Image_Studio_MediaManager {
		return $this->media;
	}

	public function seo_generator(): Catalogue_Image_Studio_SEO_Metadata_Generator {
		return $this->seo_generator;
	}

	public function approval(): Catalogue_Image_Studio_ApprovalManager {
		return $this->approval;
	}

	public function processor(): Catalogue_Image_Studio_ImageProcessor {
		return $this->processor;
	}
}
