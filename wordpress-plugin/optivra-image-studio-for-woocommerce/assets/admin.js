(function() {
	'use strict';

	var config = window.optiimstAdmin || {};
	var i18n = config.i18n || {};

	function ready(fn) {
		if (document.readyState !== 'loading') {
			fn();
			return;
		}

		document.addEventListener('DOMContentLoaded', fn);
	}

	function updateSelectedCount() {
		var selected = document.querySelectorAll('.catalogue-image-studio-job-check:checked').length;
		document.querySelectorAll('[data-cis-selected-count], [data-optiimst-selected-count]').forEach(function(node) {
			node.textContent = String(selected);
		});
	}

	function filterQueue() {
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

	function post(action, payload) {
		var body = new URLSearchParams();
		body.set('action', action);
		body.set('nonce', config.nonce || '');
		Object.keys(payload || {}).forEach(function(key) {
			body.set(key, payload[key]);
		});

		return fetch(config.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		}).then(function(response) {
			return response.json();
		}).then(function(json) {
			if (!json || !json.success) {
				var message = json && json.data && json.data.message ? json.data.message : i18n.scanFailed;
				throw new Error(message || 'Request failed.');
			}
			return json.data || {};
		});
	}

	function checkedValues(form, name) {
		return Array.prototype.map.call(form.querySelectorAll('[name="' + name + '"]:checked'), function(input) {
			return input.value;
		});
	}

	function collectOptions(form) {
		var defaultImageTypes = ['main', 'gallery', 'variation', 'category'];
		var defaultChecks = ['seo', 'performance', 'consistency', 'feed_readiness', 'visual_quality', 'background_quality', 'lighting_contrast'];
		var imageTypes = checkedValues(form, 'image_types[]');
		var checks = checkedValues(form, 'checks[]');

		return {
			scan_scope: (form.querySelector('[name="scan_scope"]:checked') || {}).value || 'all',
			category_ids: checkedValues(form, 'category_ids[]'),
			image_types: imageTypes.length ? imageTypes : defaultImageTypes,
			checks: checks.length ? checks : defaultChecks,
			scan_limit: (form.querySelector('[name="scan_limit"]') || {}).value || '',
			background_analysis: !!(form.querySelector('[name="background_analysis"]') || {}).checked,
			seo_metadata_analysis: !!(form.querySelector('[name="seo_metadata_analysis"]') || {}).checked,
			performance_analysis: !!(form.querySelector('[name="performance_analysis"]') || {}).checked,
			lighting_contrast_analysis: !!(form.querySelector('[name="lighting_contrast_analysis"]') || {}).checked
		};
	}

	function setText(root, name, value) {
		var node = root.querySelector('[data-optivra-scan-' + name + ']');
		if (node) {
			node.textContent = String(value);
		}
	}

	function setProgress(root, progress) {
		var total = Math.max(0, parseInt(progress.total_products || 0, 10));
		var products = Math.max(0, parseInt(progress.products_scanned || 0, 10));
		var percent = total > 0 ? Math.min(100, Math.round((products / total) * 100)) : 0;
		var bar = root.querySelector('[data-optivra-scan-bar]');

		root.hidden = false;
		setText(root, 'status', progress.status_label || progress.status || '');
		setText(root, 'products', products + ' / ' + total);
		setText(root, 'images', progress.images_scanned || 0);
		setText(root, 'batch', progress.current_batch || 0);
		setText(root, 'started', progress.started_at || '');
		setText(root, 'message', progress.message || '');
		if (bar) {
			bar.style.width = percent + '%';
		}
	}

	function escapeHtml(value) {
		return String(value == null ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(new RegExp(String.fromCharCode(39), 'g'), '&#039;');
	}

	function escapeAttribute(value) {
		return escapeHtml(value).replace(/`/g, '&#096;');
	}

	function initScanResults() {
		var root = document.querySelector('[data-optivra-scan-results]');
		if (!root) {
			return;
		}

		function getDataNodeText(node) {
			if (!node) {
				return '';
			}
			if (node.content && typeof node.content.textContent === 'string' && node.content.textContent) {
				return node.content.textContent;
			}
			return node.textContent || node.getAttribute('data-products') || '';
		}

		var dataNode = root.querySelector('[data-optiimst-scan-products-json], [data-optivra-scan-products-json]');
		var products = [];
		try {
			products = dataNode ? JSON.parse(getDataNodeText(dataNode) || '[]') : [];
		} catch (error) {
			products = [];
		}
		if (!Array.isArray(products)) {
			products = [];
		}

		var initialParams = new URLSearchParams(window.location.search || '');
		var selectedIds = new Set();
		var ignoredIds = new Set();
		var state = {
			page: 1,
			pageSize: 25,
			filter: initialParams.get('optiimst_result_filter') || '',
			search: initialParams.get('optiimst_result_search') || '',
			sort: 'recommended'
		};
		var body = root.querySelector('[data-optivra-results-body]');
		var selectedCount = root.querySelector('[data-optivra-selected-count]');
		var selectedAcross = root.querySelector('[data-optivra-selected-across]');
		var showingNode = root.querySelector('[data-optivra-results-showing]');
		var pageNode = root.querySelector('[data-optivra-current-page]');
		var totalPagesNode = root.querySelector('[data-optivra-total-pages]');
		var totalCountNode = root.querySelector('[data-optivra-total-scanned]');
		var pageSizeNode = root.querySelector('[data-optivra-page-size]');
		var searchNode = root.querySelector('[data-optivra-results-search]');
		var sortNode = root.querySelector('[data-optivra-results-sort]');
		var emptyNode = root.querySelector('[data-optivra-results-empty]');
		var payloadContainer = root.querySelector('[data-optivra-selected-payloads]');
		var warningNode = root.querySelector('[data-optivra-selection-warning]');

		function normalizeText(value) {
			return String(value == null ? '' : value).toLowerCase();
		}

		function productId(product) {
			return String(product && product.id ? product.id : '');
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
				selectedAcross.textContent = (i18n.selectedAcross || '%d selected across all pages').replace('%d', String(count));
			}
		}

		function filteredProducts() {
			var query = normalizeText(state.search).trim();
			return products.filter(function(product) {
				var id = productId(product);
				var filters = Array.isArray(product.filters) ? product.filters : [];
				var matchesFilter = !state.filter || filters.indexOf(state.filter) !== -1;
				var matchesSearch = !query || normalizeText([
					product.productName,
					product.productId,
					product.categoryName
				].join(' ')).indexOf(query) !== -1;
				return id && !ignoredIds.has(id) && matchesFilter && matchesSearch;
			});
		}

		function sortedProducts(items) {
			var copy = items.slice();
			copy.sort(function(a, b) {
				if (state.sort === 'name') {
					return String(a.productName || '').localeCompare(String(b.productName || ''));
				}
				if (state.sort === 'worst') {
					return issueScore(a) - issueScore(b);
				}
				if (state.sort === 'newest') {
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
			var start;
			state.page = Math.min(Math.max(1, state.page), totalPages);
			start = (state.page - 1) * state.pageSize;
			return {
				totalPages: totalPages,
				start: start,
				end: Math.min(items.length, start + state.pageSize),
				items: items.slice(start, start + state.pageSize)
			};
		}

		function pillHtml(item) {
			return '<span class="optivra-rec-pill is-' + escapeAttribute(item.severity || 'info') + '">' + escapeHtml(item.label || i18n.issue || 'Issue') + '</span>';
		}

		function renderRow(product) {
			var id = productId(product);
			var checked = selectedIds.has(id) ? ' checked' : '';
			var disabled = isQueueable(product) ? '' : ' disabled';
			var image = product.thumbnailUrl || product.imageUrl || '';
			var issues = Array.isArray(product.issues) && product.issues.length ? product.issues.slice(0, 3).map(pillHtml).join('') : '<span class="optivra-rec-pill is-good">' + escapeHtml(i18n.healthy || 'Healthy') + '</span>';
			var recs = Array.isArray(product.recommendations) && product.recommendations.length
				? product.recommendations.slice(0, 3).map(pillHtml).join('')
				: '<span class="optivra-rec-pill is-info">' + escapeHtml(product.recommended ? (i18n.readyToOptimise || 'Ready to optimise') : (i18n.noActionNeeded || 'No action needed')) + '</span>';
			var productLink = product.productUrl ? '<a class="button" href="' + escapeAttribute(product.productUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(i18n.viewProduct || 'View product') + '</a>' : '';
			var imageLink = product.imageUrl ? '<a class="button" href="' + escapeAttribute(product.imageUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(i18n.previewImage || 'Preview image') + '</a>' : '';
			var thumb = image
				? '<img class="catalogue-image-studio-thumb" src="' + escapeAttribute(image) + '" alt="" loading="lazy" />'
				: '<span class="catalogue-image-studio-thumb optivra-thumb-placeholder">' + escapeHtml(i18n.noImage || 'No image') + '</span>';

			return '<tr data-optivra-product-row data-optivra-row-id="' + escapeAttribute(id) + '">' +
				'<th class="check-column"><input type="checkbox" data-optivra-scan-item value="' + escapeAttribute(id) + '"' + checked + disabled + ' /></th>' +
				'<td data-label="Image">' + thumb + '</td>' +
				'<td data-label="Product"><strong>' + escapeHtml(product.productName || i18n.productImage || 'Product image') + '</strong><br /><small>' + escapeHtml(i18n.productIdPrefix || 'ID') + ' ' + escapeHtml(product.productId || '') + ' - ' + escapeHtml(product.imageRoleLabel || product.imageRole || i18n.mainImage || 'Main image') + '</small></td>' +
				'<td data-label="Category">' + escapeHtml(product.categoryName || i18n.uncategorised || 'Uncategorised') + '</td>' +
				'<td data-label="Current image status"><span class="optivra-rec-pill is-' + escapeAttribute(product.recommended ? 'medium' : 'good') + '">' + escapeHtml(product.status || i18n.healthy || 'Healthy') + '</span><br /><small>' + escapeHtml(product.readiness || i18n.ready || 'Ready') + '</small></td>' +
				'<td data-label="Detected issues"><div class="optivra-mini-pill-list">' + issues + '</div></td>' +
				'<td data-label="Recommendation"><div class="optivra-mini-pill-list">' + recs + '</div></td>' +
				'<td data-label="Actions"><div class="optivra-row-actions">' + productLink + imageLink + '<button type="button" class="button" data-optivra-row-add ' + (isQueueable(product) ? '' : 'disabled') + '>' + escapeHtml(i18n.addToQueue || 'Add to queue') + '</button><button type="button" class="button" data-optivra-row-ignore>' + escapeHtml(i18n.ignore || 'Ignore') + '</button></div></td>' +
			'</tr>';
		}

		function render() {
			var filtered = sortedProducts(filteredProducts());
			var page = getVisiblePage(filtered);
			if (body) {
				body.innerHTML = page.items.map(renderRow).join('');
			}
			if (showingNode) {
				showingNode.textContent = filtered.length
					? (i18n.showingProducts || 'Showing %1$d-%2$d of %3$d scanned products').replace('%1$d', String(page.start + 1)).replace('%2$d', String(page.end)).replace('%3$d', String(filtered.length))
					: (products.length ? (i18n.noProductsMatch || 'No scanned products match this filter.') : (i18n.noProductsFound || 'No products found for this scan scope.'));
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
			Array.prototype.forEach.call(root.querySelectorAll('[data-optivra-page-action]'), function(button) {
				var action = button.getAttribute('data-optivra-page-action');
				button.disabled = (action === 'first' || action === 'previous') ? state.page <= 1 : state.page >= page.totalPages;
			});
			Array.prototype.forEach.call(root.querySelectorAll('[data-optivra-result-filter]'), function(pill) {
				pill.classList.toggle('is-active', !!state.filter && pill.getAttribute('data-optivra-result-filter') === state.filter);
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

		root.addEventListener('change', function(event) {
			if (event.target.matches('[data-optivra-scan-item]')) {
				if (event.target.checked) {
					selectedIds.add(event.target.value);
				} else {
					selectedIds.delete(event.target.value);
				}
				updateCount();
			}
			if (event.target.matches('[data-optivra-page-size]')) {
				state.pageSize = parseInt(event.target.value || '25', 10) || 25;
				state.page = 1;
				render();
			}
			if (event.target.matches('[data-optivra-results-sort]')) {
				state.sort = event.target.value || 'recommended';
				state.page = 1;
				render();
			}
		});

		root.addEventListener('input', function(event) {
			if (event.target.matches('[data-optivra-results-search]')) {
				state.search = event.target.value || '';
				state.page = 1;
				render();
			}
		});

		Array.prototype.forEach.call(root.querySelectorAll('[data-optivra-select-visible]'), function(button) {
			button.addEventListener('click', function() {
				selectProducts(getVisiblePage(sortedProducts(filteredProducts())).items);
			});
		});

		Array.prototype.forEach.call(root.querySelectorAll('[data-optivra-select-recommended]'), function(button) {
			button.addEventListener('click', function() {
				selectProducts(products.filter(function(product) { return product.recommended; }));
			});
		});

		Array.prototype.forEach.call(root.querySelectorAll('[data-optivra-clear-selection]'), function(button) {
			button.addEventListener('click', clearSelection);
		});

		Array.prototype.forEach.call(root.querySelectorAll('[data-optivra-optimise-recommended]'), function(button) {
			button.addEventListener('click', function() {
				var form;
				selectProducts(products.filter(function(product) { return product.recommended; }));
				form = button.closest('form');
				if (form && form.requestSubmit) {
					form.requestSubmit();
				} else if (form) {
					form.submit();
				}
			});
		});

		Array.prototype.forEach.call(root.querySelectorAll('[data-optivra-result-filter]'), function(button) {
			button.addEventListener('click', function() {
				state.filter = button.getAttribute('data-optivra-result-filter') || '';
				state.page = 1;
				render();
			});
		});

		Array.prototype.forEach.call(root.querySelectorAll('[data-optivra-page-action]'), function(button) {
			button.addEventListener('click', function() {
				var filtered = sortedProducts(filteredProducts());
				var totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
				var action = button.getAttribute('data-optivra-page-action');
				if (action === 'first') {
					setPage(1);
				}
				if (action === 'previous') {
					setPage(state.page - 1);
				}
				if (action === 'next') {
					setPage(state.page + 1);
				}
				if (action === 'last') {
					setPage(totalPages);
				}
			});
		});

		root.addEventListener('click', function(event) {
			var row;
			var id;
			var form;
			if (event.target.matches('[data-optivra-row-add]')) {
				row = event.target.closest('[data-optivra-product-row]');
				id = row ? row.getAttribute('data-optivra-row-id') : '';
				if (id) {
					selectedIds.clear();
					selectedIds.add(id);
				}
				form = event.target.closest('form');
				if (form && form.requestSubmit) {
					form.requestSubmit();
				} else if (form) {
					form.submit();
				}
			}
			if (event.target.matches('[data-optivra-row-ignore]')) {
				row = event.target.closest('[data-optivra-product-row]');
				id = row ? row.getAttribute('data-optivra-row-id') : '';
				if (id) {
					ignoredIds.add(id);
					selectedIds.delete(id);
					render();
				}
			}
		});

		var form = root.querySelector('form');
		if (form) {
			form.addEventListener('submit', function(event) {
				var byId = new Map(products.map(function(product) { return [productId(product), product]; }));
				var invalid = 0;
				if (payloadContainer) {
					payloadContainer.innerHTML = '';
				}
				selectedIds.forEach(function(id) {
					var product = byId.get(id);
					var itemInput;
					var payloadInput;
					if (!product || !isQueueable(product)) {
						invalid += 1;
						return;
					}
					if (!payloadContainer) {
						return;
					}
					itemInput = document.createElement('input');
					itemInput.type = 'hidden';
					itemInput.name = 'scan_items[]';
					itemInput.value = id;
					payloadContainer.appendChild(itemInput);
					payloadInput = document.createElement('input');
					payloadInput.type = 'hidden';
					payloadInput.name = 'scan_queue_payloads[' + id + ']';
					payloadInput.value = JSON.stringify(product.queuePayload || {});
					payloadContainer.appendChild(payloadInput);
				});
				if (warningNode) {
					warningNode.hidden = invalid <= 0;
					warningNode.textContent = invalid > 0 ? (i18n.skippedUnavailable || '%d selected item(s) are no longer available and will be skipped.').replace('%d', String(invalid)) : '';
				}
				if (!payloadContainer || !payloadContainer.querySelector('[name="scan_items[]"]')) {
					event.preventDefault();
					if (warningNode) {
						warningNode.hidden = false;
						warningNode.textContent = i18n.selectAtLeastOne || 'Select at least one valid scanned product to queue.';
					}
				}
			});
		}

		if (pageSizeNode) {
			state.pageSize = parseInt(pageSizeNode.value || '25', 10) || 25;
		}
		if (searchNode) {
			if (state.search) {
				searchNode.value = state.search;
			} else {
				state.search = searchNode.value || '';
			}
		}
		if (sortNode) {
			state.sort = sortNode.value || 'recommended';
		}
		render();
	}

	function initAuditScan() {
		var form = document.getElementById('optivra-audit-scan-form');
		var progress = document.getElementById('optivra-audit-scan-progress');
		var startButton = document.getElementById('optivra-audit-start');
		var categoryButton = document.getElementById('optivra-audit-category-start');
		var cancelButton = document.getElementById('optivra-audit-cancel');
		var cancelled = false;

		if (!form || !progress || !startButton || !config.ajaxUrl) {
			return;
		}

		function fail(error) {
			startButton.disabled = false;
			if (categoryButton) {
				categoryButton.disabled = false;
			}
			if (cancelButton) {
				cancelButton.disabled = false;
				cancelButton.hidden = true;
			}
			setProgress(progress, {
				status: 'failed',
				status_label: i18n.failedLabel || 'Failed',
				message: error.message || i18n.scanFailed
			});
		}

		function runBatch(scanId, options, offset, batchNumber) {
			if (cancelled) {
				return post('optiimst_image_audit_cancel', { scan_id: scanId }).then(function(data) {
					setProgress(progress, data.progress || { status_label: i18n.cancelled });
				});
			}

			return post('optiimst_image_audit_batch', {
				scan_id: scanId,
				options: JSON.stringify(options),
				offset: offset,
				batch: batchNumber
			}).then(function(data) {
				setProgress(progress, data.progress || {});
				if (data.done) {
					setProgress(progress, Object.assign({}, data.progress || {}, { status_label: i18n.completing }));
					return post('optiimst_image_audit_complete', { scan_id: scanId }).then(function(doneData) {
						setProgress(progress, doneData.progress || {});
						startButton.disabled = false;
						if (categoryButton) {
							categoryButton.disabled = false;
						}
						if (cancelButton) {
							cancelButton.hidden = true;
						}
						window.setTimeout(function() {
							window.location.replace(window.location.pathname + window.location.search + '#optivra-scan-results');
							window.location.reload();
						}, 900);
					});
				}
				return window.setTimeout(function() {
					runBatch(scanId, options, data.next_offset || (offset + 25), batchNumber + 1).catch(fail);
				}, 150);
			});
		}

		function startScan(event, overrideOptions) {
			var options;
			event.preventDefault();
			cancelled = false;
			startButton.disabled = true;
			if (categoryButton) {
				categoryButton.disabled = true;
			}
			if (cancelButton) {
				cancelButton.disabled = false;
				cancelButton.hidden = false;
			}
			options = Object.assign(collectOptions(form), overrideOptions || {});
			setProgress(progress, { status_label: i18n.starting, message: '' });
			post('optiimst_image_audit_start', { options: JSON.stringify(options) }).then(function(data) {
				setProgress(progress, data.progress || {});
				return runBatch(data.scan_id, options, 0, 1);
			}).catch(fail);
		}

		startButton.addEventListener('click', function(event) {
			startScan(event, { scan_scope: 'all', category_ids: [] });
		});

		if (categoryButton) {
			categoryButton.addEventListener('click', function(event) {
				var categoryIds = checkedValues(form, 'category_ids[]');
				var categoryRadio;
				if (!categoryIds.length) {
					event.preventDefault();
					setProgress(progress, {
						status: 'ready',
						status_label: i18n.chooseCategory || 'Choose a category',
						message: i18n.chooseCategoryMessage || 'Select at least one category under Advanced scan options, then run the category scan.'
					});
					return;
				}
				categoryRadio = form.querySelector('[name="scan_scope"][value="categories"]');
				if (categoryRadio) {
					categoryRadio.checked = true;
				}
				startScan(event, { scan_scope: 'categories', category_ids: categoryIds });
			});
		}

		if (cancelButton) {
			cancelButton.addEventListener('click', function(event) {
				event.preventDefault();
				cancelled = true;
				cancelButton.disabled = true;
			});
		}
	}

	function initSettingsControls() {
		var onlyFill = document.querySelector('input[name="only_fill_missing_metadata"]');
		var overwrite = document.querySelector('input[name="overwrite_existing_metadata"]');
		var backgroundSource = document.querySelector('select[name="background_source"]');
		var backgroundPreset = document.querySelector('select[name="background_preset"]');
		var button = document.getElementById('catalogue-image-studio-pick-background');
		var removeButton = document.getElementById('catalogue-image-studio-remove-background');
		var attachmentField = document.getElementById('catalogue-image-studio-custom-background-id');
		var preview = document.getElementById('catalogue-image-studio-custom-background-preview');
		var filename = document.getElementById('catalogue-image-studio-custom-background-filename');
		var frame;

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

		function syncBackgroundMode() {
			var presetRow;
			if (!backgroundSource || !backgroundPreset) {
				return;
			}
			presetRow = backgroundPreset.closest('.optivra-setting-row');
			if (presetRow) {
				presetRow.classList.toggle('optivra-background-preset-muted', backgroundSource.value === 'custom');
			}
			backgroundPreset.setAttribute('aria-disabled', backgroundSource.value === 'custom' ? 'true' : 'false');
		}

		function clearBackground(event) {
			if (event) {
				event.preventDefault();
			}
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
		}

		if (onlyFill) {
			onlyFill.addEventListener('change', function() { syncSeoMetadataToggles(onlyFill); });
		}
		if (overwrite) {
			overwrite.addEventListener('change', function() { syncSeoMetadataToggles(overwrite); });
		}
		if (backgroundSource) {
			backgroundSource.addEventListener('change', syncBackgroundMode);
			syncBackgroundMode();
		}
		if (removeButton) {
			removeButton.addEventListener('click', clearBackground);
		}
		if (!button || typeof wp === 'undefined' || !wp.media) {
			return;
		}
		button.addEventListener('click', function(event) {
			event.preventDefault();
			if (frame) {
				frame.open();
				return;
			}
			frame = wp.media({
				title: i18n.chooseBackground || 'Choose background image',
				button: { text: i18n.useBackground || 'Use background' },
				multiple: false,
				library: { type: 'image' }
			});
			frame.on('select', function() {
				var selection = frame.state().get('selection').first();
				var attachment;
				if (!selection) {
					return;
				}
				attachment = selection.toJSON();
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
	}

	function initActionHelpers() {
		document.addEventListener('change', function(event) {
			if (event.target.matches('.catalogue-image-studio-check-all')) {
				document.querySelectorAll('.catalogue-image-studio-job-check').forEach(function(box) {
					var card = box.closest('[data-optivra-job-card]');
					if (!card || !card.hidden) {
						box.checked = event.target.checked;
					}
				});
				updateSelectedCount();
				return;
			}
			if (event.target.matches('.catalogue-image-studio-job-check')) {
				updateSelectedCount();
				return;
			}
			if (event.target.matches('[data-optivra-queue-status], [data-optivra-queue-mode]')) {
				filterQueue();
			}
		});

		document.addEventListener('input', function(event) {
			if (event.target.matches('[data-optivra-queue-search]')) {
				filterQueue();
			}
		});

		document.addEventListener('click', function(event) {
			var card;
			var box;
			if (event.target.matches('[data-optiimst-copy-diagnostics]')) {
				event.preventDefault();
				if (navigator.clipboard && document.getElementById('catalogue-image-studio-diagnostics')) {
					navigator.clipboard.writeText(document.getElementById('catalogue-image-studio-diagnostics').textContent);
				}
			}
			if (event.target.matches('[data-optiimst-select-job-action]')) {
				card = event.target.closest('[data-optivra-job-card]');
				box = card ? card.querySelector('.catalogue-image-studio-job-check') : null;
				if (box) {
					box.checked = true;
					updateSelectedCount();
				}
			}
		});
	}

	ready(function() {
		initActionHelpers();
		initSettingsControls();
		initScanResults();
		initAuditScan();
		updateSelectedCount();
		if (config.autoRefreshQueue) {
			window.setTimeout(function() {
				window.location.reload();
			}, parseInt(config.refreshInterval || 15000, 10));
		}
	});
}());
