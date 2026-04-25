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
			$where[]  = 'status = %s';
			$params[] = sanitize_key((string) $filters['status']);
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
}
