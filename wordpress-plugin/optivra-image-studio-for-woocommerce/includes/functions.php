<?php
/**
 * Shared plugin helpers.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

/**
 * Return the processing jobs table name.
 *
 * @return string
 */
function catalogue_image_studio_table_name(): string {
	global $wpdb;

	return $wpdb->prefix . 'catalogue_image_studio_jobs';
}

/**
 * Return the processed image version history table name.
 *
 * @return string
 */
function catalogue_image_studio_versions_table_name(): string {
	global $wpdb;

	return $wpdb->prefix . 'catalogue_image_studio_versions';
}

/**
 * Decode stored processing diagnostics.
 *
 * @param array<string,mixed> $job Job row.
 * @return array<string,mixed>
 */
function catalogue_image_studio_get_job_diagnostics(array $job): array {
	$raw = isset($job['processing_diagnostics']) ? (string) $job['processing_diagnostics'] : '';

	if ('' === trim($raw)) {
		return [];
	}

	$decoded = json_decode($raw, true);

	return is_array($decoded) ? $decoded : [];
}

/**
 * Extract output validation from stored diagnostics.
 *
 * @param array<string,mixed> $job Job row.
 * @return array<string,mixed>
 */
function catalogue_image_studio_get_output_validation(array $job): array {
	$diagnostics = catalogue_image_studio_get_job_diagnostics($job);

	if (isset($diagnostics['output_validation']) && is_array($diagnostics['output_validation'])) {
		return $diagnostics['output_validation'];
	}

	if (isset($diagnostics['outputValidation']) && is_array($diagnostics['outputValidation'])) {
		return $diagnostics['outputValidation'];
	}

	return [];
}

/**
 * Derive a merchant-facing product preservation safety status.
 *
 * @param array<string,mixed> $job Job row.
 * @return array{status:string,label:string,metadata:array<string,mixed>,blocking:bool,requires_review:bool}
 */
function catalogue_image_studio_get_preservation_safety(array $job): array {
	$validation = catalogue_image_studio_get_output_validation($job);
	$diagnostics = catalogue_image_studio_get_job_diagnostics($job);
	$status = isset($job['safety_status']) && '' !== (string) $job['safety_status'] ? sanitize_key((string) $job['safety_status']) : '';
	$reasons = [];
	$metadata = [
		'validation_status' => '',
		'failure_reasons'   => [],
		'warnings'          => [],
		'checks'            => [],
		'scores'            => [],
		'alpha_coverage'    => null,
		'foreground_confidence' => null,
		'product_pixel_drift_score' => null,
		'failed_integrity_checks' => false,
	];

	if (! empty($validation)) {
		$validation_status = isset($validation['status']) ? (string) $validation['status'] : '';
		$normalized_validation_status = sanitize_key(str_replace(' ', '_', strtolower($validation_status)));
		$failure_reasons = isset($validation['failureReasons']) && is_array($validation['failureReasons']) ? array_values(array_map('strval', $validation['failureReasons'])) : [];
		$warnings = isset($validation['warnings']) && is_array($validation['warnings']) ? array_values(array_map('strval', $validation['warnings'])) : [];
		$checks = isset($validation['checks']) && is_array($validation['checks']) ? $validation['checks'] : [];
		$scores = isset($validation['scores']) && is_array($validation['scores']) ? $validation['scores'] : [];

		$metadata['validation_status'] = $validation_status;
		$metadata['failure_reasons'] = $failure_reasons;
		$metadata['warnings'] = $warnings;
		$metadata['checks'] = $checks;
		$metadata['scores'] = $scores;

		if ('failed' === $normalized_validation_status || in_array('Failed', array_map('strval', $checks), true)) {
			$status = 'failed';
			$reasons = array_merge($reasons, $failure_reasons);
		} elseif ('needs_review' === $normalized_validation_status || in_array('Needs Review', array_map('strval', $checks), true)) {
			$status = 'needs_review';
			$reasons = array_merge($reasons, $warnings);
		} elseif ('passed' === $normalized_validation_status) {
			$status = 'passed';
		}

		$failure_text = strtolower(implode(' ', $failure_reasons));
		if (false !== strpos($failure_text, 'pixel drift') || false !== strpos($failure_text, 'integrity') || false !== strpos($failure_text, 'ai product pixel')) {
			$status = 'failed';
		}
	}

	$mask = isset($diagnostics['mask']) && is_array($diagnostics['mask']) ? $diagnostics['mask'] : [];
	if (isset($mask['alphaCoveragePercent'])) {
		$metadata['alpha_coverage'] = (float) $mask['alphaCoveragePercent'];
	}
	if (isset($mask['foregroundConfidence'])) {
		$metadata['foreground_confidence'] = (float) $mask['foregroundConfidence'];
		if ((float) $mask['foregroundConfidence'] < 70 && 'failed' !== $status) {
			$status = 'needs_review';
			$reasons[] = __('Foreground confidence is low.', 'optivra-image-studio-for-woocommerce');
		}
	}

	$programmatic = isset($diagnostics['programmaticValidation']) && is_array($diagnostics['programmaticValidation'])
		? $diagnostics['programmaticValidation']
		: (isset($validation['programmaticValidation']) && is_array($validation['programmaticValidation']) ? $validation['programmaticValidation'] : []);
	if (! empty($programmatic) && empty($programmatic['passed'])) {
		$status = 'failed';
		$metadata['failed_integrity_checks'] = true;
	}

	$rgb = isset($diagnostics['rgbIntegrity']) && is_array($diagnostics['rgbIntegrity']) ? $diagnostics['rgbIntegrity'] : [];
	if (! empty($rgb) && empty($rgb['passed'])) {
		$status = 'failed';
		$metadata['failed_integrity_checks'] = true;
	}

	if ('' === $status) {
		$status = empty($validation) ? 'not_assessed' : 'needs_review';
	}

	$labels = [
		'passed'       => __('Passed', 'optivra-image-studio-for-woocommerce'),
		'needs_review' => __('Needs Review', 'optivra-image-studio-for-woocommerce'),
		'failed'       => __('Failed', 'optivra-image-studio-for-woocommerce'),
		'not_assessed' => __('Not Assessed', 'optivra-image-studio-for-woocommerce'),
	];
	$metadata['reasons'] = array_values(array_unique(array_filter(array_map('strval', $reasons))));

	return [
		'status'          => in_array($status, ['passed', 'needs_review', 'failed', 'not_assessed'], true) ? $status : 'not_assessed',
		'label'           => $labels[$status] ?? $labels['not_assessed'],
		'metadata'        => $metadata,
		'blocking'        => 'failed' === $status,
		'requires_review' => in_array($status, ['needs_review', 'not_assessed'], true),
	];
}
