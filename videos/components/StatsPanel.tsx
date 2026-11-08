import { formatBytes } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

/** Panel informativo con las métricas calculadas por /api/dashboard. */
export default function StatsPanel({
  stats,
  onTagClick,
  activeTag,
}: {
  stats: DashboardStats | null;
  onTagClick: (tag: string) => void;
  activeTag: string;
}) {
  const tiles = [
    { label: "Vídeos subidos", value: stats ? stats.totalVideos.toLocaleString("es-ES") : "—" },
    { label: "Espacio ocupado", value: stats ? formatBytes(stats.totalBytes) : "—" },
    { label: "Tamaño medio", value: stats ? formatBytes(stats.avgBytes) : "—" },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-400">{t.label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{t.value}</p>
        </div>
      ))}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <p className="text-xs uppercase tracking-wider text-zinc-400">Tags más usados</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {stats?.topTags.length ? (
            stats.topTags.map((t) => (
              <button
                key={t.tag}
                onClick={() => onTagClick(activeTag === t.tag ? "" : t.tag)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  activeTag === t.tag
                    ? "bg-indigo-500 text-white"
                    : "bg-white/10 text-zinc-300 hover:bg-white/20"
                }`}
              >
                #{t.tag} <span className="opacity-60">{t.count}</span>
              </button>
            ))
          ) : (
            <span className="text-sm text-zinc-500">Sin tags todavía</span>
          )}
        </div>
      </div>
    </section>
  );
}
