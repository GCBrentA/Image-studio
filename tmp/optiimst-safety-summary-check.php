<?php
$job = Optiimst_Plugin::instance()->jobs()->find(1);
$safety = optiimst_get_preservation_safety($job ?: []);
echo wp_json_encode(
	[
		'status' => $safety['status'],
		'label' => $safety['label'],
		'requires_review' => $safety['requires_review'],
		'reasons' => $safety['metadata']['reasons'],
	]
);
