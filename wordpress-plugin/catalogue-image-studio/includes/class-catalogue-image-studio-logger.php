<?php
/**
 * Lightweight WooCommerce-aware logger.
 *
 * @package CatalogueImageStudio
 */

if (! defined('ABSPATH')) {
	exit;
}

class Catalogue_Image_Studio_Logger {
	/**
	 * Log an informational event.
	 *
	 * @param string              $message Message.
	 * @param array<string,mixed> $context Context.
	 * @return void
	 */
	public function info(string $message, array $context = []): void {
		$this->log('info', $message, $context);
	}

	/**
	 * Log an error event.
	 *
	 * @param string              $message Message.
	 * @param array<string,mixed> $context Context.
	 * @return void
	 */
	public function error(string $message, array $context = []): void {
		$this->log('error', $message, $context);
	}

	/**
	 * Write to WooCommerce logger when available.
	 *
	 * @param string              $level Level.
	 * @param string              $message Message.
	 * @param array<string,mixed> $context Context.
	 * @return void
	 */
	private function log(string $level, string $message, array $context): void {
		if (function_exists('wc_get_logger')) {
			wc_get_logger()->log(
				$level,
				$message,
				[
					'source'  => 'optivra',
					'context' => $context,
				]
			);
			return;
		}

		error_log('Catalogue Image Studio: ' . $message . ' ' . wp_json_encode($context));
	}
}
