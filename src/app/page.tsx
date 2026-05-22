import AppShell from "@/components/app-shell";
import { getAiSettingsStatus, getDriveSettingsStatus, listVideoEntries } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [videos, aiSettings, driveSettings] = await Promise.all([
    listVideoEntries(),
    getAiSettingsStatus(),
    getDriveSettingsStatus(),
  ]);

  return <AppShell initialAiSettings={aiSettings} initialDriveSettings={driveSettings} initialVideos={videos} />;
}
