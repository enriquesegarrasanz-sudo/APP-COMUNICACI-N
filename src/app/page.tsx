import AppShell from "@/components/app-shell";
import { listVideoEntries } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const videos = await listVideoEntries();
  return <AppShell initialVideos={videos} />;
}

