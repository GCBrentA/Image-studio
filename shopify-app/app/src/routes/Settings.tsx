import { Banner, Button, Card, Checkbox, Page, Select, TextField } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { api } from "../api";

type Settings = {
  backgroundMode: string;
  defaultPrompt: string;
  preserveProduct: boolean;
  autoCrop: boolean;
  autoCenter: boolean;
  replacementMode: string;
  deleteDataOnUninstall: boolean;
};

const defaults: Settings = {
  backgroundMode: "pure_white",
  defaultPrompt: "",
  preserveProduct: true,
  autoCrop: true,
  autoCenter: true,
  replacementMode: "manual_approval",
  deleteDataOnUninstall: false
};

export function Settings() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Settings>("/settings").then(setSettings).catch((err) => setError(err.message));
  }, []);

  async function save() {
    setMessage(null);
    setError(null);
    try {
      setSettings(await api<Settings>("/settings", { method: "PUT", body: JSON.stringify(settings) }));
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Page title="Settings" subtitle="Set default generation and publishing behaviour.">
      {message ? <Banner tone="success">{message}</Banner> : null}
      {error ? <Banner tone="critical">{error}</Banner> : null}
      <Card>
        <Select label="Background mode" value={settings.backgroundMode} onChange={(value) => setSettings({ ...settings, backgroundMode: value })} options={[
          { label: "Pure white", value: "pure_white" },
          { label: "Transparent", value: "transparent" },
          { label: "Lifestyle", value: "lifestyle" },
          { label: "Custom prompt", value: "custom_prompt" }
        ]} />
        <TextField label="Default prompt" value={settings.defaultPrompt} onChange={(value) => setSettings({ ...settings, defaultPrompt: value })} multiline={4} autoComplete="off" />
        <Checkbox label="Preserve product" checked={settings.preserveProduct} onChange={(value) => setSettings({ ...settings, preserveProduct: value })} />
        <Checkbox label="Auto-crop" checked={settings.autoCrop} onChange={(value) => setSettings({ ...settings, autoCrop: value })} />
        <Checkbox label="Auto-centre" checked={settings.autoCenter} onChange={(value) => setSettings({ ...settings, autoCenter: value })} />
        <Select label="Replacement mode" value={settings.replacementMode} onChange={(value) => setSettings({ ...settings, replacementMode: value })} options={[
          { label: "Manual approval only", value: "manual_approval" },
          { label: "Replace main image after approval", value: "replace_main_after_approval" },
          { label: "Add as additional image after approval", value: "add_extra_after_approval" }
        ]} />
        <Checkbox label="Delete app data on uninstall" checked={settings.deleteDataOnUninstall} onChange={(value) => setSettings({ ...settings, deleteDataOnUninstall: value })} />
        <Button variant="primary" onClick={save}>Save settings</Button>
      </Card>
    </Page>
  );
}
