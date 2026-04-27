import { query } from "../db/pool";

export async function getSettings(shopId: string) {
  const result = await query(
    `select background_mode as "backgroundMode", default_prompt as "defaultPrompt", preserve_product as "preserveProduct",
            auto_crop as "autoCrop", auto_center as "autoCenter", replacement_mode as "replacementMode",
            delete_data_on_uninstall as "deleteDataOnUninstall"
     from app_settings where shop_id = $1`,
    [shopId]
  );
  return result.rows[0];
}

export async function updateSettings(shopId: string, body: any) {
  const backgroundMode = ["pure_white", "transparent", "lifestyle", "custom_prompt"].includes(body.backgroundMode) ? body.backgroundMode : "pure_white";
  const replacementMode = ["manual_approval", "replace_main_after_approval", "add_extra_after_approval"].includes(body.replacementMode)
    ? body.replacementMode
    : "manual_approval";
  const result = await query(
    `update app_settings
     set background_mode=$2, default_prompt=$3, preserve_product=$4, auto_crop=$5, auto_center=$6, replacement_mode=$7, delete_data_on_uninstall=$8, updated_at=now()
     where shop_id=$1
     returning background_mode as "backgroundMode", default_prompt as "defaultPrompt", preserve_product as "preserveProduct",
               auto_crop as "autoCrop", auto_center as "autoCenter", replacement_mode as "replacementMode",
               delete_data_on_uninstall as "deleteDataOnUninstall"`,
    [
      shopId,
      backgroundMode,
      String(body.defaultPrompt || "").slice(0, 2000),
      Boolean(body.preserveProduct),
      Boolean(body.autoCrop),
      Boolean(body.autoCenter),
      replacementMode,
      Boolean(body.deleteDataOnUninstall)
    ]
  );
  return result.rows[0];
}
