import AppShell from "@/components/app-shell";
import { getAiSettingsStatus, listVideoEntries } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [videos, aiSettings] = await Promise.all([listVideoEntries(), getAiSettingsStatus()]);
  return <AppShell initialAiSettings={aiSettings} initialVideos={videos} />;
}
