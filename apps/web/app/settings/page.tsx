import { SettingsApp } from "@/components/settings-app";
import { loadSettingsData } from "@/lib/redditpulse";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await loadSettingsData();

  return <SettingsApp initialConfig={settings.config} mode={settings.mode} />;
}
