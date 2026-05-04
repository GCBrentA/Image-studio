<?php
$plugin = Optiimst_Plugin::instance();
$settings = $plugin->get_settings();
$redacted = $settings;
foreach (['api_token', 'api_key', 'openai_api_key'] as $key) {
	if (isset($redacted[$key])) {
		$redacted[$key] = '' === (string) $redacted[$key] ? '' : '[redacted]';
	}
}
$usage = $plugin->client()->get_usage();
echo wp_json_encode(
	[
		'settings' => $redacted,
		'usage_ok' => ! is_wp_error($usage),
		'usage_code' => is_wp_error($usage) ? $usage->get_error_code() : '',
		'usage_message' => is_wp_error($usage) ? $usage->get_error_message() : '',
		'usage_keys' => is_wp_error($usage) ? [] : array_keys((array) $usage),
	]
);
