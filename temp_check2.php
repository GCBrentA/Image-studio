<?php
if(!function_exists('wp_parse_url')){function wp_parse_url($u,$c=-1){return parse_url($u,$c);} }
if(!function_exists('esc_url_raw')){function esc_url_raw($url){return $url;}}
if(!function_exists('untrailingslashit')){function untrailingslashit($text){return rtrim($text,'/');}}
if(!function_exists('sanitize_text_field')){function sanitize_text_field($value){return is_string($value)?$value:(string)$value;}}
if(!function_exists('sanitize_key')){function sanitize_key($value){return preg_replace('/[^a-z0-9_\-]/','', strtolower($value));}}
if(!function_exists('trailingslashit')){function trailingslashit($text){return rtrim($text,'/').'/';}}
define('ABSPATH','/tmp');
require 'wordpress-plugin/optivra-image-studio-for-woocommerce/includes/class-catalogue-image-studio-saas-client.php';
echo Catalogue_Image_Studio_SaaSClient::build_api_url_for_base('https://www.optivra.app/api/image-studio','/api/image-studio/audits/start'),"\n";
