<?php
$plugin = Optiimst_Plugin::instance();
$settings = $plugin->get_settings();
optiimst_update_option($plugin->get_option_name(), $settings, false);
$reloaded = $plugin->get_settings();
echo (is_array($reloaded) && isset($reloaded['api_base_url'])) ? 'settings persistence ok' : 'settings persistence failed';
