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
			'optivra-image-studio-scan'        => __('Health Scan', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-health'      => __('Health Report', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-recommendations' => __('Recommendations', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-queue'       => __('Processing Queue', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-backgrounds' => __('Backgrounds', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-seo'         => __('SEO Tools', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-settings'    => __('Account & Settings', 'optivra-image-studio-for-woocommerce'),
			'optivra-image-studio-account'     => __('Credits & Billing', 'optivra-image-studio-for-woocommerce'),
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
			function catalogueImageStudioFilterQueue() {
				var searchNode = document.querySelector('[data-optivra-queue-search]');
				var statusNode = document.querySelector('[data-optivra-queue-status]');
				var modeNode = document.querySelector('[data-optivra-queue-mode]');
				var search = ((searchNode && searchNode.value) || '').toLowerCase();
				var status = (statusNode && statusNode.value) || '';
				var mode = (modeNode && modeNode.value) || '';
				document.querySelectorAll('[data-optivra-job-card]').forEach(function(card) {
					var matchesSearch = !search || (card.getAttribute('data-product') || '').toLowerCase().indexOf(search) !== -1;
					var matchesStatus = !status || card.getAttribute('data-status') === status;
					var matchesMode = !mode || (card.getAttribute('data-mode') || '').indexOf(mode) !== -1;
					card.hidden = !(matchesSearch && matchesStatus && matchesMode);
				});
			}
			document.addEventListener('change', function(event) {
				if (!event.target.matches('.catalogue-image-studio-job-check, .catalogue-image-studio-check-all')) {
					if (event.target.matches('[data-optivra-queue-status], [data-optivra-queue-mode]')) {
						catalogueImageStudioFilterQueue();
					}
					return;
				}
				catalogueImageStudioUpdateSelectedCount();
			});
			document.addEventListener('input', function(event) {
				if (event.target.matches('[data-optivra-queue-search]')) {
					catalogueImageStudioFilterQueue();
				}
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
				var backgroundSource = document.querySelector('select[name=\"background_source\"]');
				var backgroundPreset = document.querySelector('select[name=\"background_preset\"]');
				function syncBackgroundMode() {
					if (!backgroundSource || !backgroundPreset) {
						return;
					}
					var presetRow = backgroundPreset.closest('.optivra-setting-row');
					if (presetRow) {
						presetRow.classList.toggle('optivra-background-preset-muted', backgroundSource.value === 'custom');
					}
					backgroundPreset.setAttribute('aria-disabled', backgroundSource.value === 'custom' ? 'true' : 'false');
				}
				if (backgroundSource) {
					backgroundSource.addEventListener('change', syncBackgroundMode);
					syncBackgroundMode();
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
						if (backgroundSource && attachment.id) {
							backgroundSource.value = 'custom';
							syncBackgroundMode();
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
					var defaultImageTypes = ["main", "gallery", "variation", "category"];
					var defaultChecks = ["seo", "performance", "consistency", "feed_readiness", "visual_quality", "background_quality", "lighting_contrast"];
					var imageTypes = checkedValues(form, "image_types[]");
					var checks = checkedValues(form, "checks[]");
					return {
						scan_scope: (form.querySelector("[name=\"scan_scope\"]:checked") || {}).value || "all",
						category_ids: checkedValues(form, "category_ids[]"),
						image_types: imageTypes.length ? imageTypes : defaultImageTypes,
						checks: checks.length ? checks : defaultChecks,
						scan_limit: (form.querySelector("[name=\"scan_limit\"]") || {}).value || "",
						background_analysis: !(form.querySelector("[name=\"background_analysis\"]") || {}).checked ? false : true,
						seo_metadata_analysis: !(form.querySelector("[name=\"seo_metadata_analysis\"]") || {}).checked ? false : true,
						performance_analysis: !(form.querySelector("[name=\"performance_analysis\"]") || {}).checked ? false : true,
						lighting_contrast_analysis: !(form.querySelector("[name=\"lighting_contrast_analysis\"]") || {}).checked ? false : true
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

				function initScanResults() {
					var root = document.querySelector("[data-optivra-scan-results]");
					if (!root) {
						return;
					}
					var dataNode = root.querySelector("[data-optivra-scan-products-json]");
					var products = [];
					try {
						products = dataNode ? JSON.parse(dataNode.textContent || "[]") : [];
					} catch (error) {
						products = [];
					}
					if (!Array.isArray(products)) {
						products = [];
					}
					var initialParams = new URLSearchParams(window.location.search || "");
					var selectedIds = new Set();
					var ignoredIds = new Set();
					var state = {
						page: 1,
						pageSize: 25,
						filter: initialParams.get("optivra_result_filter") || "",
						search: initialParams.get("optivra_result_search") || "",
						sort: "recommended"
					};
					var body = root.querySelector("[data-optivra-results-body]");
					var selectedCount = root.querySelector("[data-optivra-selected-count]");
					var selectedAcross = root.querySelector("[data-optivra-selected-across]");
					var showingNode = root.querySelector("[data-optivra-results-showing]");
					var pageNode = root.querySelector("[data-optivra-current-page]");
					var totalPagesNode = root.querySelector("[data-optivra-total-pages]");
					var totalCountNode = root.querySelector("[data-optivra-total-scanned]");
					var pageSizeNode = root.querySelector("[data-optivra-page-size]");
					var searchNode = root.querySelector("[data-optivra-results-search]");
					var sortNode = root.querySelector("[data-optivra-results-sort]");
					var emptyNode = root.querySelector("[data-optivra-results-empty]");
					var payloadContainer = root.querySelector("[data-optivra-selected-payloads]");
					var warningNode = root.querySelector("[data-optivra-selection-warning]");

					function escapeHtml(value) {
						return String(value == null ? "" : value)
							.replace(/&/g, "&amp;")
							.replace(/</g, "&lt;")
							.replace(/>/g, "&gt;")
							.replace(/"/g, "&quot;")
							.replace(new RegExp(String.fromCharCode(39), "g"), "&#039;");
					}

					function escapeAttribute(value) {
						return escapeHtml(value).replace(/`/g, "&#096;");
					}

					function normalizeText(value) {
						return String(value == null ? "" : value).toLowerCase();
					}

					function productId(product) {
						return String(product && product.id ? product.id : "");
					}

					function isQueueable(product) {
						var payload = product && product.queuePayload ? product.queuePayload : null;
						return product && product.queueable !== false && payload && (payload.product_id || payload.productId) && (payload.image_id || payload.imageId || payload.attachment_id);
					}

					function issueScore(product) {
						var score = Number(product.healthScore);
						if (Number.isFinite(score)) {
							return score;
						}
						return 100 - Math.min(100, Number(product.issueCount || 0) * 12 + (product.recommended ? 20 : 0));
					}

					function updateCount() {
						var count = selectedIds.size;
						if (selectedCount) {
							selectedCount.textContent = String(count);
						}
						if (selectedAcross) {
							selectedAcross.textContent = count + " selected across all pages";
						}
					}

					function filteredProducts() {
						var query = normalizeText(state.search).trim();
						return products.filter(function(product) {
							var id = productId(product);
							if (!id || ignoredIds.has(id)) {
								return false;
							}
							var filters = Array.isArray(product.filters) ? product.filters : [];
							var matchesFilter = !state.filter || filters.indexOf(state.filter) !== -1;
							var matchesSearch = !query || normalizeText([
								product.productName,
								product.productId,
								product.categoryName
							].join(" ")).indexOf(query) !== -1;
							return matchesFilter && matchesSearch;
						});
					}

					function sortedProducts(items) {
						var copy = items.slice();
						copy.sort(function(a, b) {
							if (state.sort === "name") {
								return String(a.productName || "").localeCompare(String(b.productName || ""));
							}
							if (state.sort === "worst") {
								return issueScore(a) - issueScore(b);
							}
							if (state.sort === "newest") {
								return Number(b.scannedIndex || 0) - Number(a.scannedIndex || 0);
							}
							if (a.recommended !== b.recommended) {
								return a.recommended ? -1 : 1;
							}
							return issueScore(a) - issueScore(b);
						});
						return copy;
					}

					function getVisiblePage(items) {
						var totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
						state.page = Math.min(Math.max(1, state.page), totalPages);
						var start = (state.page - 1) * state.pageSize;
						return {
							totalPages: totalPages,
							start: start,
							end: Math.min(items.length, start + state.pageSize),
							items: items.slice(start, start + state.pageSize)
						};
					}

					function pillHtml(item) {
						return "<span class=\"optivra-rec-pill is-" + escapeAttribute(item.severity || "info") + "\">" + escapeHtml(item.label || "Issue") + "</span>";
					}

					function renderRow(product) {
						var id = productId(product);
						var checked = selectedIds.has(id) ? " checked" : "";
						var disabled = isQueueable(product) ? "" : " disabled";
						var image = product.thumbnailUrl || product.imageUrl || "";
						var issues = Array.isArray(product.issues) && product.issues.length ? product.issues.slice(0, 3).map(pillHtml).join("") : "<span class=\"optivra-rec-pill is-good\">Healthy</span>";
						var recs = Array.isArray(product.recommendations) && product.recommendations.length
							? product.recommendations.slice(0, 3).map(pillHtml).join("")
							: "<span class=\"optivra-rec-pill is-info\">" + escapeHtml(product.recommended ? "Ready to optimise" : "No action needed") + "</span>";
						var productLink = product.productUrl ? "<a class=\"button\" href=\"" + escapeAttribute(product.productUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">View product</a>" : "";
						var imageLink = product.imageUrl ? "<a class=\"button\" href=\"" + escapeAttribute(product.imageUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Preview image</a>" : "";
						var thumb = image
							? "<img class=\"catalogue-image-studio-thumb\" src=\"" + escapeAttribute(image) + "\" alt=\"\" loading=\"lazy\" />"
							: "<span class=\"catalogue-image-studio-thumb optivra-thumb-placeholder\">No image</span>";

						return "<tr data-optivra-product-row data-optivra-row-id=\"" + escapeAttribute(id) + "\">" +
							"<th class=\"check-column\"><input type=\"checkbox\" data-optivra-scan-item value=\"" + escapeAttribute(id) + "\"" + checked + disabled + " /></th>" +
							"<td data-label=\"Image\">" + thumb + "</td>" +
							"<td data-label=\"Product\"><strong>" + escapeHtml(product.productName || "Product image") + "</strong><br /><small>ID " + escapeHtml(product.productId || "") + " - " + escapeHtml(product.imageRoleLabel || product.imageRole || "Main image") + "</small></td>" +
							"<td data-label=\"Category\">" + escapeHtml(product.categoryName || "Uncategorised") + "</td>" +
							"<td data-label=\"Current image status\"><span class=\"optivra-rec-pill is-" + escapeAttribute(product.recommended ? "medium" : "good") + "\">" + escapeHtml(product.status || "Healthy") + "</span><br /><small>" + escapeHtml(product.readiness || "Ready") + "</small></td>" +
							"<td data-label=\"Detected issues\"><div class=\"optivra-mini-pill-list\">" + issues + "</div></td>" +
							"<td data-label=\"Recommendation\"><div class=\"optivra-mini-pill-list\">" + recs + "</div></td>" +
							"<td data-label=\"Actions\"><div class=\"optivra-row-actions\">" + productLink + imageLink + "<button type=\"button\" class=\"button\" data-optivra-row-add " + (isQueueable(product) ? "" : "disabled") + ">Add to queue</button><button type=\"button\" class=\"button\" data-optivra-row-ignore>Ignore</button></div></td>" +
						"</tr>";
					}

					function render() {
						var filtered = sortedProducts(filteredProducts());
						var page = getVisiblePage(filtered);
						if (body) {
							body.innerHTML = page.items.map(renderRow).join("");
						}
						if (showingNode) {
							showingNode.textContent = filtered.length
								? "Showing " + (page.start + 1) + "-" + page.end + " of " + filtered.length + " scanned products"
								: (products.length ? "No scanned products match this filter." : "No products found for this scan scope.");
						}
						if (pageNode) {
							pageNode.textContent = String(state.page);
						}
						if (totalPagesNode) {
							totalPagesNode.textContent = String(page.totalPages);
						}
						if (totalCountNode) {
							totalCountNode.textContent = String(filtered.length);
						}
						if (emptyNode) {
							emptyNode.hidden = filtered.length > 0;
						}
						Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-page-action]"), function(button) {
							var action = button.getAttribute("data-optivra-page-action");
							button.disabled = (action === "first" || action === "previous") ? state.page <= 1 : state.page >= page.totalPages;
						});
						Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-result-filter]"), function(pill) {
							pill.classList.toggle("is-active", !!state.filter && pill.getAttribute("data-optivra-result-filter") === state.filter);
						});
						updateCount();
					}

					function setPage(page) {
						state.page = page;
						render();
					}

					function selectProducts(items) {
						items.forEach(function(product) {
							if (isQueueable(product)) {
								selectedIds.add(productId(product));
							}
						});
						render();
					}

					function clearSelection() {
						selectedIds.clear();
						render();
					}

					root.addEventListener("change", function(event) {
						if (event.target.matches("[data-optivra-scan-item]")) {
							if (event.target.checked) {
								selectedIds.add(event.target.value);
							} else {
								selectedIds.delete(event.target.value);
							}
							updateCount();
						}
						if (event.target.matches("[data-optivra-page-size]")) {
							state.pageSize = parseInt(event.target.value || "25", 10) || 25;
							state.page = 1;
							render();
						}
						if (event.target.matches("[data-optivra-results-sort]")) {
							state.sort = event.target.value || "recommended";
							state.page = 1;
							render();
						}
					});

					root.addEventListener("input", function(event) {
						if (event.target.matches("[data-optivra-results-search]")) {
							state.search = event.target.value || "";
							state.page = 1;
							render();
						}
					});

					Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-select-visible]"), function(button) {
						button.addEventListener("click", function() {
							selectProducts(getVisiblePage(sortedProducts(filteredProducts())).items);
						});
					});

					Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-select-recommended]"), function(button) {
						button.addEventListener("click", function() {
							selectProducts(products.filter(function(product) { return product.recommended; }));
						});
					});

					Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-clear-selection]"), function(button) {
						button.addEventListener("click", clearSelection);
					});

					Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-optimise-recommended]"), function(button) {
						button.addEventListener("click", function() {
							selectProducts(products.filter(function(product) { return product.recommended; }));
							var form = button.closest("form");
							if (form && form.requestSubmit) {
								form.requestSubmit();
							} else if (form) {
								form.submit();
							}
						});
					});

					Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-result-filter]"), function(button) {
						button.addEventListener("click", function() {
							state.filter = button.getAttribute("data-optivra-result-filter") || "";
							state.page = 1;
							Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-result-filter]"), function(pill) {
								pill.classList.toggle("is-active", pill === button && state.filter);
							});
							render();
						});
					});

					Array.prototype.forEach.call(root.querySelectorAll("[data-optivra-page-action]"), function(button) {
						button.addEventListener("click", function() {
							var filtered = sortedProducts(filteredProducts());
							var totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
							var action = button.getAttribute("data-optivra-page-action");
							if (action === "first") setPage(1);
							if (action === "previous") setPage(state.page - 1);
							if (action === "next") setPage(state.page + 1);
							if (action === "last") setPage(totalPages);
						});
					});

					root.addEventListener("click", function(event) {
						if (event.target.matches("[data-optivra-row-add]")) {
							var row = event.target.closest("[data-optivra-product-row]");
							var id = row ? row.getAttribute("data-optivra-row-id") : "";
							if (id) {
								selectedIds.clear();
								selectedIds.add(id);
							}
							var form = event.target.closest("form");
							if (form && form.requestSubmit) {
								form.requestSubmit();
							} else if (form) {
								form.submit();
							}
						}
						if (event.target.matches("[data-optivra-row-ignore]")) {
							var row = event.target.closest("[data-optivra-product-row]");
							var id = row ? row.getAttribute("data-optivra-row-id") : "";
							if (id) {
								ignoredIds.add(id);
								selectedIds.delete(id);
								render();
							}
						}
					});

					var form = root.querySelector("form");
					if (form) {
						form.addEventListener("submit", function(event) {
							if (payloadContainer) {
								payloadContainer.innerHTML = "";
							}
							var byId = new Map(products.map(function(product) { return [productId(product), product]; }));
							var invalid = 0;
							selectedIds.forEach(function(id) {
								var product = byId.get(id);
								if (!product || !isQueueable(product)) {
									invalid += 1;
									return;
								}
								if (!payloadContainer) {
									return;
								}
								var itemInput = document.createElement("input");
								itemInput.type = "hidden";
								itemInput.name = "scan_items[]";
								itemInput.value = id;
								payloadContainer.appendChild(itemInput);
								var payloadInput = document.createElement("input");
								payloadInput.type = "hidden";
								payloadInput.name = "scan_queue_payloads[" + id + "]";
								payloadInput.value = JSON.stringify(product.queuePayload || {});
								payloadContainer.appendChild(payloadInput);
							});
							if (warningNode) {
								warningNode.hidden = invalid <= 0;
								warningNode.textContent = invalid > 0 ? invalid + " selected item(s) are no longer available and will be skipped." : "";
							}
							if (!payloadContainer || !payloadContainer.querySelector("[name=\"scan_items[]\"]")) {
								event.preventDefault();
								if (warningNode) {
									warningNode.hidden = false;
									warningNode.textContent = "Select at least one valid scanned product to queue.";
								}
							}
						});
					}

					if (pageSizeNode) {
						state.pageSize = parseInt(pageSizeNode.value || "25", 10) || 25;
					}
					if (searchNode) {
						if (state.search) {
							searchNode.value = state.search;
						} else {
							state.search = searchNode.value || "";
						}
					}
					if (sortNode) {
						state.sort = sortNode.value || "recommended";
					}
					render();
				}

				ready(function() {
					initScanResults();
					var form = document.getElementById("optivra-audit-scan-form");
					var progress = document.getElementById("optivra-audit-scan-progress");
					var startButton = document.getElementById("optivra-audit-start");
					var categoryButton = document.getElementById("optivra-audit-category-start");
					var cancelButton = document.getElementById("optivra-audit-cancel");
					var cancelled = false;

					if (!form || !progress || !startButton) {
						return;
					}

					function fail(error) {
						startButton.disabled = false;
						if (categoryButton) {
							categoryButton.disabled = false;
						}
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
									if (categoryButton) {
										categoryButton.disabled = false;
									}
									cancelButton.hidden = true;
									window.setTimeout(function() {
										window.location.replace(window.location.pathname + window.location.search + "#optivra-scan-results");
										window.location.reload();
									}, 900);
								});
							}
							return window.setTimeout(function() {
								runBatch(scanId, options, data.next_offset || (offset + 25), batchNumber + 1, totalProducts).catch(fail);
							}, 150);
						});
					}

					function startScan(event, overrideOptions) {
						event.preventDefault();
						cancelled = false;
						startButton.disabled = true;
						if (categoryButton) {
							categoryButton.disabled = true;
						}
						cancelButton.disabled = false;
						cancelButton.hidden = false;
						var options = Object.assign(collectOptions(form), overrideOptions || {});
						setProgress(progress, { status_label: window.optivraScanConfig.i18n.starting, message: "" });
						post("optivra_image_audit_start", { options: JSON.stringify(options) }).then(function(data) {
							setProgress(progress, data.progress || {});
							return runBatch(data.scan_id, options, 0, 1, data.total_products || 0);
						}).catch(fail);
					}

					startButton.addEventListener("click", function(event) {
						startScan(event, { scan_scope: "all", category_ids: [] });
					});

					if (categoryButton) {
						categoryButton.addEventListener("click", function(event) {
							var categoryIds = checkedValues(form, "category_ids[]");
							if (!categoryIds.length) {
								event.preventDefault();
								setProgress(progress, {
									status: "ready",
									status_label: "Choose a category",
									message: "Select at least one category under Advanced scan options, then run the category scan."
								});
								return;
							}
							var categoryRadio = form.querySelector("[name=\"scan_scope\"][value=\"categories\"]");
							if (categoryRadio) {
								categoryRadio.checked = true;
							}
							startScan(event, { scan_scope: "categories", category_ids: categoryIds });
						});
					}

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
		$this->plugin->sync_audit_schedule($settings);

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
			$submitted_token = isset($_POST['api_token']) ? Catalogue_Image_Studio_SaaSClient::normalize_api_token(sanitize_textarea_field((string) wp_unslash($_POST['api_token']))) : '';
			$client = new Catalogue_Image_Studio_SaaSClient(
				(string) $settings['api_base_url'],
				(string) $settings['api_token'],
				$this->plugin->logger()
			);
			$usage = $client->get_usage();

			if (is_wp_error($usage)) {
				$this->queue_notice($usage->get_error_message(), 'error');
				if ('' === $submitted_token && ! empty($settings['api_token'])) {
					$this->queue_notice(__('The saved masked token failed. Generate a fresh Site API Token in Optivra, paste the raw token beginning with cis_ into this field, then click Connect. Leaving the field blank keeps testing the stale saved token.', 'optivra-image-studio-for-woocommerce'), 'error');
				}
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
		$posted_token = isset($input['api_token']) ? Catalogue_Image_Studio_SaaSClient::normalize_api_token(sanitize_textarea_field((string) $input['api_token'])) : '';
		$placeholder_token = __('Token saved - leave blank to keep it', 'optivra-image-studio-for-woocommerce');
		$settings['api_token'] = ('' !== $posted_token && $posted_token !== $placeholder_token && false === strpos($posted_token, '*'))
			? $posted_token
			: (string) $settings['api_token'];
		$settings['api_base_url_override'] = isset($input['api_base_url_override'])
			? Catalogue_Image_Studio_SaaSClient::normalize_api_base_url((string) $input['api_base_url_override'])
			: Catalogue_Image_Studio_SaaSClient::normalize_api_base_url((string) ($settings['api_base_url_override'] ?? ''));
		$settings['api_base_url']          = '' !== (string) $settings['api_base_url_override']
			? (string) $settings['api_base_url_override']
			: Catalogue_Image_Studio_SaaSClient::normalize_api_base_url((string) $defaults['api_base_url']);
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
		$settings['audit_schedule_frequency'] = $this->sanitize_schedule_frequency($input['audit_schedule_frequency'] ?? $settings['audit_schedule_frequency'] ?? 'off');
		$settings['audit_schedule_scan_mode'] = $this->sanitize_schedule_scan_mode($input['audit_schedule_scan_mode'] ?? $settings['audit_schedule_scan_mode'] ?? 'updated');
		$settings['audit_schedule_email_report'] = ! empty($input['audit_schedule_email_report']);
		$settings['audit_monthly_report_enabled'] = ! empty($input['audit_monthly_report_enabled']);
		$settings['audit_default_scan_scope'] = $this->sanitize_key_choice((string) ($input['audit_default_scan_scope'] ?? $settings['audit_default_scan_scope'] ?? 'full'), ['full' => 'full', 'updated' => 'updated'], 'full');
		$settings['audit_auto_queue_recommendations'] = ! empty($input['audit_auto_queue_recommendations']);
		$settings['audit_ignored_categories_products'] = isset($input['audit_ignored_categories_products']) ? sanitize_text_field((string) $input['audit_ignored_categories_products']) : '';
		$settings['audit_schedule_next_run_at'] = isset($settings['audit_schedule_next_run_at']) ? sanitize_text_field((string) $settings['audit_schedule_next_run_at']) : '';
		$settings['notification_email']      = isset($input['notification_email']) ? sanitize_email((string) $input['notification_email']) : '';
		$settings['send_operational_diagnostics'] = ! empty($input['send_operational_diagnostics']);

		if ($settings['only_fill_missing_metadata'] && $settings['overwrite_existing_metadata']) {
			$settings['overwrite_existing_metadata'] = false;
			$settings['overwrite_existing_meta'] = false;
		}

		$brand_style_presets = $this->sanitize_brand_style_presets($settings['brand_style_presets'] ?? $defaults['brand_style_presets'] ?? []);

		if (isset($input['save_brand_style_preset'])) {
			$preset_name = isset($input['brand_preset_name']) ? sanitize_text_field((string) $input['brand_preset_name']) : '';
			$preset_key  = isset($input['brand_preset_key']) ? sanitize_key((string) $input['brand_preset_key']) : '';
			if ('' === $preset_key && '' !== $preset_name) {
				$preset_key = sanitize_key(sanitize_title($preset_name));
			}
			if ('' === $preset_key) {
				$preset_key = 'brand-style-' . time();
			}

			$brand_style_presets[$preset_key] = $this->sanitize_brand_style_preset(
				[
					'name'                            => '' !== $preset_name ? $preset_name : __('Untitled preset', 'optivra-image-studio-for-woocommerce'),
					'background_type'                 => $input['brand_background_type'] ?? 'optivra-light',
					'custom_background_attachment_id' => $input['brand_custom_background_attachment_id'] ?? 0,
					'aspect_ratio'                    => $input['brand_aspect_ratio'] ?? '1:1',
					'product_padding'                 => $input['brand_product_padding'] ?? 'balanced',
					'shadow'                          => $input['brand_shadow'] ?? 'subtle',
					'output_format'                   => $input['brand_output_format'] ?? 'original',
					'apply_scope'                     => $input['brand_apply_scope'] ?? 'all',
					'category_ids'                    => $input['brand_category_ids'] ?? [],
				]
			);
			$settings['active_brand_style_preset'] = $preset_key;
		}

		if (isset($input['remove_brand_style_preset'])) {
			$remove_key = sanitize_key((string) ($input['remove_brand_style_preset'] ?? ''));
			if (isset($brand_style_presets[$remove_key]) && count($brand_style_presets) > 1) {
				unset($brand_style_presets[$remove_key]);
			}
		}

		$active_brand_preset = isset($input['active_brand_style_preset']) ? sanitize_key((string) $input['active_brand_style_preset']) : sanitize_key((string) ($settings['active_brand_style_preset'] ?? 'optivra-light'));
		$settings['brand_style_presets'] = $brand_style_presets;
		$settings['active_brand_style_preset'] = isset($brand_style_presets[$active_brand_preset]) ? $active_brand_preset : (string) array_key_first($brand_style_presets);

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

		if ('queue_selected_scan_results' === $action) {
			$job_ids = $this->queue_selected_scan_results();
			$this->plugin->client()->send_event('image_queued', ['jobs_queued' => count($job_ids), 'source' => 'scan_results'], $settings);
			$this->add_success(sprintf(
				/* translators: %d: jobs queued */
				__('%d selected scan result image(s) added to the queue.', 'optivra-image-studio-for-woocommerce'),
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
	 * @return array<int,int>
	 */
	private function queue_selected_scan_results(): array {
		// This helper is called only from handle_workflow_post(), after check_admin_referer() and manage_woocommerce checks.
		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$selected = isset($_POST['scan_items']) ? array_map('sanitize_text_field', (array) wp_unslash($_POST['scan_items'])) : [];
		$payloads = isset($_POST['scan_queue_payloads']) && is_array($_POST['scan_queue_payloads'])
			? wp_unslash($_POST['scan_queue_payloads'])
			: [];
		// phpcs:enable WordPress.Security.NonceVerification.Missing
		$job_ids = [];

		foreach ($selected as $token) {
			$token = sanitize_key((string) $token);
			if ('' === $token || empty($payloads[$token]) || ! is_string($payloads[$token])) {
				continue;
			}

			$payload = json_decode((string) $payloads[$token], true);
			if (! is_array($payload)) {
				continue;
			}

			$payload = $this->sanitize_scan_queue_payload($payload);
			if (empty($payload['product_id']) || empty($payload['image_id'])) {
				continue;
			}

			$job_id = $this->plugin->jobs()->queue_from_audit_payload($payload);
			if ($job_id > 0) {
				$job_ids[] = $job_id;
			}
		}

		return array_values(array_unique(array_filter(array_map('absint', $job_ids))));
	}

	/**
	 * @param array<string,mixed> $payload Queue payload.
	 * @return array<string,mixed>
	 */
	private function sanitize_scan_queue_payload(array $payload): array {
		$attachment_id = absint($payload['attachment_id'] ?? $payload['_attachment_id'] ?? $payload['image_id'] ?? 0);
		$image_role = sanitize_key((string) ($payload['image_role'] ?? 'main'));
		if ('category_thumbnail' === $image_role) {
			$image_role = 'category';
		}

		return [
			'id'                => sanitize_text_field((string) ($payload['id'] ?? '')),
			'scan_id'           => sanitize_text_field((string) ($payload['scan_id'] ?? '')),
			'recommendation_id' => sanitize_text_field((string) ($payload['recommendation_id'] ?? '')),
			'issue_id'          => sanitize_text_field((string) ($payload['issue_id'] ?? '')),
			'product_id'        => absint($payload['product_id'] ?? 0),
			'image_id'          => $attachment_id,
			'image_role'        => $image_role,
			'gallery_index'     => absint($payload['gallery_index'] ?? 0),
			'action_type'       => sanitize_key((string) ($payload['action_type'] ?? 'queue_processing')),
			'priority'          => sanitize_key((string) ($payload['priority'] ?? 'medium')),
			'background_preset' => sanitize_text_field((string) ($payload['background_preset'] ?? 'optivra-default')),
			'job_kind'          => sanitize_key((string) ($payload['job_kind'] ?? 'image_processing')),
		];
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

	/**
	 * @param array<string,mixed> $recommendation Recommendation row.
	 */
	private function get_scan_results_url(array $recommendation = []): string {
		$url = $this->get_admin_page_url('scan');
		$filter_map = [
			'generate_alt_text'      => 'missing_alt_text',
			'optimise_image'         => 'oversized_file',
			'convert_webp'           => 'missing_webp',
			'replace_background'     => 'cluttered_background',
			'standardise_background' => 'inconsistent_background',
			'resize_crop'            => 'inconsistent_aspect_ratio',
			'add_main_image'         => 'missing_main_image',
		];

		$action_type = $this->normalize_recommendation_action_type((string) ($recommendation['action_type'] ?? ''));
		if (isset($filter_map[$action_type])) {
			$url = add_query_arg('optivra_result_filter', $filter_map[$action_type], $url);
		}

		if (! empty($recommendation['category']) && is_scalar($recommendation['category'])) {
			$url = add_query_arg('optivra_result_search', sanitize_text_field((string) $recommendation['category']), $url);
		}

		return $url . '#optivra-scan-results';
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
		$posted_recommendation_id = isset($_POST['optivra_recommendation_id']) ? sanitize_text_field(wp_unslash($_POST['optivra_recommendation_id'])) : '';
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$context = $this->get_recommendation_report_context();
		$scan_id = (string) ($context['scan_id'] ?? '');
		$recommendations = isset($context['recommendations']) && is_array($context['recommendations']) ? $context['recommendations'] : [];
		$recommendation = $this->find_recommendation_by_key($recommendations, $key);
		if (empty($recommendation) && '' !== $posted_recommendation_id) {
			$recommendation = $this->find_recommendation_by_id($recommendations, $posted_recommendation_id);
		}

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

			$settings = $this->plugin->get_settings();
			$result = $this->plugin->client()->queue_audit_recommendation(
				$scan_id,
				$recommendation_id,
				[
					'background_preset' => (string) ($settings['background_preset'] ?? 'optivra-default'),
				]
			);
			if (is_wp_error($result)) {
				$this->queue_notice($result->get_error_message(), 'error');
			} else {
				$status = isset($result['status']) && is_scalar($result['status']) ? sanitize_key((string) $result['status']) : '';
				$message = isset($result['message']) && is_scalar($result['message']) ? sanitize_text_field((string) $result['message']) : '';
				$job_kind = isset($result['jobKind']) && is_scalar($result['jobKind']) ? sanitize_key((string) $result['jobKind']) : '';
				if ('' === $job_kind && isset($result['job_kind']) && is_scalar($result['job_kind'])) {
					$job_kind = sanitize_key((string) $result['job_kind']);
				}
				$response_action = isset($result['actionType']) && is_scalar($result['actionType']) ? sanitize_key((string) $result['actionType']) : '';
				if ('' === $response_action && isset($result['action_type']) && is_scalar($result['action_type'])) {
					$response_action = sanitize_key((string) $result['action_type']);
				}
				if ('' === $response_action) {
					$response_action = $this->normalize_recommendation_action_type((string) ($recommendation['action_type'] ?? 'review_manually'));
				}
				$created_count = isset($result['createdCount']) ? (int) $result['createdCount'] : (int) ($result['queued_count'] ?? 0);
				$skipped_count = isset($result['skippedDuplicateCount']) ? (int) $result['skippedDuplicateCount'] : (int) ($result['skipped_existing_count'] ?? 0);
				if ('not_implemented' === $status) {
					$this->queue_notice('' !== $message ? $message : __('Queue integration for recommendations is not available yet.', 'optivra-image-studio-for-woocommerce'), 'error');
				} elseif ('manual_review_required' === $status) {
					$this->queue_notice('' !== $message ? $message : __('These items need manual review before processing jobs can be created.', 'optivra-image-studio-for-woocommerce'), 'error');
				} else {
					$local_created = $this->queue_local_image_jobs_from_audit_response(is_array($result) ? $result : []);
					if ('seo_only' === $job_kind || 'generate_alt_text' === $response_action) {
						$this->queue_notice(sprintf(
							/* translators: 1: created count, 2: duplicate count. */
							__('%1$d alt text task(s) created. %2$d already existed. Alt text generation does not use image-processing credits.', 'optivra-image-studio-for-woocommerce'),
							max(0, $created_count),
							max(0, $skipped_count)
						), 'success');
					} elseif (($local_created > 0 || $created_count > 0 || $skipped_count > 0) && ('image_processing' === $job_kind || $this->is_image_processing_recommendation_action($response_action))) {
						$this->queue_notice(sprintf(
							/* translators: 1: created queue count, 2: duplicate count, 3: local image-processing job count. */
							__('%1$d image task(s) added. %2$d already in queue. %3$d image-processing job(s) were added to this store queue.', 'optivra-image-studio-for-woocommerce'),
							max(0, $created_count),
							max(0, $skipped_count),
							$local_created
						), 'success');
					} else {
						$this->queue_notice('' !== $message ? $message : __('No new image-processing jobs were created. The affected items may already be queued or require manual review.', 'optivra-image-studio-for-woocommerce'), $created_count > 0 || $skipped_count > 0 ? 'success' : 'error');
					}
				}
			}

			wp_safe_redirect($this->get_admin_page_url('recommendations'));
			exit;
		}

		$this->queue_notice(__('Unknown recommendation action.', 'optivra-image-studio-for-woocommerce'), 'error');
		wp_safe_redirect($this->get_admin_page_url('recommendations'));
		exit;
	}

	/**
	 * Create local image-processing jobs only for audit queue payloads that need preserve-mode image processing.
	 *
	 * @param array<string,mixed> $result Backend response.
	 * @return int
	 */
	private function queue_local_image_jobs_from_audit_response(array $result): int {
		$queue_jobs = isset($result['queue_jobs']) && is_array($result['queue_jobs']) ? $result['queue_jobs'] : [];
		$created = 0;

		foreach ($queue_jobs as $queue_job) {
			if (! is_array($queue_job)) {
				continue;
			}

			$job_kind = sanitize_key((string) ($queue_job['job_kind'] ?? ''));
			$action_type = sanitize_key((string) ($queue_job['action_type'] ?? ''));
			if ('image_processing' !== $job_kind || ! in_array($action_type, ['optimise_image', 'replace_background', 'standardise_background', 'resize_crop', 'convert_webp'], true)) {
				continue;
			}

			$product_id = absint($queue_job['product_id'] ?? 0);
			$attachment_id = absint($queue_job['image_id'] ?? 0);
			if ($product_id <= 0 || $attachment_id <= 0 || ! get_post($product_id) || ! get_post($attachment_id)) {
				continue;
			}

			$queue_job['image_role'] = $this->normalize_audit_queue_image_role((string) ($queue_job['image_role'] ?? 'main'));
			$queue_job['gallery_index'] = $this->resolve_gallery_index_for_audit_job($product_id, $attachment_id, (string) $queue_job['image_role']);
			$job_id = $this->plugin->jobs()->queue_from_audit_payload($queue_job);
			if ($job_id > 0) {
				++$created;
			}
		}

		return $created;
	}

	private function normalize_audit_queue_image_role(string $image_role): string {
		$image_role = sanitize_key($image_role);
		if ('featured' === $image_role) {
			return 'main';
		}
		if ('category_thumbnail' === $image_role) {
			return 'category';
		}

		return in_array($image_role, ['main', 'gallery', 'variation', 'category'], true) ? $image_role : 'main';
	}

	private function resolve_gallery_index_for_audit_job(int $product_id, int $attachment_id, string $image_role): int {
		if ('gallery' !== $image_role) {
			return 0;
		}

		$product = wc_get_product($product_id);
		if (! $product) {
			return 0;
		}

		$gallery_ids = array_values(array_map('absint', $product->get_gallery_image_ids()));
		$index = array_search($attachment_id, $gallery_ids, true);

		return false === $index ? 0 : (int) $index;
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
		$remote_enabled = ! is_wp_error($usage);
		$warnings = [];
		if (is_wp_error($usage)) {
			$warnings[] = sprintf(
				/* translators: %s: remote API error message. */
				__('Remote health report unavailable: %s. The local catalogue scan will still show products you can select for the queue.', 'optivra-image-studio-for-woocommerce'),
				$usage->get_error_message()
			);
		}

		$store_id = $remote_enabled ? $this->get_audit_store_id(is_array($usage) ? $usage : []) : '';
		$total_products = $this->plugin->scanner()->count_audit_products($options);
		$scan_options = $options + [
			'total_products_estimate' => $total_products,
			'plugin_version'          => defined('CIS_VERSION') ? CIS_VERSION : '1.0.0',
			'woocommerce_version'     => defined('WC_VERSION') ? WC_VERSION : '',
		];

		$result = [];
		if ($remote_enabled) {
			$result = $this->plugin->client()->start_image_audit($store_id, $scan_options);
			if (is_wp_error($result)) {
				$remote_enabled = false;
				$warnings[] = sprintf(
					/* translators: %s: remote API error message. */
					__('Remote health report unavailable: %s. The local catalogue scan will still show products you can select for the queue.', 'optivra-image-studio-for-woocommerce'),
					$result->get_error_message()
				);
				$result = [];
			}
		}

		$scan_id = $this->extract_scan_id(is_array($result) ? $result : []);
		if ('' === $scan_id) {
			$scan_id = 'local-' . sanitize_key(function_exists('wp_generate_uuid4') ? wp_generate_uuid4() : uniqid('', true));
			$remote_enabled = false;
		}

		update_option('optivra_latest_scan_id', $scan_id, false);
		update_option('optivra_latest_audit_store_id', $store_id, false);
		update_option('optivra_latest_audit_remote_enabled', $remote_enabled, false);
		update_option('optivra_scan_in_progress', true, false);
		update_option('optivra_latest_audit_items', ['scan_id' => $scan_id, 'items' => []], false);

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
				'warnings'         => $warnings,
				'started_at'       => current_time('mysql'),
				'message'          => $remote_enabled ? __('Audit scan started. Metadata collection is free and does not use image processing credits.', 'optivra-image-studio-for-woocommerce') : __('Local catalogue scan started. You can still review scanned products and add selected images to the queue.', 'optivra-image-studio-for-woocommerce'),
			]
		);

		wp_send_json_success(['scan_id' => $scan_id, 'total_products' => $total_products, 'remote_enabled' => $remote_enabled, 'progress' => $progress]);
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
		$progress['warnings'] = isset($progress['warnings']) && is_array($progress['warnings']) ? $progress['warnings'] : [];
		$progress['errors'] = isset($progress['errors']) && is_array($progress['errors']) ? $progress['errors'] : [];
		$total_products = max(0, (int) ($progress['total_products'] ?? 0));
		$batch = $this->plugin->scanner()->collect_audit_batch($options, $offset, 25);
		$items = isset($batch['items']) && is_array($batch['items']) ? $batch['items'] : [];
		$this->append_audit_scan_items($scan_id, $items);
		$remote_items = array_values(array_filter($items, static function ($item): bool {
			return is_array($item) && ! empty($item['_audit_item']);
		}));
		$remote_items = array_map(static function ($item): array {
			$item = is_array($item) ? $item : [];
			unset($item['_audit_item']);
			unset($item['_queueable_image']);
			return $item;
		}, $remote_items);

		$remote_enabled = (bool) get_option('optivra_latest_audit_remote_enabled', true);
		if ($remote_enabled) {
			foreach (array_chunk($remote_items, 75) as $chunk) {
				$result = $this->plugin->client()->submit_image_audit_items($scan_id, $chunk);
				if (is_wp_error($result)) {
					$remote_enabled = false;
					update_option('optivra_latest_audit_remote_enabled', false, false);
					$progress['warnings'][] = sprintf(
						/* translators: %s: remote API error message. */
						__('Remote report submission failed: %s. The local catalogue scan will continue so products can still be selected for the queue.', 'optivra-image-studio-for-woocommerce'),
						$result->get_error_message()
					);
					$progress['errors'][] = $result->get_error_message();
					break;
				}
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
		if ($done && $remote_enabled && (int) ($progress['images_scanned'] ?? 0) <= 0) {
			$remote_enabled = false;
			update_option('optivra_latest_audit_remote_enabled', false, false);
			$progress['warnings'][] = __('No queueable image metadata was found for this scan. Showing scanned products locally so you can review them.', 'optivra-image-studio-for-woocommerce');
		}
		$progress['message'] = $done
			? ($remote_enabled ? __('Metadata collection finished. Optivra is calculating the health report.', 'optivra-image-studio-for-woocommerce') : __('Metadata collection finished. Preparing the local scanned products list.', 'optivra-image-studio-for-woocommerce'))
			: ($remote_enabled ? __('Metadata batch submitted successfully.', 'optivra-image-studio-for-woocommerce') : __('Metadata batch scanned locally.', 'optivra-image-studio-for-woocommerce'));
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

		$progress = $this->get_audit_progress();
		$progress['warnings'] = isset($progress['warnings']) && is_array($progress['warnings']) ? $progress['warnings'] : [];
		$progress['errors'] = isset($progress['errors']) && is_array($progress['errors']) ? $progress['errors'] : [];
		$remote_enabled = (bool) get_option('optivra_latest_audit_remote_enabled', true);
		$result = [];
		if ($remote_enabled) {
			$result = $this->plugin->client()->complete_image_audit($scan_id);
			if (is_wp_error($result)) {
				$remote_enabled = false;
				update_option('optivra_latest_audit_remote_enabled', false, false);
				$progress['warnings'][] = sprintf(
					/* translators: %s: remote API error message. */
					__('Remote health report failed: %s. Showing the local scanned products list instead.', 'optivra-image-studio-for-woocommerce'),
					$result->get_error_message()
				);
				$progress['errors'][] = $result->get_error_message();
				$result = [];
			}
		}

		$summary = is_array($result) ? $result : [];
		$store_id = (string) get_option('optivra_latest_audit_store_id', '');
		if ($remote_enabled && '' !== $store_id) {
			$latest = $this->plugin->client()->get_latest_image_audit($store_id);
			if (! is_wp_error($latest) && is_array($latest)) {
				$summary = $latest;
			}
		}
		if ($remote_enabled) {
			$full_report = $this->plugin->client()->get_image_audit($scan_id);
			if (! is_wp_error($full_report) && is_array($full_report)) {
				$summary = $full_report;
			}
		}
		$local_items = $this->get_cached_audit_scan_items($scan_id);
		if (! empty($local_items)) {
			$summary['_local_scan_items'] = $local_items;
		}
		if (empty($summary)) {
			$summary = [
				'scan'     => ['id' => $scan_id],
				'products' => $local_items,
				'images'   => $local_items,
				'summary'  => empty($local_items) ? __('No products found for this scan scope.', 'optivra-image-studio-for-woocommerce') : __('Catalogue scan completed. Review scanned products and choose which images to add to the queue.', 'optivra-image-studio-for-woocommerce'),
			];
		}
		$score = $this->extract_health_score($summary);
		update_option('optivra_latest_health_score', $score, false);
		update_option('optivra_last_scan_completed_at', current_time('mysql'), false);
		update_option('optivra_scan_in_progress', false, false);
		$this->save_report_summary($scan_id, $summary, $score);

		$progress['status'] = 'completed';
		$progress['status_label'] = __('Completed', 'optivra-image-studio-for-woocommerce');
		$progress['message'] = $remote_enabled ? __('Product Image Health Report completed. Scanning did not consume image processing credits.', 'optivra-image-studio-for-woocommerce') : __('Catalogue scan completed locally. Review scanned products and add selected images to the queue.', 'optivra-image-studio-for-woocommerce');
		$progress['completed_at'] = current_time('mysql');
		$progress = $this->save_audit_progress($progress);

		wp_send_json_success(['progress' => $progress, 'summary' => $this->summarize_report_for_ui($summary, $score), 'result' => $this->normalize_scan_result($summary, ['health_score' => $score])]);
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
			$image_types = ['main', 'gallery', 'variation', 'category'];
		}

		if (empty($checks)) {
			$checks = ['seo', 'performance', 'consistency', 'feed_readiness', 'visual_quality', 'background_quality', 'lighting_contrast'];
		}

		$allowed_checks = ['seo', 'performance', 'consistency', 'feed_readiness', 'visual_quality', 'background_quality', 'lighting_contrast'];
		$scan_limit = isset($decoded['scan_limit']) ? absint($decoded['scan_limit']) : 0;
		$options = [
			'scan_scope'                  => $scope,
			'status'                      => 'publish',
			'category_ids'                => 'categories' === $scope ? $category_ids : [],
			'include_main_images'         => in_array('main', $image_types, true),
			'include_gallery_images'      => in_array('gallery', $image_types, true),
			'include_variation_images'    => in_array('variation', $image_types, true),
			'include_category_thumbnails' => in_array('category', $image_types, true),
			'checks'                      => array_values(array_intersect($checks, $allowed_checks)),
			'scan_limit'                  => $scan_limit > 0 ? $scan_limit : null,
			'background_analysis'         => ! array_key_exists('background_analysis', $decoded) || ! empty($decoded['background_analysis']),
			'seo_metadata_analysis'       => ! array_key_exists('seo_metadata_analysis', $decoded) || ! empty($decoded['seo_metadata_analysis']),
			'performance_analysis'        => ! array_key_exists('performance_analysis', $decoded) || ! empty($decoded['performance_analysis']),
			'lighting_contrast_analysis'  => ! array_key_exists('lighting_contrast_analysis', $decoded) || ! empty($decoded['lighting_contrast_analysis']),
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

		return '';
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
	 * @param array<int,array<string,mixed>> $items Items from the local WooCommerce scanner.
	 */
	private function append_audit_scan_items(string $scan_id, array $items): void {
		if (empty($items)) {
			return;
		}

		$cache = get_option('optivra_latest_audit_items', []);
		$cache = is_array($cache) ? $cache : [];
		$existing = isset($cache['scan_id'], $cache['items']) && (string) $cache['scan_id'] === $scan_id && is_array($cache['items'])
			? $cache['items']
			: [];

		foreach ($items as $item) {
			if (is_array($item)) {
				$prepared = $this->prepare_local_scan_product($item, $scan_id);
				if (! empty($prepared)) {
					$existing[$prepared['token']] = $prepared;
				}
			}
		}

		update_option('optivra_latest_audit_items', ['scan_id' => $scan_id, 'items' => $existing], false);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private function get_cached_audit_scan_items(string $scan_id): array {
		$cache = get_option('optivra_latest_audit_items', []);
		if (! is_array($cache) || (string) ($cache['scan_id'] ?? '') !== $scan_id || empty($cache['items']) || ! is_array($cache['items'])) {
			return [];
		}

		$items = [];
		foreach ($cache['items'] as $item) {
			if (is_array($item)) {
				$items[] = $item;
			}
		}

		return $items;
	}

	/**
	 * @param array<string,mixed> $raw Raw scanner row.
	 * @return array<string,mixed>
	 */
	private function prepare_local_scan_product(array $raw, string $scan_id): array {
		$product_id = absint($raw['product_id'] ?? 0);
		$attachment_id = absint($raw['_attachment_id'] ?? $raw['attachment_id'] ?? $raw['image_id'] ?? 0);
		if ($product_id <= 0) {
			return [];
		}

		$image_role = sanitize_key((string) ($raw['image_role'] ?? 'main'));
		$gallery_index = absint($raw['gallery_index'] ?? 0);
		$token = sanitize_key(md5($product_id . ':' . $attachment_id . ':' . $image_role . ':' . $gallery_index));
		$category_names = isset($raw['category_names']) && is_array($raw['category_names']) ? array_values(array_map('sanitize_text_field', $raw['category_names'])) : [];

		return [
			'token'         => $token,
			'productId'     => $product_id,
			'product_id'    => $product_id,
			'productName'   => sanitize_text_field((string) ($raw['product_name'] ?? get_the_title($product_id))),
			'product_name'  => sanitize_text_field((string) ($raw['product_name'] ?? get_the_title($product_id))),
			'productUrl'    => esc_url_raw((string) ($raw['product_url'] ?? get_permalink($product_id))),
			'product_url'   => esc_url_raw((string) ($raw['product_url'] ?? get_permalink($product_id))),
			'categoryName'  => $category_names[0] ?? __('Uncategorised', 'optivra-image-studio-for-woocommerce'),
			'category_name' => $category_names[0] ?? __('Uncategorised', 'optivra-image-studio-for-woocommerce'),
			'categoryNames' => $category_names,
			'imageId'       => $attachment_id,
			'image_id'      => $attachment_id,
			'attachment_id' => $attachment_id,
			'imageUrl'      => esc_url_raw((string) ($raw['image_url'] ?? wp_get_attachment_url($attachment_id))),
			'image_url'     => esc_url_raw((string) ($raw['image_url'] ?? wp_get_attachment_url($attachment_id))),
			'thumbnailUrl'  => esc_url_raw((string) (wp_get_attachment_image_url($attachment_id, 'thumbnail') ?: ($raw['image_url'] ?? ''))),
			'imageRole'     => $image_role,
			'image_role'    => $image_role,
			'galleryIndex'  => $gallery_index,
			'gallery_index' => $gallery_index,
			'status'        => sanitize_text_field((string) ($raw['status'] ?? __('Healthy', 'optivra-image-studio-for-woocommerce'))),
			'readiness'     => sanitize_text_field((string) ($raw['readiness'] ?? __('Ready', 'optivra-image-studio-for-woocommerce'))),
			'issues'        => isset($raw['issues']) && is_array($raw['issues']) ? $raw['issues'] : [],
			'recommendations' => isset($raw['recommendations']) && is_array($raw['recommendations']) ? $raw['recommendations'] : [],
			'recommended'   => ! empty($raw['recommended']),
			'queueable'     => $attachment_id > 0 && ! empty($raw['_queueable_image']),
			'queuePayload'  => [
				'scan_id'           => $scan_id,
				'product_id'        => $product_id,
				'image_id'          => $attachment_id,
				'attachment_id'     => $attachment_id,
				'image_role'        => $image_role,
				'gallery_index'     => $gallery_index,
				'action_type'       => 'queue_processing',
				'priority'          => 'medium',
				'background_preset' => 'optivra-default',
				'job_kind'          => 'image_processing',
			],
		];
	}

	/**
	 * @param array<string,mixed> $raw Raw report payload.
	 * @param array<string,mixed> $latest Cached report row.
	 * @return array<string,mixed>
	 */
	private function normalize_scan_result(array $raw, array $latest = []): array {
		$metrics = $this->get_report_metrics($raw);
		$scan = isset($raw['scan']) && is_array($raw['scan']) ? $raw['scan'] : [];
		$issue_summary = isset($raw['issue_summary']) && is_array($raw['issue_summary']) ? $raw['issue_summary'] : [];
		$recommendations = $this->report_list($raw, ['recommendedActions', 'top_recommendations', 'recommendations'], 100);
		$products = $this->normalize_scan_products($raw);
		$issues = max((int) $this->extract_issue_count($raw), count(array_filter($products, static function ($product) {
			return ! empty($product['issues']);
		})));
		$score = $this->report_number($metrics, ['product_image_health_score', 'productImageHealthScore'], isset($raw['overallScore']) && is_numeric($raw['overallScore']) ? (float) $raw['overallScore'] : (float) ($latest['health_score'] ?? get_option('optivra_latest_health_score', 0)));
		if ($score <= 0 && ! empty($products) && $issues <= 0) {
			$score = 96;
		}
		$pills = $this->normalize_recommendation_pills($raw, $metrics, $issue_summary, $recommendations, $products);
		$summary = $this->report_text($raw, ['summary'], '');
		if ('' === $summary && isset($raw['healthReport']) && is_array($raw['healthReport'])) {
			$summary = $this->report_text($raw['healthReport'], ['summary'], '');
		}
		if ('' === $summary) {
			$summary = empty($products)
				? __('No products found for this scan scope.', 'optivra-image-studio-for-woocommerce')
				: ($issues <= 0 ? __('Scan complete. No major issues found.', 'optivra-image-studio-for-woocommerce') : $this->build_simple_health_summary($metrics, $issues));
		}

		return [
			'overallScore'        => $score,
			'categoryScores'      => isset($raw['categoryScores']) && is_array($raw['categoryScores']) ? $raw['categoryScores'] : $this->get_health_category_cards($metrics),
			'highlights'          => isset($raw['highlights']) && is_array($raw['highlights']) ? array_values(array_filter(array_map('sanitize_text_field', $raw['highlights']))) : [$summary],
			'recommendationPills' => $pills,
			'products'            => $products,
			'images'              => $products,
			'recommendedActions'  => $recommendations,
			'healthReport'        => [
				'overallScore'   => $score,
				'summary'        => $summary,
				'highlights'     => isset($raw['highlights']) && is_array($raw['highlights']) ? $raw['highlights'] : [$summary],
				'categoryScores' => isset($raw['categoryScores']) && is_array($raw['categoryScores']) ? $raw['categoryScores'] : $this->get_health_category_cards($metrics),
			],
			'totalScanned'        => count($products),
			'recommendedCount'    => count(array_filter($products, static function ($product) {
				return ! empty($product['recommended']);
			})),
		];
	}

	/**
	 * @param array<string,mixed> $raw Raw report payload.
	 * @return array<int,array<string,mixed>>
	 */
	private function normalize_scan_products(array $raw): array {
		$scan_id = isset($raw['scan']['id']) && is_scalar($raw['scan']['id']) ? (string) $raw['scan']['id'] : (string) get_option('optivra_latest_scan_id', '');
		$candidates = [];
		foreach (['products', 'images', '_local_scan_items', 'affectedProducts', 'top_items_needing_attention', 'recommended_first_50_images'] as $key) {
			if (isset($raw[$key]) && is_array($raw[$key])) {
				$candidates = $raw[$key];
				break;
			}
		}

		$products = [];
		foreach ($candidates as $row) {
			if (is_array($row)) {
				$product = $this->normalize_scan_product_row($row, $scan_id);
				if (! empty($product)) {
					$products[$product['token']] = $product;
				}
			}
		}

		if (! empty($raw['_local_scan_items']) && is_array($raw['_local_scan_items'])) {
			foreach ($raw['_local_scan_items'] as $local_row) {
				if (! is_array($local_row)) {
					continue;
				}
				$local = $this->normalize_scan_product_row($local_row, $scan_id);
				if (empty($local)) {
					continue;
				}
				if (isset($products[$local['token']])) {
					$merged = array_merge($local, array_filter($products[$local['token']], static function ($value) {
						return [] !== $value && '' !== $value && null !== $value;
					}));
					$merged['attachmentId'] = $local['attachmentId'] ?? $local['imageId'] ?? 0;
					$merged['queuePayload'] = isset($merged['queuePayload']) && is_array($merged['queuePayload']) ? array_merge($merged['queuePayload'], (array) ($local['queuePayload'] ?? [])) : ($local['queuePayload'] ?? []);
					$products[$local['token']] = $merged;
				} else {
					$products[$local['token']] = $local;
				}
			}
		}

		return array_values($products);
	}

	/**
	 * @param array<string,mixed> $row Product/image row.
	 * @return array<string,mixed>
	 */
	private function normalize_scan_product_row(array $row, string $scan_id): array {
		$product_id = absint($row['productId'] ?? $row['product_id'] ?? 0);
		$image_id_raw = (string) ($row['imageId'] ?? $row['image_id'] ?? '');
		$attachment_id = absint($row['attachment_id'] ?? $row['_attachment_id'] ?? $image_id_raw);
		if ($product_id <= 0 && '' === $image_id_raw) {
			return [];
		}

		$image_role = sanitize_key((string) ($row['imageRole'] ?? $row['image_role'] ?? 'main'));
		$gallery_index = absint($row['galleryIndex'] ?? $row['gallery_index'] ?? 0);
		$token = sanitize_key((string) ($row['token'] ?? md5($product_id . ':' . ($attachment_id ?: $image_id_raw) . ':' . $image_role . ':' . $gallery_index)));
		$issues = $this->normalize_scan_product_issues($row);
		$recommended = ! empty($row['recommended']) || ! empty($issues);
		$status = $this->report_text($row, ['status'], $recommended ? __('Needs attention', 'optivra-image-studio-for-woocommerce') : __('Healthy', 'optivra-image-studio-for-woocommerce'));
		$queue_payload = isset($row['queuePayload']) && is_array($row['queuePayload']) ? $row['queuePayload'] : (isset($row['queue_payload']) && is_array($row['queue_payload']) ? $row['queue_payload'] : []);
		$queueable = $attachment_id > 0 && (! array_key_exists('queueable', $row) || ! empty($row['queueable']));
		$queue_payload = array_merge(
			[
				'scan_id'           => $scan_id,
				'product_id'        => $product_id,
				'image_id'          => $attachment_id,
				'attachment_id'     => $attachment_id,
				'image_role'        => $image_role,
				'gallery_index'     => $gallery_index,
				'action_type'       => 'queue_processing',
				'priority'          => ! empty($issues[0]['severity']) ? sanitize_key((string) $issues[0]['severity']) : 'medium',
				'background_preset' => 'optivra-default',
				'job_kind'          => 'image_processing',
			],
			$queue_payload
		);
		if ($attachment_id > 0) {
			$queue_payload['image_id'] = $attachment_id;
			$queue_payload['attachment_id'] = $attachment_id;
		}

		return [
			'token'           => $token,
			'productId'       => $product_id,
			'productName'     => $this->report_text($row, ['productName', 'product_name'], $product_id > 0 ? get_the_title($product_id) : __('Product image', 'optivra-image-studio-for-woocommerce')),
			'productUrl'      => esc_url_raw($this->report_text($row, ['productUrl', 'product_url'], $product_id > 0 ? get_permalink($product_id) : '')),
			'categoryName'    => $this->report_text($row, ['categoryName', 'category_name'], $this->first_category_name($row)),
			'imageId'         => $attachment_id ?: $image_id_raw,
			'attachmentId'    => $attachment_id,
			'imageUrl'        => esc_url_raw($this->report_text($row, ['imageUrl', 'image_url'], $attachment_id > 0 ? (string) wp_get_attachment_url($attachment_id) : '')),
			'thumbnailUrl'    => esc_url_raw($this->report_text($row, ['thumbnailUrl', 'thumbnail_url'], $attachment_id > 0 ? (string) wp_get_attachment_image_url($attachment_id, 'thumbnail') : '')),
			'imageRole'       => $image_role,
			'galleryIndex'    => $gallery_index,
			'status'          => $status,
			'issues'          => $issues,
			'recommendations' => $this->normalize_scan_product_recommendations($row, $issues),
			'readiness'       => $this->report_text($row, ['readiness'], $recommended ? __('Recommended', 'optivra-image-studio-for-woocommerce') : __('Ready', 'optivra-image-studio-for-woocommerce')),
			'recommended'     => $recommended,
			'queueable'       => $queueable,
			'queuePayload'    => $queue_payload,
		];
	}

	/**
	 * @param array<string,mixed> $row Product/image row.
	 * @return array<int,array<string,string>>
	 */
	private function normalize_scan_product_issues(array $row): array {
		$issues = [];
		if (isset($row['issues']) && is_array($row['issues'])) {
			foreach ($row['issues'] as $issue) {
				if (! is_array($issue)) {
					continue;
				}
				$type = sanitize_key((string) ($issue['type'] ?? $issue['issue_type'] ?? $issue['filter'] ?? 'manual_review'));
				$issues[] = [
					'type'     => $type,
					'label'    => $this->report_text($issue, ['label', 'title', 'description'], $this->get_issue_type_label($type)),
					'severity' => sanitize_key((string) ($issue['severity'] ?? 'medium')),
				];
			}
		}

		if (empty($issues) && ! empty($row['issue_count'])) {
			$type = sanitize_key((string) ($row['top_issue_type'] ?? $row['issue_type'] ?? 'manual_review'));
			$issues[] = [
				'type'     => $type,
				'label'    => $this->report_text($row, ['recommended_action'], $this->get_issue_type_label($type)),
				'severity' => sanitize_key((string) ($row['highest_severity'] ?? $row['severity'] ?? 'medium')),
			];
		}

		return $issues;
	}

	/**
	 * @param array<string,mixed>              $row Product/image row.
	 * @param array<int,array<string,string>> $issues Issues.
	 * @return array<int,array<string,string>>
	 */
	private function normalize_scan_product_recommendations(array $row, array $issues): array {
		$recommendations = [];
		if (isset($row['recommendations']) && is_array($row['recommendations'])) {
			foreach ($row['recommendations'] as $recommendation) {
				if (is_array($recommendation)) {
					$recommendations[] = [
						'label'    => $this->report_text($recommendation, ['label', 'title'], __('Recommended fix', 'optivra-image-studio-for-woocommerce')),
						'severity' => sanitize_key((string) ($recommendation['severity'] ?? 'info')),
						'filter'   => sanitize_key((string) ($recommendation['filter'] ?? $recommendation['type'] ?? 'ready_to_optimise')),
					];
				}
			}
		}

		if (empty($recommendations)) {
			foreach (array_slice($issues, 0, 3) as $issue) {
				$recommendations[] = [
					'label'    => $issue['label'],
					'severity' => $issue['severity'],
					'filter'   => $issue['type'],
				];
			}
		}

		return $recommendations;
	}

	/**
	 * @param array<string,mixed> $row Product/image row.
	 */
	private function first_category_name(array $row): string {
		foreach (['categoryNames', 'category_names'] as $key) {
			if (isset($row[$key]) && is_array($row[$key]) && ! empty($row[$key][0]) && is_scalar($row[$key][0])) {
				return sanitize_text_field((string) $row[$key][0]);
			}
		}

		return __('Uncategorised', 'optivra-image-studio-for-woocommerce');
	}

	/**
	 * @param array<string,mixed>              $raw Raw report payload.
	 * @param array<string,mixed>              $metrics Metrics.
	 * @param array<string,mixed>              $issue_summary Issue summary.
	 * @param array<int,array<string,mixed>>   $recommendations Recommendations.
	 * @param array<int,array<string,mixed>>   $products Products.
	 * @return array<int,array{label:string,count:int,severity:string,filter:string}>
	 */
	private function normalize_recommendation_pills(array $raw, array $metrics, array $issue_summary, array $recommendations, array $products): array {
		if (isset($raw['recommendationPills']) && is_array($raw['recommendationPills'])) {
			$pills = [];
			foreach ($raw['recommendationPills'] as $pill) {
				if (! is_array($pill)) {
					continue;
				}
				$pills[] = [
					'label'    => $this->report_text($pill, ['label'], __('Recommendation', 'optivra-image-studio-for-woocommerce')),
					'count'    => max(0, (int) $this->report_number($pill, ['count'], 0)),
					'severity' => sanitize_key((string) ($pill['severity'] ?? 'info')),
					'filter'   => sanitize_key((string) ($pill['filter'] ?? 'ready_to_optimise')),
				];
			}
			if (! empty($pills)) {
				return $pills;
			}
		}

		$pills = $this->get_recommendation_pills($metrics, $issue_summary, $recommendations);
		if (empty($pills) && ! empty($products)) {
			$recommended = count(array_filter($products, static function ($product) {
				return ! empty($product['recommended']);
			}));
			$pills[] = [
				'label'    => $recommended > 0 ? __('Ready to optimise', 'optivra-image-studio-for-woocommerce') : __('No major issues found', 'optivra-image-studio-for-woocommerce'),
				'count'    => $recommended,
				'severity' => $recommended > 0 ? 'info' : 'good',
				'filter'   => $recommended > 0 ? 'ready_to_optimise' : 'healthy',
			];
		}

		return $pills;
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

	/**
	 * @return array<int,array{label:string,score:float,description:string}>
	 */
	private function get_health_category_cards(array $metrics): array {
		return [
			[
				'label'       => __('Image SEO', 'optivra-image-studio-for-woocommerce'),
				'score'       => $this->report_number($metrics, ['seo_score'], 0),
				'description' => __('Alt text, filenames, and product-feed metadata.', 'optivra-image-studio-for-woocommerce'),
			],
			[
				'label'       => __('Background Quality', 'optivra-image-studio-for-woocommerce'),
				'score'       => $this->report_number($metrics, ['background_quality_score', 'image_quality_score', 'quality_score'], 0),
				'description' => __('Clean, consistent, product-friendly backgrounds.', 'optivra-image-studio-for-woocommerce'),
			],
			[
				'label'       => __('Lighting & Contrast', 'optivra-image-studio-for-woocommerce'),
				'score'       => $this->report_number($metrics, ['lighting_contrast_score', 'image_quality_score', 'quality_score'], 0),
				'description' => __('Product visibility, shadows, and contrast.', 'optivra-image-studio-for-woocommerce'),
			],
			[
				'label'       => __('File Size', 'optivra-image-studio-for-woocommerce'),
				'score'       => $this->report_number($metrics, ['performance_score'], 0),
				'description' => __('Large files, image dimensions, and WebP readiness.', 'optivra-image-studio-for-woocommerce'),
			],
			[
				'label'       => __('Product Consistency', 'optivra-image-studio-for-woocommerce'),
				'score'       => $this->report_number($metrics, ['catalogue_consistency_score', 'consistency_score'], 0),
				'description' => __('Matching image style across the catalogue.', 'optivra-image-studio-for-woocommerce'),
			],
			[
				'label'       => __('Optimisation Readiness', 'optivra-image-studio-for-woocommerce'),
				'score'       => $this->report_number($metrics, ['google_shopping_readiness_score', 'google_readiness_score', 'completeness_score'], 0),
				'description' => __('Images ready for safe queueing and review.', 'optivra-image-studio-for-woocommerce'),
			],
		];
	}

	private function build_simple_health_summary(array $metrics, int $issues): string {
		$missing_alt = (int) $this->report_number($metrics, ['missing_alt_text_count'], 0);
		$background = (int) $this->report_number($metrics, ['cluttered_background_count', 'inconsistent_background_count'], 0);
		if ($issues <= 0) {
			return __('Your store images are mostly healthy. Run a fresh scan after your next catalogue update to keep the report current.', 'optivra-image-studio-for-woocommerce');
		}

		return sprintf(
			/* translators: 1: background issue count, 2: missing alt text count. */
			__('Your store images are mostly healthy, but %1$d products need stronger backgrounds and %2$d images are missing SEO-friendly alt text.', 'optivra-image-studio-for-woocommerce'),
			max(0, $background),
			max(0, $missing_alt)
		);
	}

	/**
	 * @return array<int,array{label:string,count:int,severity:string,filter:string}>
	 */
	private function get_recommendation_pills(array $metrics, array $issue_summary, array $recommendations): array {
		$by_type = isset($issue_summary['by_issue_type']) && is_array($issue_summary['by_issue_type']) ? $issue_summary['by_issue_type'] : [];
		$pills = [
			['missing_alt_text', __('Missing alt text', 'optivra-image-studio-for-woocommerce'), (int) ($metrics['missing_alt_text_count'] ?? $by_type['missing_alt_text'] ?? 0), 'high'],
			['dark_background', __('Dark background', 'optivra-image-studio-for-woocommerce'), (int) ($metrics['over_dark_count'] ?? $by_type['over_dark'] ?? 0), 'medium'],
			['low_contrast', __('Low product contrast', 'optivra-image-studio-for-woocommerce'), (int) ($metrics['low_contrast_count'] ?? $by_type['low_contrast'] ?? 0), 'medium'],
			['oversized_file', __('Large image file', 'optivra-image-studio-for-woocommerce'), (int) ($metrics['oversized_image_count'] ?? $by_type['oversized_file'] ?? 0), 'high'],
			['inconsistent_background', __('Inconsistent background', 'optivra-image-studio-for-woocommerce'), (int) ($metrics['inconsistent_background_count'] ?? $by_type['inconsistent_background'] ?? 0), 'medium'],
			['lighting', __('Needs lighting enhancement', 'optivra-image-studio-for-woocommerce'), (int) ($metrics['lighting_issue_count'] ?? 0), 'medium'],
			['too_small_in_frame', __('Product too small', 'optivra-image-studio-for-woocommerce'), (int) ($metrics['too_small_in_frame_count'] ?? $by_type['too_small_in_frame'] ?? 0), 'medium'],
			['generic_filename', __('SEO filename issue', 'optivra-image-studio-for-woocommerce'), (int) ($metrics['generic_filename_count'] ?? $by_type['generic_filename'] ?? 0), 'low'],
		];
		$rows = [];

		foreach ($pills as [$filter, $label, $count, $severity]) {
			if ($count > 0) {
				$rows[] = [
					'label'    => (string) $label,
					'count'    => (int) $count,
					'severity' => (string) $severity,
					'filter'   => (string) $filter,
				];
			}
		}

		if (empty($rows) && ! empty($recommendations)) {
			$rows[] = [
				'label'    => __('Ready to optimise', 'optivra-image-studio-for-woocommerce'),
				'count'    => count($recommendations),
				'severity' => 'info',
				'filter'   => 'ready_to_optimise',
			];
		}

		return array_slice($rows, 0, 9);
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
	private function render_audit_recommendation_card(array $recommendation, string $scan_id = ''): void {
		$title = $this->report_text($recommendation, ['title'], __('Recommended fix', 'optivra-image-studio-for-woocommerce'));
		$description = $this->report_text($recommendation, ['description', 'body'], '');
		$priority = $this->report_text($recommendation, ['priority', 'severity'], 'medium');
		$affected = (int) $this->report_number($recommendation, ['estimated_images_affected', 'images_affected'], 0);
		$minutes_low = (int) $this->report_number($recommendation, ['estimated_minutes_saved_low'], 0);
		$minutes_high = (int) $this->report_number($recommendation, ['estimated_minutes_saved_high'], 0);
		$recommendation_id = $this->get_recommendation_id($recommendation);
		$action_type = $this->normalize_recommendation_action_type($this->report_text($recommendation, ['action_type'], 'review_manually'));
		$is_image_action = $this->is_image_processing_recommendation_action($action_type);
		$is_alt_text_action = 'generate_alt_text' === $action_type;
		$primary_label = $is_image_action ? __('Add to Queue', 'optivra-image-studio-for-woocommerce') : ($is_alt_text_action ? __('Generate Alt Text', 'optivra-image-studio-for-woocommerce') : __('Review Images', 'optivra-image-studio-for-woocommerce'));
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
				<?php if ('' !== $scan_id && '' !== $recommendation_id && ($is_image_action || $is_alt_text_action)) : ?>
					<form method="post" action="">
						<?php wp_nonce_field('optivra_recommendation_action', 'optivra_recommendation_action_nonce'); ?>
						<input type="hidden" name="optivra_recommendation_action" value="queue_recommendation" />
						<input type="hidden" name="optivra_recommendation_id" value="<?php echo esc_attr($recommendation_id); ?>" />
						<button type="submit" class="button button-primary optivra-action-button is-primary"><?php echo esc_html($primary_label); ?></button>
					</form>
				<?php else : ?>
					<a class="button button-primary optivra-action-button is-primary" href="<?php echo esc_url($this->get_scan_results_url($recommendation)); ?>"><?php echo esc_html($primary_label); ?></a>
				<?php endif; ?>
				<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_scan_results_url($recommendation)); ?>"><?php echo esc_html__('Review Images', 'optivra-image-studio-for-woocommerce'); ?></a>
				<?php if ('' !== $scan_id) : ?>
					<form method="post" action="">
						<?php wp_nonce_field('optivra_recommendation_action', 'optivra_recommendation_action_nonce'); ?>
						<input type="hidden" name="optivra_recommendation_action" value="dismiss_recommendation" />
						<input type="hidden" name="optivra_recommendation_key" value="<?php echo esc_attr((string) ($recommendation['key'] ?? $recommendation_id)); ?>" />
						<button type="submit" class="button optivra-action-button is-secondary"><?php echo esc_html__('Ignore', 'optivra-image-studio-for-woocommerce'); ?></button>
					</form>
				<?php endif; ?>
			</div>
		</section>
		<?php
	}

	private function send_audit_error(string $message, array $debug = []): void {
		$payload = ['message' => sanitize_textarea_field($message)];
		$settings = $this->plugin->get_settings();

		if (! empty($settings['debug_mode']) && ! empty($debug)) {
			$payload['debug'] = $this->sanitize_audit_error_debug($debug);
			$lines = [];
			foreach ($payload['debug'] as $key => $value) {
				if (is_bool($value)) {
					$value = $value ? 'yes' : 'no';
				}
				if (is_scalar($value) && '' !== (string) $value) {
					$lines[] = sprintf('%s: %s', str_replace('_', ' ', (string) $key), (string) $value);
				}
			}
			if (! empty($lines)) {
				$payload['message'] .= "\n\n" . __('Debug details:', 'optivra-image-studio-for-woocommerce') . "\n" . sanitize_textarea_field(implode("\n", $lines));
			}
		}

		wp_send_json_error($payload, 400);
	}

	private function send_audit_wp_error(WP_Error $error, array $context = []): void {
		$data = $error->get_error_data();
		$data = is_array($data) ? $data : [];
		$debug = array_merge($data, $context);
		$this->send_audit_error($error->get_error_message(), $debug);
	}

	private function sanitize_audit_error_debug(array $debug): array {
		$allowed = [
			'method',
			'url',
			'endpoint_path',
			'status_code',
			'auth_token_present',
			'response_body',
			'store_id',
			'scan_id',
		];
		$output = [];

		foreach ($allowed as $key) {
			if (! array_key_exists($key, $debug)) {
				continue;
			}
			$value = $debug[$key];
			if (is_bool($value) || is_int($value) || is_float($value) || null === $value) {
				$output[$key] = $value;
				continue;
			}
			if (is_scalar($value)) {
				$output[$key] = sanitize_textarea_field(substr((string) $value, 0, 1500));
			}
		}

		return $output;
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
				'title'       => __('Account & Settings', 'optivra-image-studio-for-woocommerce'),
				'description' => __('Manage account, credits, image defaults, scan preferences and advanced support settings in one place.', 'optivra-image-studio-for-woocommerce'),
			],
			'account'         => [
				'title'       => __('Account & Settings', 'optivra-image-studio-for-woocommerce'),
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
				<div class="optivra-brand-mark" aria-hidden="true"><img src="<?php echo esc_url(CIS_URL . 'assets/optivra-logo.png?ver=' . CIS_VERSION); ?>" alt="" width="42" height="42" style="width:42px;height:42px;max-width:42px;max-height:42px;object-fit:contain;" /></div>
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
		$state = $this->get_score_state($score);
		?>
		<div class="optivra-score-card is-<?php echo esc_attr($state); ?>">
			<div>
				<span><?php echo esc_html($label); ?></span>
				<strong><?php echo esc_html(number_format_i18n($score, 0)); ?></strong>
				<small><?php echo esc_html($this->get_score_state_label($state)); ?></small>
			</div>
			<div class="optivra-score-ring" style="<?php echo esc_attr('--optivra-score:' . (string) $score . '%'); ?>" aria-hidden="true"></div>
			<?php if ('' !== $description) : ?>
				<p><?php echo esc_html($description); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}

	private function get_score_state(float $score): string {
		if ($score >= 80) {
			return 'good';
		}

		if ($score >= 60) {
			return 'attention';
		}

		return 'critical';
	}

	private function get_score_state_label(string $state): string {
		$labels = [
			'good'      => __('Good', 'optivra-image-studio-for-woocommerce'),
			'attention' => __('Needs attention', 'optivra-image-studio-for-woocommerce'),
			'critical'  => __('Critical issue', 'optivra-image-studio-for-woocommerce'),
		];

		return $labels[$state] ?? $labels['attention'];
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

	/**
	 * @param array<string,mixed> $scan_result Normalized scan result.
	 */
	private function render_scan_results_panel(array $scan_result): void {
		$products = isset($scan_result['products']) && is_array($scan_result['products']) ? $scan_result['products'] : [];
		$pills = isset($scan_result['recommendationPills']) && is_array($scan_result['recommendationPills']) ? $scan_result['recommendationPills'] : [];
		$health = isset($scan_result['healthReport']) && is_array($scan_result['healthReport']) ? $scan_result['healthReport'] : [];
		$summary = $this->report_text($health, ['summary'], empty($products) ? __('No products found for this scan scope.', 'optivra-image-studio-for-woocommerce') : __('Scan complete. No major issues found.', 'optivra-image-studio-for-woocommerce'));
		$score = isset($scan_result['overallScore']) && is_numeric($scan_result['overallScore']) ? (float) $scan_result['overallScore'] : 0;
		$recommended_count = isset($scan_result['recommendedCount']) ? (int) $scan_result['recommendedCount'] : count(array_filter($products, static function ($product) {
			return is_array($product) && ! empty($product['recommended']);
		}));
		$client_products = [];
		foreach ($products as $index => $product) {
			if (is_array($product)) {
				$client_products[] = $this->get_scanned_product_client_data($product, $index);
			}
		}
		?>
		<div id="optivra-scan-results" class="catalogue-image-studio-panel optivra-scan-results" data-optivra-scan-results>
			<script type="application/json" data-optivra-scan-products-json><?php echo wp_json_encode($client_products, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?></script>
			<section class="optivra-scan-results-summary">
				<div>
					<?php $this->render_status_badge(__('Scan complete', 'optivra-image-studio-for-woocommerce'), 'approved'); ?>
					<h2><?php echo esc_html__('Health Report summary', 'optivra-image-studio-for-woocommerce'); ?></h2>
					<p><?php echo esc_html($summary); ?></p>
					<div class="optivra-recommendation-pills">
						<?php foreach ($pills as $pill) : ?>
							<?php if (is_array($pill)) : ?>
								<button type="button" class="optivra-rec-pill is-<?php echo esc_attr(sanitize_key((string) ($pill['severity'] ?? 'info'))); ?>" data-optivra-result-filter="<?php echo esc_attr(sanitize_key((string) ($pill['filter'] ?? ''))); ?>"><?php echo esc_html($this->report_text($pill, ['label'], __('Recommendation', 'optivra-image-studio-for-woocommerce')) . ' · ' . (string) (int) ($pill['count'] ?? 0)); ?></button>
							<?php endif; ?>
						<?php endforeach; ?>
					</div>
				</div>
				<div class="optivra-hero-score optivra-scan-result-score">
					<span><?php echo esc_html__('Overall score', 'optivra-image-studio-for-woocommerce'); ?></span>
					<strong><?php echo esc_html(number_format_i18n($score, 0)); ?></strong>
					<small><?php echo esc_html($this->get_score_state_label($this->get_score_state($score))); ?></small>
				</div>
			</section>

			<div class="optivra-scan-result-counts">
				<span><strong data-optivra-selected-count>0</strong> <?php echo esc_html__('selected', 'optivra-image-studio-for-woocommerce'); ?></span>
				<span><strong><?php echo esc_html((string) $recommended_count); ?></strong> <?php echo esc_html__('recommended', 'optivra-image-studio-for-woocommerce'); ?></span>
				<span><strong><?php echo esc_html((string) count($products)); ?></strong> <?php echo esc_html__('scanned', 'optivra-image-studio-for-woocommerce'); ?></span>
				<span data-optivra-selected-across><?php echo esc_html__('0 selected across all pages', 'optivra-image-studio-for-woocommerce'); ?></span>
			</div>

			<?php if (empty($products)) : ?>
				<?php $this->render_empty_state(__('No products found for this scan scope.', 'optivra-image-studio-for-woocommerce'), __('Try a broader category or run a full store scan.', 'optivra-image-studio-for-woocommerce')); ?>
			<?php else : ?>
				<form method="post" action="" class="optivra-scanned-products-form">
					<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
					<input type="hidden" name="catalogue_image_studio_action" value="queue_selected_scan_results" />
					<div class="optivra-scanned-products-toolbar">
						<div>
							<h3><?php echo esc_html__('Scanned Products', 'optivra-image-studio-for-woocommerce'); ?></h3>
							<p><?php echo esc_html__('Review scanned products and choose exactly which images to add to the processing queue.', 'optivra-image-studio-for-woocommerce'); ?></p>
						</div>
						<div class="optivra-toolbar-controls">
							<button type="button" class="button" data-optivra-select-recommended><?php echo esc_html__('Select all recommended', 'optivra-image-studio-for-woocommerce'); ?></button>
							<button type="button" class="button" data-optivra-select-visible><?php echo esc_html__('Select visible', 'optivra-image-studio-for-woocommerce'); ?></button>
							<button type="button" class="button" data-optivra-clear-selection><?php echo esc_html__('Clear selection', 'optivra-image-studio-for-woocommerce'); ?></button>
							<button type="submit" class="button button-primary optivra-action-button is-primary"><?php echo esc_html__('Add Selected to Queue', 'optivra-image-studio-for-woocommerce'); ?></button>
							<button type="button" class="button optivra-action-button is-secondary" data-optivra-optimise-recommended><?php echo esc_html__('Optimise Recommended Images', 'optivra-image-studio-for-woocommerce'); ?></button>
						</div>
					</div>
					<div class="optivra-scanned-products-controls">
						<label>
							<span><?php echo esc_html__('Search', 'optivra-image-studio-for-woocommerce'); ?></span>
							<input type="search" data-optivra-results-search placeholder="<?php echo esc_attr__('Product name, ID, or category', 'optivra-image-studio-for-woocommerce'); ?>" />
						</label>
						<label>
							<span><?php echo esc_html__('Sort', 'optivra-image-studio-for-woocommerce'); ?></span>
							<select data-optivra-results-sort>
								<option value="recommended"><?php echo esc_html__('Recommended first', 'optivra-image-studio-for-woocommerce'); ?></option>
								<option value="worst"><?php echo esc_html__('Worst health score first', 'optivra-image-studio-for-woocommerce'); ?></option>
								<option value="name"><?php echo esc_html__('Product name A-Z', 'optivra-image-studio-for-woocommerce'); ?></option>
								<option value="newest"><?php echo esc_html__('Newest scanned first', 'optivra-image-studio-for-woocommerce'); ?></option>
							</select>
						</label>
						<label>
							<span><?php echo esc_html__('Page size', 'optivra-image-studio-for-woocommerce'); ?></span>
							<select data-optivra-page-size>
								<option value="10">10</option>
								<option value="25" selected>25</option>
								<option value="50">50</option>
								<option value="100">100</option>
							</select>
						</label>
					</div>
					<div class="optivra-scanned-products-pagination" aria-live="polite">
						<span data-optivra-results-showing><?php echo esc_html(sprintf(__('Showing 1-%1$d of %2$d scanned products', 'optivra-image-studio-for-woocommerce'), min(25, count($products)), count($products))); ?></span>
						<span><?php echo esc_html__('Page', 'optivra-image-studio-for-woocommerce'); ?> <strong data-optivra-current-page>1</strong> <?php echo esc_html__('of', 'optivra-image-studio-for-woocommerce'); ?> <strong data-optivra-total-pages>1</strong></span>
						<span><strong data-optivra-total-scanned><?php echo esc_html((string) count($products)); ?></strong> <?php echo esc_html__('shown', 'optivra-image-studio-for-woocommerce'); ?></span>
						<div class="optivra-pagination-buttons">
							<button type="button" class="button" data-optivra-page-action="first"><?php echo esc_html__('First', 'optivra-image-studio-for-woocommerce'); ?></button>
							<button type="button" class="button" data-optivra-page-action="previous"><?php echo esc_html__('Previous', 'optivra-image-studio-for-woocommerce'); ?></button>
							<button type="button" class="button" data-optivra-page-action="next"><?php echo esc_html__('Next', 'optivra-image-studio-for-woocommerce'); ?></button>
							<button type="button" class="button" data-optivra-page-action="last"><?php echo esc_html__('Last', 'optivra-image-studio-for-woocommerce'); ?></button>
						</div>
					</div>
					<div class="catalogue-image-studio-warning" data-optivra-selection-warning hidden></div>
					<div class="optivra-scanned-products-table-wrap">
						<table class="widefat striped optivra-scanned-products-table">
							<thead>
								<tr>
									<th class="check-column"></th>
									<th><?php echo esc_html__('Image', 'optivra-image-studio-for-woocommerce'); ?></th>
									<th><?php echo esc_html__('Product', 'optivra-image-studio-for-woocommerce'); ?></th>
									<th><?php echo esc_html__('Category', 'optivra-image-studio-for-woocommerce'); ?></th>
									<th><?php echo esc_html__('Current image status', 'optivra-image-studio-for-woocommerce'); ?></th>
									<th><?php echo esc_html__('Detected issues', 'optivra-image-studio-for-woocommerce'); ?></th>
									<th><?php echo esc_html__('Recommendation', 'optivra-image-studio-for-woocommerce'); ?></th>
									<th><?php echo esc_html__('Actions', 'optivra-image-studio-for-woocommerce'); ?></th>
								</tr>
							</thead>
							<tbody data-optivra-results-body></tbody>
						</table>
					</div>
					<div class="catalogue-image-studio-empty-state" data-optivra-results-empty hidden>
						<strong><?php echo esc_html__('No scanned products match this filter.', 'optivra-image-studio-for-woocommerce'); ?></strong>
					</div>
					<div data-optivra-selected-payloads></div>
				</form>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $product Product row.
	 * @return array<string,mixed>
	 */
	private function get_scanned_product_client_data(array $product, int $index): array {
		$product_id = (string) ($product['productId'] ?? $product['product_id'] ?? '');
		$image_id = (string) ($product['imageId'] ?? $product['image_id'] ?? '');
		$token_source = '' !== $product_id ? 'p' . $product_id . ('' !== $image_id ? '-i' . $image_id : '') : (string) ($product['token'] ?? md5(wp_json_encode($product)));
		$stable_id = sanitize_key($token_source);
		$issues = isset($product['issues']) && is_array($product['issues']) ? $product['issues'] : [];
		$recommendations = isset($product['recommendations']) && is_array($product['recommendations']) ? $product['recommendations'] : [];
		$filters = [];
		$format_pills = static function (array $items) use (&$filters): array {
			$formatted = [];
			foreach ($items as $item) {
				if (! is_array($item)) {
					continue;
				}
				$filter = sanitize_key((string) ($item['type'] ?? $item['filter'] ?? ''));
				if ('' !== $filter) {
					$filters[] = $filter;
				}
				$formatted[] = [
					'label'    => sanitize_text_field((string) ($item['label'] ?? __('Issue', 'optivra-image-studio-for-woocommerce'))),
					'severity' => sanitize_key((string) ($item['severity'] ?? 'info')),
					'filter'   => $filter,
				];
			}

			return $formatted;
		};
		$queue_payload = isset($product['queuePayload']) && is_array($product['queuePayload']) ? $product['queuePayload'] : [];
		$recommended = ! empty($product['recommended']);
		if ($recommended) {
			$filters[] = 'ready_to_optimise';
		}
		if (empty($issues)) {
			$filters[] = 'healthy';
		}

		return [
			'id'             => $stable_id,
			'productId'      => $product_id,
			'imageId'        => $image_id,
			'productName'    => $this->report_text($product, ['productName'], __('Product image', 'optivra-image-studio-for-woocommerce')),
			'categoryName'   => $this->report_text($product, ['categoryName'], __('Uncategorised', 'optivra-image-studio-for-woocommerce')),
			'status'         => $this->report_text($product, ['status'], __('Healthy', 'optivra-image-studio-for-woocommerce')),
			'readiness'      => $this->report_text($product, ['readiness'], __('Ready', 'optivra-image-studio-for-woocommerce')),
			'imageRole'      => sanitize_key((string) ($product['imageRole'] ?? 'main')),
			'imageRoleLabel' => $this->get_image_role_label((string) ($product['imageRole'] ?? 'main')),
			'thumbnailUrl'   => esc_url_raw($this->report_text($product, ['thumbnailUrl', 'imageUrl'], '')),
			'imageUrl'       => esc_url_raw($this->report_text($product, ['imageUrl'], '')),
			'productUrl'     => esc_url_raw($this->report_text($product, ['productUrl'], '')),
			'issues'         => $format_pills($issues),
			'recommendations'=> $format_pills($recommendations),
			'filters'        => array_values(array_unique(array_filter($filters))),
			'recommended'    => $recommended,
			'queueable'      => ! array_key_exists('queueable', $product) || ! empty($product['queueable']),
			'queuePayload'   => $queue_payload,
			'issueCount'     => count($issues),
			'healthScore'    => isset($product['healthScore']) && is_numeric($product['healthScore']) ? (float) $product['healthScore'] : (isset($product['score']) && is_numeric($product['score']) ? (float) $product['score'] : null),
			'scannedIndex'   => $index,
		];
	}

	/**
	 * @param array<string,mixed> $product Product row.
	 */
	private function render_scanned_product_row(array $product): void {
		$token = sanitize_key((string) ($product['token'] ?? md5(wp_json_encode($product))));
		$recommended = ! empty($product['recommended']);
		$queueable = ! array_key_exists('queueable', $product) || ! empty($product['queueable']);
		$issues = isset($product['issues']) && is_array($product['issues']) ? $product['issues'] : [];
		$recommendations = isset($product['recommendations']) && is_array($product['recommendations']) ? $product['recommendations'] : [];
		$queue_payload = isset($product['queuePayload']) && is_array($product['queuePayload']) ? $product['queuePayload'] : [];
		$queue_json = wp_json_encode($queue_payload);
		$image_url = $this->report_text($product, ['thumbnailUrl', 'imageUrl'], '');
		$product_url = $this->report_text($product, ['productUrl'], '');
		?>
		<tr data-optivra-product-row data-optivra-recommended="<?php echo esc_attr($recommended && $queueable ? '1' : '0'); ?>" data-optivra-filters="<?php echo esc_attr(implode(' ', array_map(static function ($issue) { return is_array($issue) ? sanitize_key((string) ($issue['type'] ?? $issue['filter'] ?? '')) : ''; }, $issues))); ?>">
			<th class="check-column">
				<input type="checkbox" name="scan_items[]" value="<?php echo esc_attr($token); ?>" data-optivra-scan-item <?php checked($recommended && $queueable); ?> <?php disabled(! $queueable); ?> />
				<input type="hidden" name="scan_queue_payloads[<?php echo esc_attr($token); ?>]" value="<?php echo esc_attr(is_string($queue_json) ? $queue_json : '{}'); ?>" />
			</th>
			<td><?php $this->render_thumbnail($image_url, __('Scanned product image', 'optivra-image-studio-for-woocommerce')); ?></td>
			<td>
				<strong><?php echo esc_html($this->report_text($product, ['productName'], __('Product image', 'optivra-image-studio-for-woocommerce'))); ?></strong><br />
				<small><?php echo esc_html(sprintf(__('ID %s', 'optivra-image-studio-for-woocommerce'), (string) ($product['productId'] ?? ''))); ?> · <?php echo esc_html($this->get_image_role_label((string) ($product['imageRole'] ?? 'main'))); ?></small>
			</td>
			<td><?php echo esc_html($this->report_text($product, ['categoryName'], __('Uncategorised', 'optivra-image-studio-for-woocommerce'))); ?></td>
			<td>
				<?php $this->render_status_badge($this->report_text($product, ['status'], __('Healthy', 'optivra-image-studio-for-woocommerce')), $recommended ? 'needs-review' : 'approved'); ?>
				<br /><small><?php echo esc_html($this->report_text($product, ['readiness'], __('Ready', 'optivra-image-studio-for-woocommerce'))); ?></small>
			</td>
			<td>
				<?php if (empty($issues)) : ?>
					<span class="optivra-rec-pill is-good"><?php echo esc_html__('Healthy', 'optivra-image-studio-for-woocommerce'); ?></span>
				<?php else : ?>
					<div class="optivra-mini-pill-list">
						<?php foreach (array_slice($issues, 0, 3) as $issue) : ?>
							<?php if (is_array($issue)) : ?>
								<span class="optivra-rec-pill is-<?php echo esc_attr(sanitize_key((string) ($issue['severity'] ?? 'medium'))); ?>"><?php echo esc_html($this->report_text($issue, ['label'], __('Issue', 'optivra-image-studio-for-woocommerce'))); ?></span>
							<?php endif; ?>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
			</td>
			<td>
				<div class="optivra-mini-pill-list">
					<?php if (empty($recommendations)) : ?>
						<span class="optivra-rec-pill is-info"><?php echo esc_html($recommended ? __('Ready to optimise', 'optivra-image-studio-for-woocommerce') : __('No action needed', 'optivra-image-studio-for-woocommerce')); ?></span>
					<?php else : ?>
						<?php foreach (array_slice($recommendations, 0, 3) as $recommendation) : ?>
							<?php if (is_array($recommendation)) : ?>
								<span class="optivra-rec-pill is-<?php echo esc_attr(sanitize_key((string) ($recommendation['severity'] ?? 'info'))); ?>"><?php echo esc_html($this->report_text($recommendation, ['label'], __('Recommended fix', 'optivra-image-studio-for-woocommerce'))); ?></span>
							<?php endif; ?>
						<?php endforeach; ?>
					<?php endif; ?>
				</div>
			</td>
			<td>
				<div class="optivra-row-actions">
					<?php if ('' !== $product_url) : ?><a class="button" href="<?php echo esc_url($product_url); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('View product', 'optivra-image-studio-for-woocommerce'); ?></a><?php endif; ?>
					<?php if ('' !== $this->report_text($product, ['imageUrl'], '')) : ?><a class="button" href="<?php echo esc_url($this->report_text($product, ['imageUrl'], '')); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Preview image', 'optivra-image-studio-for-woocommerce'); ?></a><?php endif; ?>
					<button type="button" class="button" data-optivra-row-add <?php disabled(! $queueable); ?>><?php echo esc_html($queueable ? __('Add to queue', 'optivra-image-studio-for-woocommerce') : __('No image to queue', 'optivra-image-studio-for-woocommerce')); ?></button>
					<button type="button" class="button" data-optivra-row-ignore><?php echo esc_html__('Ignore', 'optivra-image-studio-for-woocommerce'); ?></button>
				</div>
			</td>
		</tr>
		<?php
	}

	private function render_scan_tab(): void {
		$categories = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
		$progress = $this->get_audit_progress();
		$scan_in_progress = (bool) get_option('optivra_scan_in_progress', false);
		$cache = get_option('optivra_report_summary_cache', []);
		$cache = is_array($cache) ? $cache : [];
		$history = isset($cache['history']) && is_array($cache['history']) ? $cache['history'] : [];
		$latest = isset($cache['latest']) && is_array($cache['latest']) ? $cache['latest'] : [];
		$latest_payload = ! empty($latest) ? $this->get_report_payload($latest) : [];
		if (! empty($latest['scan_id']) && empty($latest_payload['_local_scan_items'])) {
			$local_items = $this->get_cached_audit_scan_items((string) $latest['scan_id']);
			if (! empty($local_items)) {
				$latest_payload['_local_scan_items'] = $local_items;
			}
		}
		$scan_result = ! empty($latest) ? $this->normalize_scan_result($latest_payload, $latest) : [];
		?>
		<div class="catalogue-image-studio-panel optivra-scan-wizard">
			<div class="optivra-card-header">
				<h2><?php echo esc_html__('Product Image Health Scan', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<p><?php echo esc_html__('Scan your store for image SEO, background quality, lighting, size, and optimisation opportunities.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>

			<form id="optivra-audit-scan-form" class="optivra-scan-form">
				<section class="optivra-one-click-scan">
					<div>
						<span class="optivra-action-chip"><?php echo esc_html__('Default: scan everything reasonable', 'optivra-image-studio-for-woocommerce'); ?></span>
						<h3><?php echo esc_html__('One click scan, clear report, one click optimise.', 'optivra-image-studio-for-woocommerce'); ?></h3>
						<p><?php echo esc_html__('Optivra checks supported product image health signals by default: SEO metadata, backgrounds, lighting and contrast, file size, consistency, and optimisation readiness.', 'optivra-image-studio-for-woocommerce'); ?></p>
					</div>
					<div class="optivra-scan-actions">
						<button type="button" id="optivra-audit-start" class="button button-primary optivra-action-button is-primary optivra-primary-cta"><?php echo esc_html__('Run Full Health Scan', 'optivra-image-studio-for-woocommerce'); ?></button>
						<button type="button" id="optivra-audit-cancel" class="button optivra-action-button is-secondary" <?php echo $scan_in_progress ? '' : 'hidden'; ?>><?php echo esc_html__('Cancel Scan', 'optivra-image-studio-for-woocommerce'); ?></button>
						<span><?php echo esc_html__('Free metadata scan. No image processing credits used.', 'optivra-image-studio-for-woocommerce'); ?></span>
					</div>
				</section>

				<details class="optivra-advanced-scan-options">
					<summary><?php echo esc_html__('Advanced scan options', 'optivra-image-studio-for-woocommerce'); ?></summary>
					<section class="optivra-wizard-section">
						<div class="optivra-wizard-heading">
							<span>1</span>
							<div>
								<h3><?php echo esc_html__('Product and category filters', 'optivra-image-studio-for-woocommerce'); ?></h3>
								<p><?php echo esc_html__('Optional. Leave these alone to scan all published products.', 'optivra-image-studio-for-woocommerce'); ?></p>
							</div>
						</div>
						<div class="optivra-option-grid">
							<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="all" checked /><span><?php echo esc_html__('All products', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Audit every published WooCommerce product.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
							<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="categories" /><span><?php echo esc_html__('Selected categories', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Limit the report to the categories selected below.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
							<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="missing_main" /><span><?php echo esc_html__('Missing main images', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Find catalogue gaps that affect trust and feeds.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
							<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="updated_since_last_scan" /><span><?php echo esc_html__('Updated products', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Audit recently changed product imagery.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
							<label class="optivra-choice-card"><input type="radio" name="scan_scope" value="unprocessed" /><span><?php echo esc_html__('Unprocessed images', 'optivra-image-studio-for-woocommerce'); ?></span><small><?php echo esc_html__('Focus on images not yet processed by Optivra.', 'optivra-image-studio-for-woocommerce'); ?></small></label>
						</div>
						<?php if (! is_wp_error($categories) && ! empty($categories)) : ?>
							<div class="optivra-category-picker">
								<strong><?php echo esc_html__('Categories', 'optivra-image-studio-for-woocommerce'); ?></strong>
								<div class="optivra-category-list">
									<?php foreach ($categories as $category) : ?>
										<label><input type="checkbox" name="category_ids[]" value="<?php echo esc_attr((string) $category->term_id); ?>" /> <?php echo esc_html($category->name); ?></label>
									<?php endforeach; ?>
								</div>
								<div class="optivra-category-scan-actions">
									<button type="button" id="optivra-audit-category-start" class="button optivra-action-button is-secondary"><?php echo esc_html__('Run Selected Category Scan', 'optivra-image-studio-for-woocommerce'); ?></button>
									<small><?php echo esc_html__('Use this when you want to scan one category, then review and select only those scanned products for the queue.', 'optivra-image-studio-for-woocommerce'); ?></small>
								</div>
							</div>
						<?php endif; ?>
					</section>

					<section class="optivra-wizard-section">
						<div class="optivra-wizard-heading">
							<span>2</span>
							<div>
								<h3><?php echo esc_html__('Image types and checks', 'optivra-image-studio-for-woocommerce'); ?></h3>
								<p><?php echo esc_html__('All supported image roles and health checks are included by default.', 'optivra-image-studio-for-woocommerce'); ?></p>
							</div>
						</div>
						<div class="optivra-switch-grid">
							<label><input type="checkbox" name="image_types[]" value="main" checked /> <span><?php echo esc_html__('Main product images', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="image_types[]" value="gallery" checked /> <span><?php echo esc_html__('Gallery images', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="image_types[]" value="variation" checked /> <span><?php echo esc_html__('Variation images', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="image_types[]" value="category" checked /> <span><?php echo esc_html__('Category thumbnails', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="checks[]" value="seo" checked /> <span><?php echo esc_html__('SEO metadata analysis', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="checks[]" value="performance" checked /> <span><?php echo esc_html__('Performance/file size analysis', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="checks[]" value="background_quality" checked /> <span><?php echo esc_html__('Background analysis', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="checks[]" value="lighting_contrast" checked /> <span><?php echo esc_html__('Lighting/contrast analysis', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="checks[]" value="consistency" checked /> <span><?php echo esc_html__('Product consistency', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="checks[]" value="feed_readiness" checked /> <span><?php echo esc_html__('Optimisation readiness', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						</div>
						<div class="optivra-advanced-scan-grid">
							<label><span><?php echo esc_html__('Scan limit', 'optivra-image-studio-for-woocommerce'); ?></span><input type="number" name="scan_limit" min="1" step="1" placeholder="<?php echo esc_attr__('No limit', 'optivra-image-studio-for-woocommerce'); ?>" /></label>
							<label><input type="checkbox" name="background_analysis" value="1" checked /> <span><?php echo esc_html__('Background analysis toggle', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="seo_metadata_analysis" value="1" checked /> <span><?php echo esc_html__('SEO metadata analysis toggle', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="performance_analysis" value="1" checked /> <span><?php echo esc_html__('Performance/file size analysis toggle', 'optivra-image-studio-for-woocommerce'); ?></span></label>
							<label><input type="checkbox" name="lighting_contrast_analysis" value="1" checked /> <span><?php echo esc_html__('Lighting/contrast analysis toggle', 'optivra-image-studio-for-woocommerce'); ?></span></label>
						</div>
					</section>
				</details>
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

		<?php if (! empty($scan_result)) : ?>
			<?php $this->render_scan_results_panel($scan_result); ?>
		<?php endif; ?>

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
		<tr id="optivra-job-<?php echo esc_attr((string) (int) ($job['id'] ?? 0)); ?>">
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
		<div class="catalogue-image-studio-panel optivra-queue-page">
			<div class="optivra-card-header">
				<h2><?php echo esc_html__('Processing Queue', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<p><?php echo esc_html__('Review active, failed and queued image jobs without cramped table columns. Product safety, SEO suggestions and messages stay in separate panels.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>
			<?php if (! empty($settings['show_low_credit_warning'])) : ?>
				<?php $this->render_monetisation_prompt($usage, max(0, (int) ($usage['credits_remaining'] ?? 0)), count($jobs), false); ?>
			<?php endif; ?>
			<?php if (! empty($settings['auto_refresh_job_status']) && ! empty($jobs)) : ?>
				<?php $this->render_loading_state(__('Watching active jobs. This queue refreshes automatically.', 'optivra-image-studio-for-woocommerce')); ?>
				<script>window.setTimeout(function () { window.location.reload(); }, 15000);</script>
			<?php endif; ?>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<?php $this->render_queue_toolbar(['process', 'process_next_batch', 'retry', 'cancel']); ?>
				<?php $this->render_jobs_table($jobs, true); ?>
			</form>
			<?php $this->render_version_history_table(); ?>
		</div>
		<?php
	}

	/**
	 * @param array<int,string> $actions Actions to show.
	 */
	private function render_queue_toolbar(array $actions): void {
		$labels = [
			'process'            => __('Process selected', 'optivra-image-studio-for-woocommerce'),
			'process_next_batch' => __('Process next batch', 'optivra-image-studio-for-woocommerce'),
			'retry'              => __('Retry failed', 'optivra-image-studio-for-woocommerce'),
			'cancel'             => __('Cancel selected', 'optivra-image-studio-for-woocommerce'),
			'approve'            => __('Approve all selected', 'optivra-image-studio-for-woocommerce'),
			'reject'             => __('Reject selected', 'optivra-image-studio-for-woocommerce'),
			'regenerate_seo'     => __('Regenerate SEO selected', 'optivra-image-studio-for-woocommerce'),
			'revert'             => __('Revert selected', 'optivra-image-studio-for-woocommerce'),
		];
		?>
		<div class="optivra-queue-toolbar">
			<label class="optivra-bulk-select">
				<input type="checkbox" class="catalogue-image-studio-check-all" onclick="document.querySelectorAll('.catalogue-image-studio-job-check').forEach((box) => box.checked = this.checked); catalogueImageStudioUpdateSelectedCount();" />
				<span><?php echo esc_html__('Select visible jobs', 'optivra-image-studio-for-woocommerce'); ?></span>
			</label>
			<div class="optivra-toolbar-controls">
				<label>
					<span><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select data-optivra-queue-status>
						<option value=""><?php echo esc_html__('All', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="queued"><?php echo esc_html__('Queued', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="processing"><?php echo esc_html__('Processing', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="failed"><?php echo esc_html__('Failed', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="completed"><?php echo esc_html__('Completed', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="approved"><?php echo esc_html__('Approved', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="rejected"><?php echo esc_html__('Rejected', 'optivra-image-studio-for-woocommerce'); ?></option>
					</select>
				</label>
				<label>
					<span><?php echo esc_html__('Mode', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select data-optivra-queue-mode>
						<option value=""><?php echo esc_html__('All', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="preserve"><?php echo esc_html__('Preserve', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="standard"><?php echo esc_html__('Standard', 'optivra-image-studio-for-woocommerce'); ?></option>
						<option value="audit"><?php echo esc_html__('Health Report', 'optivra-image-studio-for-woocommerce'); ?></option>
					</select>
				</label>
				<label class="optivra-queue-search">
					<span><?php echo esc_html__('Search product', 'optivra-image-studio-for-woocommerce'); ?></span>
					<input type="search" data-optivra-queue-search placeholder="<?php echo esc_attr__('Product name', 'optivra-image-studio-for-woocommerce'); ?>" />
				</label>
				<label>
					<span><?php echo esc_html__('Bulk action', 'optivra-image-studio-for-woocommerce'); ?></span>
					<select name="catalogue_image_studio_action">
						<?php foreach ($actions as $action) : ?>
							<option value="<?php echo esc_attr($action); ?>"><?php echo esc_html($labels[$action] ?? $action); ?></option>
						<?php endforeach; ?>
					</select>
				</label>
				<button type="submit" class="button button-primary"><?php echo esc_html__('Apply', 'optivra-image-studio-for-woocommerce'); ?></button>
				<a class="button" href="<?php echo esc_url($this->get_admin_page_url('queue')); ?>"><?php echo esc_html__('Refresh status', 'optivra-image-studio-for-woocommerce'); ?></a>
			</div>
			<span class="optivra-selected-count"><span data-cis-selected-count>0</span> <?php echo esc_html__('selected', 'optivra-image-studio-for-woocommerce'); ?></span>
		</div>
		<?php
	}

	private function render_version_history_table(): void {
		$versions = $this->get_version_history(50);
		?>
		<section class="optivra-version-history optivra-card">
			<div class="optivra-card-topline">
				<h3><?php echo esc_html__('Before/After Version History', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<span class="optivra-action-chip"><?php echo esc_html__('Rollback protected', 'optivra-image-studio-for-woocommerce'); ?></span>
			</div>
			<?php if (empty($versions)) : ?>
				<p class="catalogue-image-studio-help"><?php echo esc_html__('Approved image changes will appear here with original and processed image links so you can restore originals later.', 'optivra-image-studio-for-woocommerce'); ?></p>
			<?php else : ?>
				<div class="optivra-version-table-wrap">
					<table class="widefat striped">
						<thead>
							<tr>
								<th><?php echo esc_html__('Product', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Original', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Processed', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Safety', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Mode', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Approved', 'optivra-image-studio-for-woocommerce'); ?></th>
								<th><?php echo esc_html__('Status', 'optivra-image-studio-for-woocommerce'); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ($versions as $version) : ?>
								<tr>
									<td><strong><?php echo esc_html(get_the_title((int) ($version['product_id'] ?? 0)) ?: __('Product image', 'optivra-image-studio-for-woocommerce')); ?></strong><br /><small><?php echo esc_html($this->get_image_role_label((string) ($version['image_role'] ?? ''))); ?></small></td>
									<td><?php $this->render_thumbnail((string) ($version['original_url'] ?? ''), __('Original', 'optivra-image-studio-for-woocommerce')); ?></td>
									<td><?php $this->render_thumbnail((string) ($version['processed_url'] ?? ''), __('Processed', 'optivra-image-studio-for-woocommerce')); ?></td>
									<td><?php $this->render_status_badge($this->get_safety_status_label((string) ($version['safety_status'] ?? 'not_assessed')), $this->map_safety_status_to_badge((string) ($version['safety_status'] ?? 'not_assessed'))); ?></td>
									<td><?php echo esc_html($this->format_processing_mode((string) ($version['processing_mode'] ?? ''))); ?></td>
									<td><?php echo esc_html($this->format_date((string) ($version['approved_at'] ?? ''))); ?></td>
									<td><?php $this->render_status_badge($this->format_status((string) ($version['approval_status'] ?? 'approved')), (string) ($version['approval_status'] ?? 'approved')); ?></td>
								</tr>
							<?php endforeach; ?>
						</tbody>
					</table>
				</div>
			<?php endif; ?>
		</section>
		<?php
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private function get_version_history(int $limit = 50): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin version history query for admin review UI.
		return (array) $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i ORDER BY approved_at DESC, id DESC LIMIT %d',
				catalogue_image_studio_versions_table_name(),
				max(1, $limit)
			),
			ARRAY_A
		);
	}

	private function render_review_tab(): void {
		$jobs = $this->plugin->jobs()->query(['status' => ['completed', 'approved', 'rejected']], 100, 0);
		?>
		<div class="catalogue-image-studio-panel">
			<div class="optivra-card-header">
				<h2><?php echo esc_html__('Review & Approve', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<p><?php echo esc_html__('Approve safe processed images, reject weak outputs, or restore originals from version history.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>
			<form method="post" action="">
				<?php wp_nonce_field('catalogue_image_studio_action', 'catalogue_image_studio_action_nonce'); ?>
				<?php $this->render_queue_toolbar(['approve', 'reject', 'retry', 'regenerate_seo', 'revert']); ?>
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
		$normalized = ! empty($latest) ? $this->normalize_scan_result($report, $latest) : [];
		$metrics = $this->get_report_metrics($report);
		$scan = isset($report['scan']) && is_array($report['scan']) ? $report['scan'] : [];
		$score = ! empty($normalized['overallScore']) && is_numeric($normalized['overallScore']) ? (float) $normalized['overallScore'] : $this->report_number($metrics, ['product_image_health_score', 'productImageHealthScore'], isset($latest['health_score']) ? (float) $latest['health_score'] : (float) get_option('optivra_latest_health_score', 0));
		$last_completed = $this->report_text($scan, ['scan_completed_at', 'updated_at', 'created_at'], (string) get_option('optivra_last_scan_completed_at', ''));
		$normalized_products = isset($normalized['products']) && is_array($normalized['products']) ? $normalized['products'] : [];
		$images_scanned = (int) $this->report_number($scan, ['images_scanned'], (float) ($latest['images_scanned'] ?? count($normalized_products)));
		$products_scanned = (int) $this->report_number($scan, ['products_scanned'], (float) ($latest['products_scanned'] ?? count($normalized_products)));
		$issue_summary = isset($report['issue_summary']) && is_array($report['issue_summary']) ? $report['issue_summary'] : [];
		$issues = $this->extract_issue_count($report);
		$insights = $this->report_list($report, ['top_insights', 'insights'], 6);
		$recommendations = $this->report_list($report, ['top_recommendations', 'recommendations'], 6);
		if (empty($recommendations) && ! empty($normalized['recommendedActions']) && is_array($normalized['recommendedActions'])) {
			$recommendations = array_slice(array_filter($normalized['recommendedActions'], 'is_array'), 0, 6);
		}
		$category_scores = $this->report_list($report, ['category_scores'], 5);
		$health_categories = $this->get_health_category_cards($metrics);
		$recommendation_pills = ! empty($normalized['recommendationPills']) && is_array($normalized['recommendationPills']) ? $normalized['recommendationPills'] : $this->get_recommendation_pills($metrics, $issue_summary, $recommendations);
		$summary_text = isset($normalized['healthReport']) && is_array($normalized['healthReport']) ? $this->report_text($normalized['healthReport'], ['summary'], $this->build_simple_health_summary($metrics, $issues)) : $this->build_simple_health_summary($metrics, $issues);
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
					<p><?php echo esc_html($summary_text); ?></p>
					<div class="optivra-report-actions">
						<?php if (! empty($recommendations)) : ?>
							<form method="post" action="">
								<?php wp_nonce_field('optivra_recommendation_action', 'optivra_recommendation_action_nonce'); ?>
								<input type="hidden" name="optivra_recommendation_action" value="queue_recommendation" />
								<input type="hidden" name="optivra_recommendation_id" value="<?php echo esc_attr($this->get_recommendation_id($recommendations[0])); ?>" />
								<button type="submit" class="button button-primary optivra-action-button is-primary"><?php echo esc_html__('Optimise Recommended Images', 'optivra-image-studio-for-woocommerce'); ?></button>
							</form>
							<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_admin_page_url('recommendations')); ?>"><?php echo esc_html__('Add All Recommended to Queue', 'optivra-image-studio-for-woocommerce'); ?></a>
						<?php endif; ?>
					</div>
				</div>
				<div class="optivra-hero-score">
					<span><?php echo esc_html__('Overall score', 'optivra-image-studio-for-woocommerce'); ?></span>
					<strong><?php echo esc_html(number_format_i18n($score, 0)); ?></strong>
					<small><?php echo esc_html($this->get_score_state_label($this->get_score_state($score))); ?></small>
				</div>
			</section>

			<div class="optivra-report-meta-grid">
				<?php $this->render_metric_card(__('Last scan date', 'optivra-image-studio-for-woocommerce'), '' !== $last_completed ? $last_completed : __('Not available', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_metric_card(__('Images scanned', 'optivra-image-studio-for-woocommerce'), (string) $images_scanned); ?>
				<?php $this->render_metric_card(__('Products scanned', 'optivra-image-studio-for-woocommerce'), (string) $products_scanned); ?>
				<?php $this->render_metric_card(__('Issues found', 'optivra-image-studio-for-woocommerce'), (string) $issues); ?>
			</div>

			<section class="optivra-report-section">
				<h3><?php echo esc_html__('Health categories', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<div class="optivra-card-grid optivra-score-grid">
					<?php foreach ($health_categories as $category) : ?>
						<?php $this->render_score_card($category['label'], $category['score'], $category['description']); ?>
					<?php endforeach; ?>
				</div>
			</section>

			<section class="optivra-report-section optivra-value-card">
				<h3><?php echo esc_html__('Recommendation highlights', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<div class="optivra-recommendation-pills">
					<?php if (empty($recommendation_pills)) : ?>
						<span class="optivra-rec-pill is-good"><?php echo esc_html__('Ready to optimise', 'optivra-image-studio-for-woocommerce'); ?></span>
					<?php else : ?>
						<?php foreach ($recommendation_pills as $pill) : ?>
							<a class="optivra-rec-pill is-<?php echo esc_attr(sanitize_key($pill['severity'])); ?>" href="<?php echo esc_url(add_query_arg(['recommendation_search' => $pill['filter']], $this->get_admin_page_url('recommendations'))); ?>"><?php echo esc_html($pill['label'] . ' · ' . (string) $pill['count']); ?></a>
						<?php endforeach; ?>
					<?php endif; ?>
				</div>
			</section>

			<section class="optivra-report-section optivra-value-card">
				<h3><?php echo esc_html__('Estimated value', 'optivra-image-studio-for-woocommerce'); ?></h3>
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
				<h3><?php echo esc_html__('Processing Safety', 'optivra-image-studio-for-woocommerce'); ?></h3>
				<p><?php echo esc_html__('Product Preservation Safety protects your store from processed images where the product may have been altered, poorly masked, or left unverified.', 'optivra-image-studio-for-woocommerce'); ?></p>
				<div class="optivra-report-meta-grid">
					<?php foreach ($this->get_local_safety_counts() as $status => $count) : ?>
						<?php $this->render_metric_card($this->get_safety_status_label($status), (string) $count); ?>
					<?php endforeach; ?>
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
							<?php $this->render_audit_recommendation_card($recommendation, (string) ($scan['id'] ?? '')); ?>
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
				<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_admin_page_url('recommendations')); ?>"><?php echo esc_html__('Add All Recommended to Queue', 'optivra-image-studio-for-woocommerce'); ?></a>
			</footer>
			<details class="optivra-technical-details">
				<summary><?php echo esc_html__('View technical details', 'optivra-image-studio-for-woocommerce'); ?></summary>
				<div class="optivra-report-meta-grid">
					<?php $this->render_metric_card(__('Manual work estimate', 'optivra-image-studio-for-woocommerce'), sprintf('%s-%s min', number_format_i18n($minutes_low, 0), number_format_i18n($minutes_high, 0))); ?>
					<?php $this->render_metric_card(__('Estimated editing value', 'optivra-image-studio-for-woocommerce'), sprintf('$%s-$%s', number_format_i18n($cost_low, 0), number_format_i18n($cost_high, 0))); ?>
					<?php $this->render_metric_card(__('Hourly rate used', 'optivra-image-studio-for-woocommerce'), sprintf('$%s/hr', number_format_i18n($hourly_rate, 0))); ?>
				</div>
				<div class="optivra-report-meta-grid">
					<?php foreach ($this->get_local_safety_counts() as $status => $count) : ?>
						<?php $this->render_metric_card($this->get_safety_status_label($status), (string) $count); ?>
					<?php endforeach; ?>
				</div>
			</details>
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
	 * @param array<int,array<string,mixed>> $recommendations Recommendations.
	 * @return array<string,mixed>
	 */
	private function find_recommendation_by_id(array $recommendations, string $id): array {
		foreach ($recommendations as $recommendation) {
			if ($id === (string) ($recommendation['id'] ?? '')) {
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
			'regenerate_thumbnail'     => 'resize_crop',
			'background_replacement'   => 'replace_background',
			'standardize_background'   => 'standardise_background',
			'standardize_backgrounds'  => 'standardise_background',
			'standardise_backgrounds'  => 'standardise_background',
			'add_main_image_reminder'  => 'add_main_image',
			'main_image_reminder'      => 'add_main_image',
			'replace_main_image'       => 'add_main_image',
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
			'optimise_image'         => __('Creates image-processing queue jobs for resizing, compression or format optimisation. Credits are used only when images are processed.', 'optivra-image-studio-for-woocommerce'),
			'replace_background'     => __('Uses preserve mode with your selected default background preset.', 'optivra-image-studio-for-woocommerce'),
			'standardise_background' => __('Uses preserve mode with your catalogue background defaults.', 'optivra-image-studio-for-woocommerce'),
			'resize_crop'            => __('Uses deterministic crop/framing where possible and preserve mode for cleanup.', 'optivra-image-studio-for-woocommerce'),
			'convert_webp'           => __('Creates image-processing queue jobs for modern output formats. Credits are used only when images are processed.', 'optivra-image-studio-for-woocommerce'),
			'review_manually'        => __('Manual review is recommended before creating processing jobs.', 'optivra-image-studio-for-woocommerce'),
			'add_main_image'         => __('Reminder workflow only. Choose a product image before processing.', 'optivra-image-studio-for-woocommerce'),
		];

		return $notes[$action_type] ?? $notes['review_manually'];
	}

	private function is_image_processing_recommendation_action(string $action_type): bool {
		return in_array(
			$this->normalize_recommendation_action_type($action_type),
			['optimise_image', 'replace_background', 'standardise_background', 'resize_crop', 'convert_webp'],
			true
		);
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

	private function get_safety_status_label(string $status): string {
		$labels = [
			'passed'       => __('Preservation Passed', 'optivra-image-studio-for-woocommerce'),
			'needs_review' => __('Needs Review', 'optivra-image-studio-for-woocommerce'),
			'failed'       => __('Failed Safety', 'optivra-image-studio-for-woocommerce'),
			'not_assessed' => __('Not Assessed', 'optivra-image-studio-for-woocommerce'),
		];

		return $labels[$status] ?? $labels['not_assessed'];
	}

	/**
	 * @return array{passed:int,needs_review:int,failed:int,not_assessed:int}
	 */
	private function get_local_safety_counts(): array {
		$counts = [
			'passed'       => 0,
			'needs_review' => 0,
			'failed'       => 0,
			'not_assessed' => 0,
		];
		$jobs = $this->plugin->jobs()->query(['status' => ['completed', 'approved', 'rejected', 'failed']], 200, 0);
		foreach ($jobs as $job) {
			if (! is_array($job)) {
				continue;
			}
			$safety = catalogue_image_studio_get_preservation_safety($job);
			$status = (string) ($safety['status'] ?? 'not_assessed');
			if (! isset($counts[$status])) {
				$status = 'not_assessed';
			}
			++$counts[$status];
		}

		return $counts;
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
		$action_type = $this->normalize_recommendation_action_type((string) ($recommendation['action_type'] ?? 'review_manually'));
		$affected = (int) ($recommendation['affected'] ?? 0);
		$minutes_low = (int) ($recommendation['minutes_low'] ?? 0);
		$minutes_high = (int) ($recommendation['minutes_high'] ?? 0);
		$recommendation_id = $this->get_recommendation_id($recommendation);
		$is_image_action = $this->is_image_processing_recommendation_action($action_type);
		$is_alt_text_action = 'generate_alt_text' === $action_type;
		$is_category_review = ! empty($recommendation['category']) && ! $is_image_action && ! $is_alt_text_action;
		$can_queue_recommendation = '' !== $recommendation_id && ($is_image_action || $is_alt_text_action);
		$primary_label = $can_queue_recommendation && $is_image_action
			? __('Add to Queue', 'optivra-image-studio-for-woocommerce')
			: ($can_queue_recommendation && $is_alt_text_action
				? __('Generate Alt Text', 'optivra-image-studio-for-woocommerce')
				: ($is_category_review ? __('Review Category', 'optivra-image-studio-for-woocommerce') : __('Review Images', 'optivra-image-studio-for-woocommerce')));
		$credit_note = $is_image_action
			? sprintf(
				/* translators: %d: estimated image credits. */
				__('Estimated processing credits: %d. Credits are consumed only when images are processed.', 'optivra-image-studio-for-woocommerce'),
				$affected
			)
			: ($is_alt_text_action
				? __('Alt text generation does not use image-processing credits.', 'optivra-image-studio-for-woocommerce')
				: __('No credits used. These items need manual review before processing jobs can be created.', 'optivra-image-studio-for-woocommerce'));
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
			<p class="optivra-action-note"><?php echo esc_html($credit_note); ?></p>
			<div class="optivra-rec-actions">
				<?php if ($can_queue_recommendation) : ?>
					<form method="post" action="">
						<?php wp_nonce_field('optivra_recommendation_action', 'optivra_recommendation_action_nonce'); ?>
						<input type="hidden" name="optivra_recommendation_action" value="queue_recommendation" />
						<input type="hidden" name="optivra_recommendation_key" value="<?php echo esc_attr((string) ($recommendation['key'] ?? '')); ?>" />
						<input type="hidden" name="optivra_recommendation_id" value="<?php echo esc_attr($recommendation_id); ?>" />
						<button type="submit" class="button button-primary optivra-action-button is-primary" <?php disabled('dismissed', $status); ?>><?php echo esc_html($primary_label); ?></button>
					</form>
					<a class="button optivra-action-button is-secondary" href="<?php echo esc_url($this->get_scan_results_url($recommendation)); ?>"><?php echo esc_html__('Review Images', 'optivra-image-studio-for-woocommerce'); ?></a>
				<?php else : ?>
					<a class="button button-primary optivra-action-button is-primary" href="<?php echo esc_url($this->get_scan_results_url($recommendation)); ?>"><?php echo esc_html($primary_label); ?></a>
				<?php endif; ?>
				<form method="post" action="">
					<?php wp_nonce_field('optivra_recommendation_action', 'optivra_recommendation_action_nonce'); ?>
					<input type="hidden" name="optivra_recommendation_action" value="dismiss_recommendation" />
					<input type="hidden" name="optivra_recommendation_key" value="<?php echo esc_attr((string) ($recommendation['key'] ?? '')); ?>" />
					<button type="submit" class="button optivra-action-button is-secondary" <?php disabled('dismissed', $status); ?>><?php echo esc_html__('Dismiss', 'optivra-image-studio-for-woocommerce'); ?></button>
				</form>
			</div>
			<?php if ('' === $recommendation_id && '' !== $scan_id) : ?>
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
		$brand_presets = $this->sanitize_brand_style_presets($settings['brand_style_presets'] ?? []);
		$active_preset = (string) ($settings['active_brand_style_preset'] ?? array_key_first($brand_presets));
		$categories = get_terms(
			[
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
			]
		);
		$categories = is_wp_error($categories) ? [] : $categories;
		?>
		<div class="catalogue-image-studio-panel optivra-brand-presets-page">
			<div class="optivra-card-header">
				<h2><?php echo esc_html__('Brand Style Presets', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<p><?php echo esc_html__('Define reusable background, framing, shadow and output defaults so product categories keep a consistent catalogue style.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>

			<div class="optivra-brand-current-grid">
				<?php $this->render_summary_card(__('Default background', 'optivra-image-studio-for-woocommerce'), $this->get_background_presets()[$background] ?? $background); ?>
				<?php $this->render_summary_card(__('Source', 'optivra-image-studio-for-woocommerce'), 'custom' === $source ? __('Custom upload', 'optivra-image-studio-for-woocommerce') : __('Preset', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_summary_card(__('Custom background', 'optivra-image-studio-for-woocommerce'), ! empty($settings['custom_background_attachment_id']) ? __('Configured', 'optivra-image-studio-for-woocommerce') : __('Not configured', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_summary_card(__('Active style preset', 'optivra-image-studio-for-woocommerce'), (string) ($brand_presets[$active_preset]['name'] ?? __('Optivra light studio', 'optivra-image-studio-for-woocommerce'))); ?>
			</div>

			<div class="optivra-brand-preset-grid">
				<?php foreach ($brand_presets as $preset_key => $preset) : ?>
					<?php $warnings = $this->get_brand_background_warnings($preset); ?>
					<article class="optivra-brand-preset-card <?php echo $preset_key === $active_preset ? 'is-active' : ''; ?>">
						<div class="optivra-card-topline">
							<div>
								<h3><?php echo esc_html((string) ($preset['name'] ?? __('Untitled preset', 'optivra-image-studio-for-woocommerce'))); ?></h3>
								<p><?php echo esc_html($this->get_brand_apply_label($preset)); ?></p>
							</div>
							<?php $this->render_status_badge($preset_key === $active_preset ? __('Active', 'optivra-image-studio-for-woocommerce') : __('Ready', 'optivra-image-studio-for-woocommerce'), $preset_key === $active_preset ? 'approved' : 'ready'); ?>
						</div>
						<div class="optivra-style-preview <?php echo esc_attr('is-' . sanitize_html_class((string) ($preset['background_type'] ?? 'optivra-light'))); ?>">
							<?php echo $this->get_brand_preview_background_image($preset); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
							<div class="optivra-style-sample-product"></div>
						</div>
						<div class="optivra-brand-preset-meta">
							<span><?php echo esc_html($this->get_brand_background_types()[(string) ($preset['background_type'] ?? 'optivra-light')] ?? ''); ?></span>
							<span><?php echo esc_html($this->get_brand_aspect_ratios()[(string) ($preset['aspect_ratio'] ?? '1:1')] ?? ''); ?></span>
							<span><?php echo esc_html($this->get_brand_padding_modes()[(string) ($preset['product_padding'] ?? 'balanced')] ?? ''); ?></span>
							<span><?php echo esc_html($this->get_brand_shadow_modes()[(string) ($preset['shadow'] ?? 'subtle')] ?? ''); ?></span>
							<span><?php echo esc_html(strtoupper((string) ($preset['output_format'] ?? 'original'))); ?></span>
						</div>
						<?php if (! empty($warnings)) : ?>
							<div class="optivra-warning-list">
								<?php foreach ($warnings as $warning) : ?>
									<p><?php echo esc_html($warning); ?></p>
								<?php endforeach; ?>
							</div>
						<?php endif; ?>
						<form method="post" action="" class="optivra-brand-preset-actions">
							<?php settings_fields('catalogue_image_studio_settings_group'); ?>
							<?php wp_nonce_field('catalogue_image_studio_save_settings', 'catalogue_image_studio_settings_nonce'); ?>
							<input type="hidden" name="active_brand_style_preset" value="<?php echo esc_attr($preset_key); ?>" />
							<button type="submit" class="button button-primary"><?php echo esc_html__('Use as default', 'optivra-image-studio-for-woocommerce'); ?></button>
							<?php if (count($brand_presets) > 1) : ?>
								<button type="submit" name="remove_brand_style_preset" value="<?php echo esc_attr($preset_key); ?>" class="button"><?php echo esc_html__('Delete', 'optivra-image-studio-for-woocommerce'); ?></button>
							<?php endif; ?>
						</form>
					</article>
				<?php endforeach; ?>
			</div>

			<form method="post" action="" class="optivra-card optivra-brand-preset-form">
				<?php settings_fields('catalogue_image_studio_settings_group'); ?>
				<?php wp_nonce_field('catalogue_image_studio_save_settings', 'catalogue_image_studio_settings_nonce'); ?>
				<input type="hidden" name="save_brand_style_preset" value="1" />
				<input type="hidden" name="brand_custom_background_attachment_id" value="<?php echo esc_attr((string) (int) ($settings['custom_background_attachment_id'] ?? 0)); ?>" />
				<div class="optivra-card-header">
					<h3><?php echo esc_html__('Create or update a brand style preset', 'optivra-image-studio-for-woocommerce'); ?></h3>
					<p><?php echo esc_html__('Category-specific assignment is saved now and will be used as queue/report integration expands. Custom preset backgrounds use the uploaded background configured in Settings.', 'optivra-image-studio-for-woocommerce'); ?></p>
				</div>
				<div class="optivra-brand-form-grid">
					<?php $this->render_text_setting('brand_preset_name', __('Preset name', 'optivra-image-studio-for-woocommerce'), __('Example: Main catalogue, Apparel portraits, Marketplace-safe white.', 'optivra-image-studio-for-woocommerce'), ''); ?>
					<?php $this->render_select_setting('brand_background_type', __('Background type', 'optivra-image-studio-for-woocommerce'), __('Choose a clean feed-safe background or a constrained custom uploaded image.', 'optivra-image-studio-for-woocommerce'), $this->get_brand_background_types(), 'optivra-light'); ?>
					<?php $this->render_select_setting('brand_aspect_ratio', __('Preferred aspect ratio', 'optivra-image-studio-for-woocommerce'), __('Used for future queue recommendations and category style consistency checks.', 'optivra-image-studio-for-woocommerce'), $this->get_brand_aspect_ratios(), '1:1'); ?>
					<?php $this->render_select_setting('brand_product_padding', __('Product padding', 'optivra-image-studio-for-woocommerce'), __('How tightly products should fill the canvas.', 'optivra-image-studio-for-woocommerce'), $this->get_brand_padding_modes(), 'balanced'); ?>
					<?php $this->render_select_setting('brand_shadow', __('Shadow', 'optivra-image-studio-for-woocommerce'), __('Subtle contact shadows are usually safest for ecommerce catalogues.', 'optivra-image-studio-for-woocommerce'), $this->get_brand_shadow_modes(), 'subtle'); ?>
					<?php $this->render_select_setting('brand_output_format', __('Output format', 'optivra-image-studio-for-woocommerce'), __('WebP is listed when supported by your hosting/media workflow.', 'optivra-image-studio-for-woocommerce'), $this->get_brand_output_formats(), 'original'); ?>
					<?php $this->render_select_setting('brand_apply_scope', __('Apply to', 'optivra-image-studio-for-woocommerce'), __('Use one style for the whole catalogue or assign it to selected categories.', 'optivra-image-studio-for-woocommerce'), $this->get_brand_apply_scopes(), 'all'); ?>
					<div class="optivra-setting-row">
						<div><strong class="optivra-setting-label"><?php echo esc_html__('Selected categories', 'optivra-image-studio-for-woocommerce'); ?></strong><p class="optivra-setting-description"><?php echo esc_html__('Optional. Hold Ctrl/Cmd to select multiple categories.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
						<div class="optivra-setting-control">
							<select name="brand_category_ids[]" multiple size="5" class="optivra-category-multiselect">
								<?php foreach ($categories as $category) : ?>
									<option value="<?php echo esc_attr((string) $category->term_id); ?>"><?php echo esc_html($category->name); ?></option>
								<?php endforeach; ?>
							</select>
						</div>
					</div>
				</div>
				<div class="optivra-info-callout">
					<strong><?php echo esc_html__('Background contrast warning', 'optivra-image-studio-for-woocommerce'); ?></strong>
					<p><?php echo esc_html__('Custom, dark, textured or transparent backgrounds may reduce product contrast for some products and may not be suitable for product-feed style images. Optivra will warn conservatively until full visual analysis is available.', 'optivra-image-studio-for-woocommerce'); ?></p>
				</div>
				<div class="optivra-save-bar"><button type="submit" class="button button-primary"><?php echo esc_html__('Save Brand Style Preset', 'optivra-image-studio-for-woocommerce'); ?></button><a class="button" href="<?php echo esc_url($this->get_admin_page_url('settings')); ?>"><?php echo esc_html__('Edit processing defaults', 'optivra-image-studio-for-woocommerce'); ?></a></div>
			</form>
		</div>
		<?php
	}

	private function get_brand_apply_label(array $preset): string {
		if ('categories' !== (string) ($preset['apply_scope'] ?? 'all')) {
			return __('Applies to all products', 'optivra-image-studio-for-woocommerce');
		}

		$category_ids = isset($preset['category_ids']) && is_array($preset['category_ids']) ? array_map('absint', $preset['category_ids']) : [];
		if (empty($category_ids)) {
			return __('Selected categories pending', 'optivra-image-studio-for-woocommerce');
		}

		$names = [];
		foreach ($category_ids as $category_id) {
			$term = get_term($category_id, 'product_cat');
			if ($term && ! is_wp_error($term)) {
				$names[] = $term->name;
			}
		}

		return ! empty($names)
			? sprintf(
				/* translators: %s: comma-separated category names. */
				__('Applies to %s', 'optivra-image-studio-for-woocommerce'),
				implode(', ', array_slice($names, 0, 3))
			)
			: __('Selected categories', 'optivra-image-studio-for-woocommerce');
	}

	private function get_brand_background_warnings(array $preset): array {
		$type = (string) ($preset['background_type'] ?? 'optivra-light');
		$warnings = [];

		if ('custom' === $type) {
			$warnings[] = __('This background may reduce product contrast for some products.', 'optivra-image-studio-for-woocommerce');
			$warnings[] = __('Custom backgrounds should be checked for busy texture, dark areas, text, logos or product-feed suitability before bulk use.', 'optivra-image-studio-for-woocommerce');
		}

		if ('transparent' === $type) {
			$warnings[] = __('Transparent outputs can be useful for design workflows but may not be suitable for every product-feed image slot.', 'optivra-image-studio-for-woocommerce');
		}

		if ('soft-grey' === $type) {
			$warnings[] = __('Soft grey is usually safe, but dark products should still be reviewed for edge contrast.', 'optivra-image-studio-for-woocommerce');
		}

		return $warnings;
	}

	private function get_brand_preview_background_image(array $preset): string {
		if ('custom' !== (string) ($preset['background_type'] ?? '') || empty($preset['custom_background_attachment_id'])) {
			return '';
		}

		$url = wp_get_attachment_image_url((int) $preset['custom_background_attachment_id'], 'medium');
		if (! $url) {
			return '';
		}

		return '<img class="optivra-style-background-thumb" src="' . esc_url($url) . '" alt="" />';
	}

	private function render_seo_tools_tab(array $settings): void {
		$cache = get_option('optivra_report_summary_cache', []);
		$cache = is_array($cache) ? $cache : [];
		$latest = isset($cache['latest']) && is_array($cache['latest']) ? $cache['latest'] : [];
		$report = $this->get_report_payload($latest);
		$metrics = $this->get_report_metrics($report);
		$scan_url = $this->get_admin_page_url('scan');
		$missing_alt = (int) $this->report_number($metrics, ['missing_alt_text_count'], -1);
		$generic_filenames = (int) $this->report_number($metrics, ['generic_filename_count'], -1);
		$seo_ready = (int) $this->report_number($metrics, ['seo_ready_images_count'], -1);
		?>
		<div class="catalogue-image-studio-panel optivra-seo-dashboard">
			<div class="optivra-card-header">
				<h2><?php echo esc_html__('SEO Tools', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<p><?php echo esc_html__('Manage product-image metadata automation and use your latest scan to find the highest-value SEO cleanup opportunities.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>
			<div class="optivra-summary-grid optivra-seo-metrics">
				<?php $this->render_summary_card(__('Alt text generation', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_alt_text']) ? __('Enabled', 'optivra-image-studio-for-woocommerce') : __('Disabled', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_summary_card(__('Title generation', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_image_title']) ? __('Enabled', 'optivra-image-studio-for-woocommerce') : __('Disabled', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_summary_card(__('SEO filenames', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_seo_filename']) ? __('Enabled', 'optivra-image-studio-for-woocommerce') : __('Disabled', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_summary_card(__('Images missing alt text', 'optivra-image-studio-for-woocommerce'), $missing_alt >= 0 ? (string) $missing_alt : __('Run scan', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_summary_card(__('Generic filenames', 'optivra-image-studio-for-woocommerce'), $generic_filenames >= 0 ? (string) $generic_filenames : __('Run scan', 'optivra-image-studio-for-woocommerce')); ?>
				<?php $this->render_summary_card(__('SEO-ready images', 'optivra-image-studio-for-woocommerce'), $seo_ready >= 0 ? (string) $seo_ready : __('Run scan', 'optivra-image-studio-for-woocommerce')); ?>
			</div>

			<div class="optivra-card-grid optivra-seo-section-grid">
				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Metadata Automation', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Current generation behaviour for product image metadata.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<div class="optivra-mini-status-list">
						<?php $this->render_setting_status_row(__('Generate alt text', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_alt_text'])); ?>
						<?php $this->render_setting_status_row(__('Generate image titles', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_image_title'])); ?>
						<?php $this->render_setting_status_row(__('Generate captions', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_caption'])); ?>
						<?php $this->render_setting_status_row(__('Generate SEO filenames', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_seo_filename'])); ?>
						<?php $this->render_setting_status_row(__('Generate descriptions', 'optivra-image-studio-for-woocommerce'), ! empty($settings['generate_description'])); ?>
					</div>
				</section>
				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('SEO Templates', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Default rules used when Optivra suggests metadata.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<div class="optivra-template-list">
						<div><span><?php echo esc_html__('Filename format', 'optivra-image-studio-for-woocommerce'); ?></span><strong><?php echo esc_html__('product-name-category', 'optivra-image-studio-for-woocommerce'); ?></strong></div>
						<div><span><?php echo esc_html__('Alt text format', 'optivra-image-studio-for-woocommerce'); ?></span><strong><?php echo esc_html__('Useful product description from product context', 'optivra-image-studio-for-woocommerce'); ?></strong></div>
						<div><span><?php echo esc_html__('Title format', 'optivra-image-studio-for-woocommerce'); ?></span><strong><?php echo esc_html__('Readable ecommerce media title', 'optivra-image-studio-for-woocommerce'); ?></strong></div>
					</div>
				</section>
				<section class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Quick Actions', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Jump to the next useful SEO workflow.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<div class="optivra-action-grid">
						<a class="button button-primary" href="<?php echo esc_url($this->get_admin_page_url('settings')); ?>"><?php echo esc_html__('Edit SEO Settings', 'optivra-image-studio-for-woocommerce'); ?></a>
						<a class="button" href="<?php echo esc_url($scan_url); ?>"><?php echo esc_html__('Run Product Image Scan', 'optivra-image-studio-for-woocommerce'); ?></a>
						<a class="button" href="<?php echo esc_url($this->get_admin_page_url('health')); ?>"><?php echo esc_html__('View Health Report', 'optivra-image-studio-for-woocommerce'); ?></a>
						<a class="button" href="<?php echo esc_url($this->get_admin_page_url('recommendations')); ?>"><?php echo esc_html__('Generate Missing Alt Text', 'optivra-image-studio-for-woocommerce'); ?></a>
					</div>
				</section>
			</div>
			<div class="optivra-info-callout">
				<strong><?php echo esc_html__('Review-friendly metadata', 'optivra-image-studio-for-woocommerce'); ?></strong>
				<p><?php echo esc_html__('Optivra uses product name, category and image context to generate useful ecommerce metadata. You can review changes before applying them.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>
		</div>
		<?php
	}

	private function render_setting_status_row(string $label, bool $enabled): void {
		?>
		<div class="optivra-setting-status-row">
			<span><?php echo esc_html($label); ?></span>
			<?php $this->render_status_badge($enabled ? __('Enabled', 'optivra-image-studio-for-woocommerce') : __('Disabled', 'optivra-image-studio-for-woocommerce'), $enabled ? 'ready' : 'needs-review'); ?>
		</div>
		<?php
	}

	private function render_account_billing_tab(array $settings, $usage): void {
		$connected = ! is_wp_error($usage);
		$credits_remaining = $connected && is_array($usage) ? (int) ($usage['credits_remaining'] ?? 0) : 0;
		$credits_total = $connected && is_array($usage) ? (int) ($usage['credits_total'] ?? 0) : 0;
		$credits_used = max(0, $credits_total - $credits_remaining);
		$domain = $connected && is_array($usage) ? (string) ($usage['domain'] ?? home_url()) : home_url();
		$is_dev_domain = false !== strpos($domain, '.local') || false !== strpos($domain, 'localhost') || false !== strpos($domain, '127.0.0.1') || false !== strpos($domain, 'staging');
		?>
		<div class="catalogue-image-studio-panel optivra-account-page">
			<div class="optivra-card-header">
				<h2><?php echo esc_html__('Account & Billing', 'optivra-image-studio-for-woocommerce'); ?></h2>
				<p><?php echo esc_html__('Check connection health, credits and account actions without exposing saved API tokens.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>
			<section class="optivra-card optivra-account-status-card">
				<div class="optivra-card-topline">
					<div>
						<h3><?php echo esc_html__('Connection status', 'optivra-image-studio-for-woocommerce'); ?></h3>
						<p><?php echo esc_html($connected ? __('This store is connected to Optivra.', 'optivra-image-studio-for-woocommerce') : __('Connect this store to view plan and credit details.', 'optivra-image-studio-for-woocommerce')); ?></p>
					</div>
					<?php $this->render_status_badge($connected ? __('Connected', 'optivra-image-studio-for-woocommerce') : __('Needs Review', 'optivra-image-studio-for-woocommerce'), $connected ? 'ready' : 'needs-review'); ?>
				</div>
				<div class="optivra-account-detail-grid">
					<div><span><?php echo esc_html__('Connected domain', 'optivra-image-studio-for-woocommerce'); ?></span><strong><?php echo esc_html($domain); ?></strong></div>
					<div><span><?php echo esc_html__('Environment', 'optivra-image-studio-for-woocommerce'); ?></span><strong><?php echo esc_html($is_dev_domain ? __('Development / staging', 'optivra-image-studio-for-woocommerce') : __('Production', 'optivra-image-studio-for-woocommerce')); ?></strong></div>
					<div><span><?php echo esc_html__('Token status', 'optivra-image-studio-for-woocommerce'); ?></span><strong><?php echo esc_html(! empty($settings['api_token']) ? __('Saved and masked', 'optivra-image-studio-for-woocommerce') : __('Not saved', 'optivra-image-studio-for-woocommerce')); ?></strong></div>
				</div>
			</section>
			<?php if ($connected && is_array($usage)) : ?>
				<div class="optivra-summary-grid optivra-account-metrics">
					<?php $this->render_summary_card(__('Current plan', 'optivra-image-studio-for-woocommerce'), ucfirst((string) ($usage['plan'] ?? __('Unknown', 'optivra-image-studio-for-woocommerce')))); ?>
					<?php $this->render_summary_card(__('Status', 'optivra-image-studio-for-woocommerce'), ucfirst((string) ($usage['subscription_status'] ?? __('Unknown', 'optivra-image-studio-for-woocommerce')))); ?>
					<?php $this->render_summary_card(__('Credits remaining', 'optivra-image-studio-for-woocommerce'), (string) $credits_remaining); ?>
					<?php $this->render_summary_card(__('Credits used', 'optivra-image-studio-for-woocommerce'), (string) $credits_used); ?>
					<?php $this->render_summary_card(__('Credit allowance', 'optivra-image-studio-for-woocommerce'), (string) $credits_total); ?>
					<?php $this->render_summary_card(__('Reset date', 'optivra-image-studio-for-woocommerce'), (string) ($usage['current_period_end'] ?? $usage['next_reset_at'] ?? __('Unavailable', 'optivra-image-studio-for-woocommerce'))); ?>
				</div>
				<div class="optivra-credit-panel">
					<div class="catalogue-image-studio-credit-meter" aria-label="<?php echo esc_attr__('Credits remaining', 'optivra-image-studio-for-woocommerce'); ?>">
						<div style="width: <?php echo esc_attr((string) ($credits_total > 0 ? min(100, max(0, round(($credits_remaining / $credits_total) * 100))) : 0)); ?>%;"></div>
					</div>
					<small><?php echo esc_html(sprintf(
						/* translators: 1: credits remaining, 2: total credits. */
						__('%1$d of %2$d credits remaining.', 'optivra-image-studio-for-woocommerce'),
						$credits_remaining,
						$credits_total
					)); ?></small>
				</div>
				<div class="optivra-account-actions">
					<a class="button button-primary" href="<?php echo esc_url($this->get_upgrade_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Upgrade plan', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_upgrade_url($usage)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Manage billing', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_account_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Manage account', 'optivra-image-studio-for-woocommerce'); ?></a>
					<a class="button" href="<?php echo esc_url($this->get_buy_credits_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Buy credits', 'optivra-image-studio-for-woocommerce'); ?></a>
				</div>
			<?php else : ?>
				<a class="button button-primary" href="<?php echo esc_url($this->get_admin_page_url('settings')); ?>"><?php echo esc_html__('Connect Store', 'optivra-image-studio-for-woocommerce'); ?></a>
			<?php endif; ?>
			<div class="optivra-info-callout">
				<strong><?php echo esc_html__('Token privacy', 'optivra-image-studio-for-woocommerce'); ?></strong>
				<p><?php echo esc_html__('Saved API tokens are masked and never displayed directly.', 'optivra-image-studio-for-woocommerce'); ?></p>
			</div>
			<?php if ($is_dev_domain) : ?>
				<div class="optivra-info-callout optivra-warning-callout">
					<strong><?php echo esc_html__('Development store', 'optivra-image-studio-for-woocommerce'); ?></strong>
					<p><?php echo esc_html__('Development stores can connect for testing but may not receive free production credits.', 'optivra-image-studio-for-woocommerce'); ?></p>
				</div>
			<?php endif; ?>
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
					<h2><?php echo esc_html__('Account & Settings', 'optivra-image-studio-for-woocommerce'); ?></h2>
					<p><?php echo esc_html__('Everything important is grouped here. Basic users can stay on Account, Credits & Billing, Image Defaults, and Scan Preferences; Advanced is only for support.', 'optivra-image-studio-for-woocommerce'); ?></p>
				</div>
				<span class="optivra-status-pill <?php echo is_wp_error($usage) ? 'is-disconnected' : 'is-connected'; ?>"><?php echo is_wp_error($usage) ? esc_html__('Not connected', 'optivra-image-studio-for-woocommerce') : esc_html__('Connected', 'optivra-image-studio-for-woocommerce'); ?></span>
			</div>
			<div class="optivra-settings-tab-cards" aria-label="<?php echo esc_attr__('Account & Settings sections', 'optivra-image-studio-for-woocommerce'); ?>">
				<a href="#optivra-settings-account"><?php echo esc_html__('Account', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="#optivra-settings-billing"><?php echo esc_html__('Credits & Billing', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="#optivra-settings-image-defaults"><?php echo esc_html__('Image Defaults', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="#optivra-settings-scan-preferences"><?php echo esc_html__('Scan Preferences', 'optivra-image-studio-for-woocommerce'); ?></a>
				<a href="#optivra-settings-advanced"><?php echo esc_html__('Advanced', 'optivra-image-studio-for-woocommerce'); ?></a>
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

				<section id="optivra-settings-account" class="optivra-card">
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

				<section id="optivra-settings-billing" class="optivra-card optivra-settings-summary-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Credits & Billing', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Current credits, billing portal links, and usage summary.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_connection_status($usage, ! is_wp_error($usage)); ?>
					<div class="optivra-button-row">
						<a class="button button-primary" href="<?php echo esc_url($this->get_buy_credits_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Buy credits', 'optivra-image-studio-for-woocommerce'); ?></a>
						<a class="button" href="<?php echo esc_url($this->get_upgrade_url($usage, $settings)); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('Billing portal', 'optivra-image-studio-for-woocommerce'); ?></a>
					</div>
				</section>

				<section id="optivra-settings-image-defaults" class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Processing Defaults', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Choose the default scan, queue and publish behaviour for product images.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_toggle_setting('require_approval', __('Require review before replacing images', 'optivra-image-studio-for-woocommerce'), __('Processed images wait for approval before WooCommerce product images are replaced.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['require_approval'])); ?>
					<?php $this->render_toggle_setting('auto_process_new_images', __('Auto-process newly scanned images', 'optivra-image-studio-for-woocommerce'), __('Newly discovered images can be queued for processing automatically.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_process_new_images'])); ?>
					<?php $this->render_toggle_setting('process_featured_images', __('Include featured/product images', 'optivra-image-studio-for-woocommerce'), __('Scan and queue main product images by default.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['process_featured_images'])); ?>
					<?php $this->render_toggle_setting('process_gallery_images', __('Include gallery images', 'optivra-image-studio-for-woocommerce'), __('Scan and queue WooCommerce gallery images by default.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['process_gallery_images'])); ?>
					<?php $this->render_toggle_setting('process_category_images', __('Include category thumbnail images', 'optivra-image-studio-for-woocommerce'), __('Allow scans to include product category thumbnails when selected.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['process_category_images'])); ?>
					<?php $this->render_select_setting('processing_mode', __('Default processing mode', 'optivra-image-studio-for-woocommerce'), __('Preserve Product + Clean/Replace Background is recommended for main WooCommerce images. It cleans the existing background when using a neutral preset, or replaces it when you choose a custom/background preset.', 'optivra-image-studio-for-woocommerce'), $this->get_processing_modes(), (string) ($settings['processing_mode'] ?? 'seo_product_feed_preserve')); ?>
					<?php $this->render_toggle_setting('preserve_product_exactly', __('Strict product-pixel preservation', 'optivra-image-studio-for-woocommerce'), __('Optional stricter preserve-mode guard. When enabled, Optivra is more conservative about product pixels and may send more images to manual review instead of producing a result.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['preserve_product_exactly'])); ?>
					<?php $this->render_toggle_setting('auto_fail_product_altered', __('Auto-fail if product appears altered', 'optivra-image-studio-for-woocommerce'), __('Failed preservation checks stop the image before it can be applied.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_fail_product_altered'])); ?>
					<?php $this->render_toggle_setting('auto_fix_crop_spacing', __('Auto-fix crop and spacing', 'optivra-image-studio-for-woocommerce'), __('Optivra deterministically improves excessive whitespace after background replacement.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_fix_crop_spacing'])); ?>
					<?php $this->render_toggle_setting('preserve_dark_detail', __('Preserve dark product detail', 'optivra-image-studio-for-woocommerce'), __('Avoid crushed blacks and heavy contrast changes on dark product parts.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['preserve_dark_detail'])); ?>
					<?php $this->render_toggle_setting('duplicate_detection', __('Duplicate detection', 'optivra-image-studio-for-woocommerce'), __('Reuse previous processed results when the same source image is encountered.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['duplicate_detection'])); ?>
					<?php $this->render_toggle_setting('pause_on_low_credits', __('Pause processing when credits are low', 'optivra-image-studio-for-woocommerce'), __('Stop larger queue batches before credits are exhausted.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['pause_on_low_credits'])); ?>
					<?php $this->render_toggle_setting('retry_failed_jobs', __('Retry failed jobs automatically', 'optivra-image-studio-for-woocommerce'), __('Keep failed jobs ready for a quick retry pass.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['retry_failed_jobs'])); ?>
					<?php $this->render_toggle_setting('auto_refresh_job_status', __('Auto-refresh job status', 'optivra-image-studio-for-woocommerce'), __('Refresh queue status while jobs are active.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['auto_refresh_job_status'])); ?>
					<?php $this->render_number_setting('batch_size', __('Batch size', 'optivra-image-studio-for-woocommerce'), __('How many queued images to process at once.', 'optivra-image-studio-for-woocommerce'), (int) ($settings['batch_size'] ?? 10), 1, 50); ?>
				</section>

				<section id="optivra-settings-scan-preferences" class="optivra-card">
					<div class="optivra-card-header"><h3><?php echo esc_html__('Scan Defaults & Schedule', 'optivra-image-studio-for-woocommerce'); ?></h3><p><?php echo esc_html__('Schedule recurring Product Image Health scans. WooCommerce runs the scan via WP-Cron because the plugin has direct product and media access.', 'optivra-image-studio-for-woocommerce'); ?></p></div>
					<?php $this->render_select_setting('audit_default_scan_scope', __('Default scan scope', 'optivra-image-studio-for-woocommerce'), __('Full health scan is recommended for most stores.', 'optivra-image-studio-for-woocommerce'), ['full' => __('Full health scan', 'optivra-image-studio-for-woocommerce'), 'updated' => __('Updated products only', 'optivra-image-studio-for-woocommerce')], (string) ($settings['audit_default_scan_scope'] ?? 'full')); ?>
					<?php $this->render_toggle_setting('audit_auto_queue_recommendations', __('Auto queue recommendations', 'optivra-image-studio-for-woocommerce'), __('When enabled, Optivra can queue safe recommended actions after a report is complete.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['audit_auto_queue_recommendations'])); ?>
					<?php $this->render_text_setting('audit_ignored_categories_products', __('Ignored categories/products', 'optivra-image-studio-for-woocommerce'), __('Optional comma-separated category or product IDs to skip in future scans.', 'optivra-image-studio-for-woocommerce'), (string) ($settings['audit_ignored_categories_products'] ?? '')); ?>
					<?php $this->render_select_setting('audit_schedule_frequency', __('Scheduled scan frequency', 'optivra-image-studio-for-woocommerce'), __('Off disables recurring scans. Weekly or monthly scans run from this WordPress site when WP-Cron is available.', 'optivra-image-studio-for-woocommerce'), $this->get_schedule_frequencies(), (string) ($settings['audit_schedule_frequency'] ?? 'off')); ?>
					<?php $this->render_select_setting('audit_schedule_scan_mode', __('Scheduled scan scope', 'optivra-image-studio-for-woocommerce'), __('Choose whether recurring scans look only at products updated since the previous scan or the full catalogue.', 'optivra-image-studio-for-woocommerce'), $this->get_schedule_scan_modes(), (string) ($settings['audit_schedule_scan_mode'] ?? 'updated')); ?>
					<?php $this->render_toggle_setting('audit_schedule_email_report', __('Email report on completion', 'optivra-image-studio-for-woocommerce'), __('Email delivery is prepared as a stub. Reports are stored locally and in the Optivra portal when the scan completes.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['audit_schedule_email_report'])); ?>
					<?php $this->render_toggle_setting('audit_monthly_report_enabled', __('Prepare monthly report summary', 'optivra-image-studio-for-woocommerce'), __('Track previous score, current score, issues found, estimated time saved and remaining opportunities.', 'optivra-image-studio-for-woocommerce'), ! empty($settings['audit_monthly_report_enabled'])); ?>
					<div class="optivra-info-callout">
						<strong><?php echo esc_html__('Next scheduled run', 'optivra-image-studio-for-woocommerce'); ?></strong>
						<p><?php echo esc_html(! empty($settings['audit_schedule_next_run_at']) ? (string) $settings['audit_schedule_next_run_at'] : __('Not scheduled yet. Save settings to calculate the next run.', 'optivra-image-studio-for-woocommerce')); ?></p>
					</div>
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
		<div class="optivra-queue-list">
			<?php if (empty($jobs)) : ?>
				<?php $this->render_empty_state(__('No jobs in the queue', 'optivra-image-studio-for-woocommerce'), $empty_message, __('Run Product Scan', 'optivra-image-studio-for-woocommerce'), $this->get_admin_page_url('scan')); ?>
			<?php else : ?>
				<?php foreach ($jobs as $job) : ?>
					<?php $this->render_job_row($job, $selectable); ?>
				<?php endforeach; ?>
			<?php endif; ?>
		</div>
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
			'settings'        => __('Account & Settings', 'optivra-image-studio-for-woocommerce'),
			'account'         => __('Credits & Billing', 'optivra-image-studio-for-woocommerce'),
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
		<details id="optivra-settings-advanced" class="catalogue-image-studio-advanced optivra-card">
			<summary><?php echo esc_html__('Advanced', 'optivra-image-studio-for-woocommerce'); ?></summary>
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
			$message = is_wp_error($usage) ? $usage->get_error_message() : '';
			?>
			<div class="catalogue-image-studio-status-card catalogue-image-studio-status-card-disconnected">
				<strong><?php echo esc_html__('Not connected', 'optivra-image-studio-for-woocommerce'); ?></strong>
				<p><?php echo esc_html('' !== $message ? $message : __('Connect your Optivra account to view credits and process images.', 'optivra-image-studio-for-woocommerce')); ?></p>
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
			$message = $usage->get_error_message();
			?>
			<div class="catalogue-image-studio-status-card catalogue-image-studio-status-card-disconnected">
				<strong><?php echo esc_html__('Not connected', 'optivra-image-studio-for-woocommerce'); ?></strong>
				<p><?php echo esc_html('' !== $message ? $message : __('Connect your Optivra account to view credits and process images.', 'optivra-image-studio-for-woocommerce')); ?></p>
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
				<?php if ($connected) : ?>
					<?php $this->render_queue_toolbar(['process', 'approve', 'reject', 'revert']); ?>
					<?php $this->render_jobs_table($jobs, true); ?>
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

	private function get_brand_background_types(): array {
		return [
			'optivra-light' => __('Default Optivra light', 'optivra-image-studio-for-woocommerce'),
			'white'         => __('White', 'optivra-image-studio-for-woocommerce'),
			'soft-grey'     => __('Soft grey', 'optivra-image-studio-for-woocommerce'),
			'custom'        => __('Custom uploaded image', 'optivra-image-studio-for-woocommerce'),
			'transparent'   => __('Transparent', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_brand_aspect_ratios(): array {
		return [
			'1:1'      => __('Square 1:1', 'optivra-image-studio-for-woocommerce'),
			'4:5'      => __('Portrait 4:5', 'optivra-image-studio-for-woocommerce'),
			'3:4'      => __('Portrait 3:4', 'optivra-image-studio-for-woocommerce'),
			'original' => __('Original', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_brand_padding_modes(): array {
		return [
			'tight'    => __('Tight', 'optivra-image-studio-for-woocommerce'),
			'balanced' => __('Balanced', 'optivra-image-studio-for-woocommerce'),
			'generous' => __('Generous', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_brand_shadow_modes(): array {
		return [
			'none'   => __('None', 'optivra-image-studio-for-woocommerce'),
			'subtle' => __('Subtle', 'optivra-image-studio-for-woocommerce'),
			'medium' => __('Medium', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_brand_output_formats(): array {
		return [
			'original' => __('Original', 'optivra-image-studio-for-woocommerce'),
			'jpg'      => __('JPG', 'optivra-image-studio-for-woocommerce'),
			'png'      => __('PNG', 'optivra-image-studio-for-woocommerce'),
			'webp'     => __('WebP', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_brand_apply_scopes(): array {
		return [
			'all'        => __('All products', 'optivra-image-studio-for-woocommerce'),
			'categories' => __('Selected categories', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_schedule_frequencies(): array {
		return [
			'off'     => __('Off', 'optivra-image-studio-for-woocommerce'),
			'weekly'  => __('Weekly', 'optivra-image-studio-for-woocommerce'),
			'monthly' => __('Monthly', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_schedule_scan_modes(): array {
		return [
			'updated' => __('Scan new/updated products only', 'optivra-image-studio-for-woocommerce'),
			'full'    => __('Full catalogue scan', 'optivra-image-studio-for-woocommerce'),
		];
	}

	private function get_default_brand_style_presets(): array {
		return [
			'optivra-light' => [
				'name'                            => __('Optivra light studio', 'optivra-image-studio-for-woocommerce'),
				'background_type'                 => 'optivra-light',
				'custom_background_attachment_id' => 0,
				'aspect_ratio'                    => '1:1',
				'product_padding'                 => 'balanced',
				'shadow'                          => 'subtle',
				'output_format'                   => 'original',
				'apply_scope'                     => 'all',
				'category_ids'                    => [],
			],
		];
	}

	private function sanitize_brand_style_presets($presets): array {
		$presets = is_array($presets) ? $presets : [];
		$clean = [];
		foreach ($presets as $key => $preset) {
			$key = sanitize_key((string) $key);
			if ('' === $key || ! is_array($preset)) {
				continue;
			}
			$clean[$key] = $this->sanitize_brand_style_preset($preset);
		}

		return ! empty($clean) ? $clean : $this->get_default_brand_style_presets();
	}

	private function sanitize_brand_style_preset(array $preset): array {
		$category_ids = $preset['category_ids'] ?? [];
		$category_ids = is_array($category_ids) ? array_values(array_filter(array_map('absint', $category_ids))) : [];

		return [
			'name'                            => sanitize_text_field((string) ($preset['name'] ?? __('Untitled preset', 'optivra-image-studio-for-woocommerce'))),
			'background_type'                 => $this->sanitize_key_choice((string) ($preset['background_type'] ?? 'optivra-light'), $this->get_brand_background_types(), 'optivra-light'),
			'custom_background_attachment_id' => absint($preset['custom_background_attachment_id'] ?? 0),
			'aspect_ratio'                    => $this->sanitize_key_choice((string) ($preset['aspect_ratio'] ?? '1:1'), $this->get_brand_aspect_ratios(), '1:1'),
			'product_padding'                 => $this->sanitize_key_choice((string) ($preset['product_padding'] ?? 'balanced'), $this->get_brand_padding_modes(), 'balanced'),
			'shadow'                          => $this->sanitize_key_choice((string) ($preset['shadow'] ?? 'subtle'), $this->get_brand_shadow_modes(), 'subtle'),
			'output_format'                   => $this->sanitize_key_choice((string) ($preset['output_format'] ?? 'original'), $this->get_brand_output_formats(), 'original'),
			'apply_scope'                     => $this->sanitize_key_choice((string) ($preset['apply_scope'] ?? 'all'), $this->get_brand_apply_scopes(), 'all'),
			'category_ids'                    => $category_ids,
		];
	}

	private function sanitize_key_choice(string $value, array $choices, string $fallback): string {
		$value = sanitize_key($value);
		return array_key_exists($value, $choices) ? $value : $fallback;
	}

	private function sanitize_schedule_frequency($frequency): string {
		return $this->sanitize_key_choice((string) $frequency, $this->get_schedule_frequencies(), 'off');
	}

	private function sanitize_schedule_scan_mode($mode): string {
		return $this->sanitize_key_choice((string) $mode, $this->get_schedule_scan_modes(), 'updated');
	}

	private function get_processing_modes(): array {
		return [
			'seo_product_feed_preserve' => __('Preserve Product + Clean/Replace Background', 'optivra-image-studio-for-woocommerce'),
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
		$is_audit_job = 'audit_report' === (string) ($job['audit_source'] ?? '');
		$preserve_product_exactly = ! empty($settings['preserve_product_exactly']);
		$processing_mode = (string) ($settings['processing_mode'] ?? 'seo_product_feed_preserve');
		$custom_background_attachment_id = absint($settings['custom_background_attachment_id'] ?? 0);
		$uses_custom_background = 'custom' === $background_source;
		$strict_preserve_guard = $preserve_product_exactly && ! $is_audit_job && ! empty($settings['auto_fail_product_altered']);

		if ($is_audit_job && ! $uses_custom_background && ! empty($job['audit_background_preset'])) {
			$background_preset = $this->sanitize_background_preset((string) $job['audit_background_preset']);
			$background_source = 'preset';
		}

		if (! $strict_preserve_guard && 'seo_product_feed_preserve' === $processing_mode) {
			$processing_mode = 'standard_ecommerce_cleanup';
		}

		$options = [];
		$custom_background_url = '';
		if ('custom' === $background_source) {
			$custom_background_url = (string) wp_get_attachment_url($custom_background_attachment_id);
			if ($custom_background_url) {
				$options['background_image_url'] = $custom_background_url;
				$options['background_attachment_id'] = $custom_background_attachment_id;
			}
		}

		if (! $uses_custom_background && empty($options['background_image_url'])) {
			$options['background'] = $this->resolve_background_value($background_preset);
		}

		$scale_percent = $this->map_scale_mode_to_percent($scale_mode);
		if ('auto' !== $scale_percent) {
			$options['scale_percent'] = (int) $scale_percent;
		}

		$shadow_mode = (string) ($settings['shadow_mode'] ?? 'under');
		$shadow_strength = (string) ($settings['shadow_strength'] ?? 'medium');
		if ($is_audit_job) {
			$shadow_mode = 'under';
			$shadow_strength = 'light';
		}

		$options['settings'] = [
			'preserveProductExactly' => $strict_preserve_guard,
			'preserveProductIntent' => $preserve_product_exactly,
			'preserveFallbackFromStrictMode' => $preserve_product_exactly && ! $strict_preserve_guard,
			'processingMode' => $processing_mode,
			'promptVersion' => 'ecommerce_preserve_v2',
			'autoFailIfProductAltered' => $strict_preserve_guard,
			'autoFixCropSpacing' => ! empty($settings['auto_fix_crop_spacing']),
			'preserveDarkDetail' => $strict_preserve_guard && ! empty($settings['preserve_dark_detail']),
			'requireReviewBeforeReplace' => true,
			'auditReportSource' => $is_audit_job,
			'auditActionType' => (string) ($job['audit_action_type'] ?? ''),
			'maxRetries' => (int) ($settings['max_retries'] ?? 2),
			'output' => [
				'size' => (int) ($settings['output_size'] ?? 1024),
				'aspectRatio' => (string) ($settings['output_aspect_ratio'] ?? '1:1'),
			],
			'background' => [
				'source'              => $background_source,
				'preset'              => $background_preset,
				'customBackgroundUrl' => $custom_background_url ?: null,
				'customBackgroundId'  => $custom_background_attachment_id ?: null,
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
				'mode'     => $shadow_mode,
				'strength' => $shadow_strength,
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

		$api_base_url = (string) ($settings['api_base_url'] ?? 'https://www.optivra.app');
		if (class_exists('Catalogue_Image_Studio_SaaSClient')) {
			$api_base_url = Catalogue_Image_Studio_SaaSClient::normalize_api_base_url($api_base_url);
		}

		return untrailingslashit($api_base_url ?: 'https://www.optivra.app');
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
		$image_role       = (string) ($job['image_role'] ?? '');
		$slot_label       = $this->get_image_role_label($image_role);
		if ('gallery' === $image_role) {
			$slot_label .= ' #' . ((int) ($job['gallery_index'] ?? 0) + 1);
		}
		$display_error = $this->format_job_error((string) ($job['error_message'] ?? ''));
		$status = (string) ($job['status'] ?? '');
		$mode = (string) ($job['processing_mode'] ?? $job['audit_action_type'] ?? '');
		if ('audit_report' === (string) ($job['audit_source'] ?? '')) {
			$mode .= ' audit';
		}
		?>
		<article id="optivra-job-<?php echo esc_attr((string) (int) ($job['id'] ?? 0)); ?>" class="optivra-queue-card" data-optivra-job-card data-status="<?php echo esc_attr(sanitize_key($status)); ?>" data-mode="<?php echo esc_attr(sanitize_key($mode)); ?>" data-product="<?php echo esc_attr(wp_strip_all_tags((string) $product_title)); ?>">
			<header class="optivra-queue-card-head">
				<div class="optivra-job-title-row">
					<?php if ($selectable) : ?>
						<label class="optivra-job-select">
							<input type="checkbox" class="catalogue-image-studio-job-check" name="job_ids[]" value="<?php echo esc_attr((string) (int) $job['id']); ?>" />
							<span class="screen-reader-text"><?php echo esc_html__('Select job', 'optivra-image-studio-for-woocommerce'); ?></span>
						</label>
					<?php endif; ?>
					<div class="optivra-job-title">
						<strong><?php echo esc_html($product_title); ?></strong>
						<div class="optivra-job-submeta">
							<a href="<?php echo esc_url(get_edit_post_link($product_id)); ?>"><?php echo esc_html__('Edit product', 'optivra-image-studio-for-woocommerce'); ?></a>
							<span><?php echo esc_html((string) ($job['updated_at'] ?? '')); ?></span>
						</div>
					</div>
				</div>
				<div class="optivra-job-badges">
					<span class="optivra-action-chip"><?php echo esc_html($slot_label); ?></span>
					<?php $this->render_status_badge($this->format_status($status), $this->map_job_status_to_badge($status)); ?>
				</div>
			</header>

			<div class="optivra-queue-card-grid">
				<section class="optivra-job-media-panel">
					<div class="optivra-thumb-card">
						<span><?php echo esc_html__('Original', 'optivra-image-studio-for-woocommerce'); ?></span>
						<?php $this->render_thumbnail($before_url, __('Before', 'optivra-image-studio-for-woocommerce')); ?>
					</div>
					<div class="optivra-thumb-card">
						<span><?php echo esc_html__('Processed', 'optivra-image-studio-for-woocommerce'); ?></span>
						<?php $this->render_after_thumbnail($processed_links, $job); ?>
					</div>
				</section>

				<section class="optivra-job-status-panel">
					<h3><?php echo esc_html__('Job summary', 'optivra-image-studio-for-woocommerce'); ?></h3>
					<?php $this->render_preservation_safety_badge($job); ?>
					<?php if ('audit_report' === (string) ($job['audit_source'] ?? '')) : ?>
						<div class="optivra-job-origin">
							<span class="optivra-action-chip"><?php echo esc_html__('From Health Report', 'optivra-image-studio-for-woocommerce'); ?></span>
							<?php if (! empty($job['audit_action_type'])) : ?>
								<small><?php echo esc_html($this->get_recommendation_action_label((string) $job['audit_action_type'])); ?></small>
							<?php endif; ?>
						</div>
					<?php endif; ?>
					<?php if (in_array($status, ['queued', 'processing', 'failed', 'completed', 'rejected'], true)) : ?>
						<?php $this->render_job_edge_controls($job); ?>
					<?php endif; ?>
					<?php $this->render_output_validation_summary($job); ?>
					<?php $this->render_job_diagnostics($job); ?>
				</section>

				<section class="optivra-job-seo-panel">
					<h3><?php echo esc_html__('SEO preview', 'optivra-image-studio-for-woocommerce'); ?></h3>
					<?php $this->render_seo_fields($job); ?>
				</section>

				<section class="optivra-job-message-panel">
					<h3><?php echo esc_html__('Progress / message', 'optivra-image-studio-for-woocommerce'); ?></h3>
					<?php if ('failed' === $status) : ?>
						<div class="optivra-failure-card">
							<strong><?php echo esc_html__('Failed', 'optivra-image-studio-for-woocommerce'); ?></strong>
							<p><?php echo esc_html('' !== $display_error ? $display_error : __('Processing failed. Reprocess this image or contact Optivra support.', 'optivra-image-studio-for-woocommerce')); ?></p>
							<p class="catalogue-image-studio-help"><?php echo esc_html__('Original image was not replaced.', 'optivra-image-studio-for-woocommerce'); ?></p>
						</div>
					<?php else : ?>
						<p><?php echo esc_html('' !== $display_error ? $display_error : (string) ($job['updated_at'] ?? __('Waiting for updates.', 'optivra-image-studio-for-woocommerce'))); ?></p>
					<?php endif; ?>
					<?php $this->render_version_actions($job, $processed_links); ?>
				</section>
			</div>
		</article>
		<?php
	}

	/**
	 * @param array<string,mixed> $job Job.
	 */
	private function render_preservation_safety_badge(array $job): void {
		$safety = catalogue_image_studio_get_preservation_safety($job);
		$class = sanitize_html_class($safety['status']);
		?>
		<span class="optivra-safety-badge <?php echo esc_attr($class); ?>"><?php echo esc_html(sprintf(__('Product Preservation: %s', 'optivra-image-studio-for-woocommerce'), $safety['label'])); ?></span>
		<?php if ('failed' === $safety['status']) : ?>
			<small class="catalogue-image-studio-warning"><?php echo esc_html__('This output cannot be applied because product preservation failed.', 'optivra-image-studio-for-woocommerce'); ?></small>
		<?php elseif ('needs_review' === $safety['status']) : ?>
			<small class="catalogue-image-studio-help"><?php echo esc_html__('Manual review is required before approval.', 'optivra-image-studio-for-woocommerce'); ?></small>
		<?php endif; ?>
		<?php
	}

	/**
	 * @param array<string,mixed>                             $job Job.
	 * @param array{preview:string,full:string,source:string} $processed_links Processed image links.
	 */
	private function render_version_actions(array $job, array $processed_links): void {
		$attachment_id = (int) ($job['attachment_id'] ?? 0);
		$original_id = (int) ($job['original_attachment_id'] ?? $attachment_id);
		$original_url = $original_id > 0 ? (string) wp_get_attachment_url($original_id) : '';
		$processed_url = (string) ($processed_links['full'] ?? '');
		$job_id = (int) ($job['id'] ?? 0);
		?>
		<div class="optivra-version-actions">
			<?php if ('' !== $original_url) : ?>
				<a href="<?php echo esc_url($original_url); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('View Original', 'optivra-image-studio-for-woocommerce'); ?></a>
			<?php endif; ?>
			<?php if ('' !== $processed_url) : ?>
				<a href="<?php echo esc_url($processed_url); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__('View Processed', 'optivra-image-studio-for-woocommerce'); ?></a>
			<?php endif; ?>
			<?php if ('' !== $original_url && '' !== $processed_url) : ?>
				<a href="#optivra-job-<?php echo esc_attr((string) $job_id); ?>"><?php echo esc_html__('Compare', 'optivra-image-studio-for-woocommerce'); ?></a>
			<?php endif; ?>
			<?php if (in_array((string) ($job['status'] ?? ''), ['approved', 'completed', 'rejected'], true) && $job_id > 0) : ?>
				<button type="submit" class="button button-small" name="catalogue_image_studio_action" value="revert" onclick="var card=this.closest('[data-optivra-job-card]'); var box=card ? card.querySelector('.catalogue-image-studio-job-check') : null; if (box) { box.checked = true; }"><?php echo esc_html__('Restore Original', 'optivra-image-studio-for-woocommerce'); ?></button>
			<?php endif; ?>
		</div>
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
			echo '<button type="submit" class="button button-small" name="catalogue_image_studio_action" value="retry" onclick="var card=this.closest(\'[data-optivra-job-card]\'); var box=card ? card.querySelector(\'.catalogue-image-studio-job-check\') : null; if (box) { box.checked = true; }">' . esc_html__('Reprocess', 'optivra-image-studio-for-woocommerce') . '</button>';
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
			<strong><?php echo esc_html__('Protected Product Region:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['protectedProduct'] ?? $status)); ?><br />
			<strong><?php echo esc_html__('Vision QA:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($checks['visionQa'] ?? __('Not reached', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Product preservation score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['productPreservation'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Edge cleanliness score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['edgeCleanliness'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Background residue score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['backgroundResidue'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Alpha mask confidence score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['alphaConfidence'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Dropout score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['dropoutScore'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Vision QA ecommerce score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['visionQaEcommerce'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
			<strong><?php echo esc_html__('Vision QA text/branding score:', 'optivra-image-studio-for-woocommerce'); ?></strong> <?php echo esc_html((string) ($scores['visionQaTextBranding'] ?? __('Not stored', 'optivra-image-studio-for-woocommerce'))); ?><br />
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
			<?php if (in_array((string) ($checks['protectedProduct'] ?? ''), ['Failed', 'Needs Review'], true)) : ?>
				<p class="catalogue-image-studio-warning"><?php echo esc_html__('Needs Review: protected product-region validation detected possible shape, label, pixel, or artifact drift. This image was not applied automatically.', 'optivra-image-studio-for-woocommerce'); ?></p>
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

	private function format_processing_mode(string $mode): string {
		$mode = sanitize_key($mode);

		$modes = $this->get_processing_modes();
		if (isset($modes[$mode])) {
			return (string) $modes[$mode];
		}

		return '' === $mode ? __('Not stored', 'optivra-image-studio-for-woocommerce') : ucwords(str_replace('_', ' ', $mode));
	}

	private function format_date(string $date): string {
		if ('' === trim($date)) {
			return __('Not stored', 'optivra-image-studio-for-woocommerce');
		}

		$timestamp = strtotime($date);

		return $timestamp ? wp_date(get_option('date_format') . ' ' . get_option('time_format'), $timestamp) : $date;
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

	private function map_safety_status_to_badge(string $status): string {
		switch (sanitize_key($status)) {
			case 'passed':
				return 'approved';
			case 'needs_review':
				return 'needs-review';
			case 'failed':
				return 'failed';
			case 'not_assessed':
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
