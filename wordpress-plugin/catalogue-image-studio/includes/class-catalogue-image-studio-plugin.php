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

		$plugin   = self::instance();
		$settings = get_option($plugin->get_option_name(), []);

		if (! is_array($settings)) {
			$settings = [];
		}

		update_option(
			$plugin->get_option_name(),
			wp_parse_args($settings, $plugin->get_default_settings()),
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
			seo_filename text NULL,
			seo_alt_text text NULL,
			seo_title text NULL,
			seo_caption text NULL,
			seo_description longtext NULL,
			status varchar(20) NOT NULL DEFAULT 'unprocessed',
			error_message longtext NULL,
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
		$this->media     = new Catalogue_Image_Studio_MediaManager($this->logger);
		$this->approval  = new Catalogue_Image_Studio_ApprovalManager($this->jobs, $this->media, $settings, $this->logger);
		$this->processor = new Catalogue_Image_Studio_ImageProcessor($this->jobs, $this->client, $this->logger);
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
		return [
			'enabled'                 => true,
			'api_base_url'            => '',
			'api_token'               => '',
			'background'              => '#ffffff',
			'scale_percent'           => 82,
			'enable_filename_seo'     => true,
			'enable_alt_text'         => true,
			'only_fill_missing'       => true,
			'overwrite_existing_meta' => false,
			'upgrade_url'             => '',
			'buy_credits_url'         => '',
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

		return wp_parse_args($settings, $this->get_default_settings());
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

	public function approval(): Catalogue_Image_Studio_ApprovalManager {
		return $this->approval;
	}

	public function processor(): Catalogue_Image_Studio_ImageProcessor {
		return $this->processor;
	}
}
