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

		$existing = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE product_id = %d AND image_role = %s AND gallery_index = %d LIMIT 1",
				(int) $slot['product_id'],
				(string) $slot['image_role'],
				(int) $slot['gallery_index']
			),
			ARRAY_A
		);

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

			$wpdb->update($table, $data, ['id' => (int) $existing['id']]);
			return (int) $existing['id'];
		}

		$data['original_attachment_id'] = (int) $slot['attachment_id'];
		$data['status']                 = 'unprocessed';
		$data['created_at']             = $now;

		$wpdb->insert($table, $data);

		return (int) $wpdb->insert_id;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find(int $job_id): ?array {
		global $wpdb;

		$table = catalogue_image_studio_table_name();
		$job   = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d LIMIT 1", $job_id), ARRAY_A);

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
		$job   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE product_id = %d AND image_role = %s AND gallery_index = %d LIMIT 1",
				(int) $slot['product_id'],
				sanitize_key((string) $slot['image_role']),
				(int) $slot['gallery_index']
			),
			ARRAY_A
		);

		return $job ?: null;
	}

	/**
	 * @param array<string,mixed> $data Data.
	 * @return void
	 */
	public function update(int $job_id, array $data): void {
		global $wpdb;

		$data['updated_at'] = current_time('mysql', true);
		$wpdb->update(catalogue_image_studio_table_name(), $data, ['id' => $job_id]);
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

		$sql = "SELECT * FROM {$table} WHERE " . implode(' AND ', $where) . ' ORDER BY updated_at DESC LIMIT %d OFFSET %d';

		return (array) $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A);
	}

	/**
	 * Count jobs by current status.
	 *
	 * @return array<string,int>
	 */
	public function counts_by_status(): array {
		global $wpdb;

		$rows   = (array) $wpdb->get_results('SELECT status, COUNT(*) AS total FROM ' . catalogue_image_studio_table_name() . ' GROUP BY status', ARRAY_A);
		$counts = [];

		foreach ($rows as $row) {
			$counts[(string) $row['status']] = (int) $row['total'];
		}

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
		$params       = array_merge([sanitize_key($status), current_time('mysql', true)], $job_ids);

		return (int) $wpdb->query($wpdb->prepare("UPDATE {$table} SET status = %s, updated_at = %s WHERE id IN ({$placeholders})", $params));
	}

	/**
	 * Clear locally cached image jobs.
	 *
	 * @return void
	 */
	public function delete_all(): void {
		global $wpdb;

		$wpdb->query('DELETE FROM ' . catalogue_image_studio_table_name());
	}
}
