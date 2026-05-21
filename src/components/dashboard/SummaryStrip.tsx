import { BarChart3, FileText, Mic2, Sparkles } from "lucide-react";
import type { VideoEntry } from "@/types/video";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function SummaryStrip({ videos }: { videos: VideoEntry[] }) {
  const analyzed = videos.filter((video) => video.analysis);
  const totalWords = analyzed.reduce((total, video) => total + (video.analysis?.wordCount ?? 0), 0);
  const totalFillers = analyzed.reduce((total, video) => total + (video.analysis?.fillerTotal ?? 0), 0);
  const clarity = average(analyzed.map((video) => video.analysis?.clarityScore ?? 0));

  const metrics = [
    { label: "Sesiones", value: videos.length, icon: FileText },
    { label: "Palabras", value: totalWords, icon: Mic2 },
    { label: "Muletillas", value: totalFillers, icon: BarChart3 },
    { label: "Claridad", value: analyzed.length ? `${clarity}%` : "-", icon: Sparkles },
  ];

  return (
    <section className="summary-strip" aria-label="Resumen general">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <article className="metric-tile" key={metric.label}>
            <Icon aria-hidden="true" size={18} />
            <div>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

