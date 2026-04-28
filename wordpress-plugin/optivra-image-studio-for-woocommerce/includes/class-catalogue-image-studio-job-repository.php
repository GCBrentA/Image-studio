<?php
/**
 * Persistence for reusable image processing jobs.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_Job_Repository {
	/**
	 * @return array<string,string>
	 */
	public function statuses(): array {
		return [
			'unprocessed' => 'unprocessed',
			'queued'      => 'queued',
			'processing'  => 'processing',
			'completed'   => 'completed',
			'approved'    => 'approved',
			'rejected'    => 'rejected',
			'failed'      => 'failed',
			'reverted'    => 'reverted',
		];
	}

	/**
	 * Create or refresh a job for one product image slot.
	 *
	 * @param array<string,mixed> $slot Product image slot.
	 * @return int
	 */
	public function upsert_from_slot(array $slot): int {
		global $wpdb;

		$table = catalogue_image_studio_table_name();
		$now   = current_time('mysql', true);
		$cache_key = 'slot_' . md5(wp_json_encode([(int) $slot['product_id'], sanitize_key((string) $slot['image_role']), (int) $slot['gallery_index']]));
		$cached    = wp_cache_get($cache_key, 'optivra_image_studio_jobs');

		if (false !== $cached) {
			$existing = is_array($cached) ? $cached : null;
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin queue table query, safely prepared and cached.
			$existing = $wpdb->get_row(
				$wpdb->prepare(
				'SELECT * FROM %i WHERE product_id = %d AND image_role = %s AND gallery_index = %d LIMIT 1',
				$table,
				(int) $slot['product_id'],
				(string) $slot['image_role'],
				(int) $slot['gallery_index']
				),
				ARRAY_A
			);
			wp_cache_set($cache_key, $existing ?: [], 'optivra_image_studio_jobs', 300);
		}

		$data = [
			'product_id'             => (int) $slot['product_id'],
			'attachment_id'          => (int) $slot['attachment_id'],
			'image_role'             => sanitize_key((string) $slot['image_role']),
			'gallery_index'          => (int) $slot['gallery_index'],
			'current_attachment_id'  => (int) $slot['attachment_id'],
			'original_file_path'     => (string) get_attached_file((int) $slot['attachment_id']),
			'updated_at'             => $now,
			'scanned_at'             => $now,
		];

		if ($existing) {
			if (empty($existing['original_attachment_id'])) {
				$data['original_attachment_id'] = (int) $slot['attachment_id'];
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin queue table update; cache invalidated immediately after.
			$wpdb->update($table, $data, ['id' => (int) $existing['id']]);
			$this->flush_cache();
			return (int) $existing['id'];
		}

		$data['original_attachment_id'] = (int) $slot['attachment_id'];
		$data['status']                 = 'unprocessed';
		$data['edge_to_edge_enabled']   = 0;
		$data['edge_to_edge_left']      = 0;
		$data['edge_to_edge_right']     = 0;
		$data['edge_to_edge_top']       = 0;
		$data['edge_to_edge_bottom']    = 0;
		$data['created_at']             = $now;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin queue table insert; cache invalidated immediately after.
		$wpdb->insert($table, $data);
		$this->flush_cache();

		return (int) $wpdb->insert_id;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find(int $job_id): ?array {
		global $wpdb;

		$table = catalogue_image_studio_table_name();
		$cache_key = 'job_' . absint($job_id);
		$cached    = wp_cache_get($cache_key, 'optivra_image_studio_jobs');

		if (false !== $cached) {
			return is_array($cached) ? $cached : null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Custom plugin queue table query, cached above.
		$job = $wpdb->get_row($wpdb->prepare('SELECT * FROM %i WHERE id = %d LIMIT 1', $table, $job_id), ARRAY_A);

		wp_cache_set($cache_key, $job ?: [], 'optivra_image_studio_jobs', 300);

		return $job ?: null;
	}

	/**
	 * Find an existing job for one reusable image slot.
	 *
	 * @param array<string,mixed> $slot Product image slot.
	 * @return array<string,mixed>|null
	 */
	public function find_by_slot(array $slot): ?array {
		global $wpdb;

		$table = catalogue_image_studio_table_name();
		$cache_key = 'slot_' . md5(wp_json_encode([(int) $slot['product_id'], sanitize_key((string) $slot['image_role']), (int) $slot['gallery_index']]));
		$cached    = wp_cache_get($cache_key, 'optivra_image_studio_jobs');

		if (false !== $cached) {
			return is_array($cached) ? $cached : null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin queue table query, safely prepared and cached.
		$job   = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE product_id = %d AND image_role = %s AND gallery_index = %d LIMIT 1',
				$table,
				(int) $slot['product_id'],
				sanitize_key((string) $slot['image_role']),
				(int) $slot['gallery_index']
			),
			ARRAY_A
		);
		wp_cache_set($cache_key, $job ?: [], 'optivra_image_studio_jobs', 300);

		return $job ?: null;
	}

	/**
	 * @param array<string,mixed> $data Data.
	 * @return void
	 */
	public function update(int $job_id, array $data): void {
		global $wpdb;

		$data['updated_at'] = current_time('mysql', true);
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom plugin queue table update; cache invalidated immediately after.
		$wpdb->update(catalogue_image_studio_table_name(), $data, ['id' => $job_id]);
		wp_cache_delete('job_' . absint($job_id), 'optivra_image_studio_jobs');
		$this->flush_cache();
	}

	/**
	 * Save per-job framing override controls.
	 *
	 * @param array<int,array<string,mixed>> $overrides Overrides keyed by job ID.
	 * @return void
	 */
	public function update_edge_overrides(array $overrides): void {
		foreach ($overrides as $job_id => $override) {
			if (! is_array($override)) {
				continue;
			}

			$this->update(
				absint($job_id),
				[
					'edge_to_edge_enabled' => ! empty($override['enabled']) ? 1 : 0,
					'edge_to_edge_left'    => ! empty($override['left']) ? 1 : 0,
					'edge_to_edge_right'   => ! empty($override['right']) ? 1 : 0,
					'edge_to_edge_top'     => ! empty($override['top']) ? 1 : 0,
					'edge_to_edge_bottom'  => ! empty($override['bottom']) ? 1 : 0,
				]
			);
		}
	}

	/**
	 * @param array<string,mixed> $filters Filters.
	 * @return array<int,array<string,mixed>>
	 */
	public function query(array $filters = [], int $limit = 50, int $offset = 0): array {
		global $wpdb;

		$table  = catalogue_image_studio_table_name();
		$where  = ['1=1'];
		$params = [];

		if (! empty($filters['status'])) {
			$statuses = array_map('sanitize_key', (array) $filters['status']);
			$where[]  = 'status IN (' . implode(',', array_fill(0, count($statuses), '%s')) . ')';
			$params   = array_merge($params, $statuses);
		}

		if (! empty($filters['product_id'])) {
			$where[]  = 'product_id = %d';
			$params[] = absint($filters['product_id']);
		}

		$params[] = max(1, $limit);
		$params[] = max(0, $offset);

		$cache_key = 'query_' . md5(wp_json_encode([$filters, $limit, $offset]));
		$cached    = wp_cache_get($cache_key, 'optivra_image_studio_jobs');

		if (false !== $cached) {
			return is_array($cached) ? $cached : [];
		}

		// The dynamic WHERE list is composed only of fixed strings defined above; values are passed through prepare.
		$sql = 'SELECT * FROM %i WHERE ' . implode(' AND ', $where) . ' ORDER BY updated_at DESC LIMIT %d OFFSET %d';
		array_unshift($params, $table);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,PluginCheck.Security.DirectDB.UnescapedDBParameter -- SQL fragments are fixed allowlisted WHERE clauses; values are prepared in $params.
		$prepared_sql = $wpdb->prepare($sql, $params);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQL.NotPrepared -- Custom plugin queue table query uses prepared SQL built immediately above and is cached.
		$results = (array) $wpdb->get_results($prepared_sql, ARRAY_A);
		wp_cache_set($cache_key, $results, 'optivra_image_studio_jobs', 300);

		return $results;
	}

	/**
	 * Count jobs by current status.
	 *
	 * @return array<string,int>
	 */
	public function counts_by_status(): array {
		global $wpdb;

		$cache_key = 'counts_by_status';
		$cached    = wp_cache_get($cache_key, 'optivra_image_studio_jobs');

		if (false !== $cached) {
			return is_array($cached) ? $cached : [];
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Custom plugin queue table aggregate, cached above.
		$rows   = (array) $wpdb->get_results($wpdb->prepare('SELECT status, COUNT(*) AS total FROM %i GROUP BY status', catalogue_image_studio_table_name()), ARRAY_A);
		$counts = [];

		foreach ($rows as $row) {
			$counts[(string) $row['status']] = (int) $row['total'];
		}

		wp_cache_set($cache_key, $counts, 'optivra_image_studio_jobs', 300);

		return $counts;
	}

	/**
	 * Set multiple jobs to one status.
	 *
	 * @param array<int,int> $job_ids Job IDs.
	 * @return int Updated count.
	 */
	public function update_statuses(array $job_ids, string $status): int {
		global $wpdb;

		$job_ids = array_values(array_filter(array_map('absint', $job_ids)));

		if (empty($job_ids)) {
			return 0;
		}

		$table        = catalogue_image_studio_table_name();
		$placeholders = implode(',', array_fill(0, count($job_ids), '%d'));
		$params       = array_merge([$table, sanitize_key($status), current_time('mysql', true)], $job_ids);

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $placeholders is generated only from count($job_ids) and contains only %d placeholders; values are passed in $params.
		$prepared_sql = $wpdb->prepare("UPDATE %i SET status = %s, updated_at = %s WHERE id IN ({$placeholders})", $params);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.NotPrepared -- Custom plugin queue table bulk status update uses prepared SQL built immediately above; cache invalidated immediately after.
		$updated = (int) $wpdb->query($prepared_sql);
		$this->flush_cache();

		return $updated;
	}

	/**
	 * Clear locally cached image jobs.
	 *
	 * @return void
	 */
	public function delete_all(): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Support action for clearing the plugin's local queue table only; cache flushed immediately after.
		$wpdb->query($wpdb->prepare('DELETE FROM %i', catalogue_image_studio_table_name()));
		$this->flush_cache();
	}

	private function flush_cache(): void {
		wp_cache_flush_group('optivra_image_studio_jobs');
	}
}
