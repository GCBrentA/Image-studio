<?php
wp_set_current_user(1);
require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once ABSPATH . 'wp-admin/includes/template.php';
require_once ABSPATH . 'wp-admin/includes/screen.php';

$admin = new Optiimst_Admin(Optiimst_Plugin::instance());
$admin->register_menu();
$admin->enqueue_assets('dashboard');
$dashboard = (wp_script_is('optiimst-admin', 'enqueued') || wp_style_is('optiimst-admin-style', 'enqueued')) ? 'bad' : 'ok';
$admin->enqueue_assets('toplevel_page_optivra-image-studio');
$plugin_page = (wp_script_is('optiimst-admin', 'enqueued') && wp_style_is('optiimst-admin-style', 'enqueued')) ? 'ok' : 'bad';

echo 'dashboard=' . $dashboard . ';plugin=' . $plugin_page;
