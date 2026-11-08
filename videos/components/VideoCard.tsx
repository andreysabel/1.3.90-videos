import VideoPlayer from "./VideoPlayer";
import { formatBytes, formatDate } from "@/lib/format";
import type { VideoDTO } from "@/lib/types";

export default function VideoCard({
  video,
  onTagClick,
}: {
  video: VideoDTO;
  onTagClick: (tag: string) => void;
}) {
  const kvEntries = Object.entries(video.kv);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 transition hover:border-white/20">
      <VideoPlayer s3Key={video.s3Key} />
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 font-medium" title={video.nombre}>
            {video.nombre}
          </h3>
          <span className="shrink-0 text-xs text-zinc-500">{formatBytes(video.tamano)}</span>
        </div>
        {video.descripcion && (
          <p className="line-clamp-2 text-sm text-zinc-400">{video.descripcion}</p>
        )}
        {video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {video.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-200 hover:bg-indigo-500/30"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
        {kvEntries.length > 0 && (
          <dl className="flex flex-wrap gap-1.5 text-xs">
            {kvEntries.map(([k, v]) => (
              <div key={k} className="rounded-md bg-white/5 px-2 py-0.5 text-zinc-300">
                <dt className="inline text-zinc-500">{k}:</dt> <dd className="inline">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-xs text-zinc-500">{formatDate(video.fecha)}</p>
      </div>
    </article>
  );
}
