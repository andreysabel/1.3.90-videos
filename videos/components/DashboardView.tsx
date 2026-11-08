"use client";

import { useCallback, useEffect, useState } from "react";
import StatsPanel from "./StatsPanel";
import VideoCard from "./VideoCard";
import VideoUpload from "./VideoUpload";
import { useAuth } from "@/context/AuthContext";
import type { DashboardStats, VideoDTO } from "@/lib/types";

/**
 * Vista principal del dashboard: hero, estadísticas, buscador global,
 * formulario de subida y grid de reproducción.
 */
export default function DashboardView() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tag, setTag] = useState("");
  const [videos, setVideos] = useState<VideoDTO[] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Espera 300 ms tras dejar de escribir antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    if (res.ok) setStats(await res.json());
  }, []);

  const loadVideos = useCallback(async (q: string, t: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (t) params.set("tag", t);
    try {
      const res = await fetch(`/api/videos/metadata?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al buscar");
      setVideos(json.videos);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadVideos(debounced, tag);
  }, [debounced, tag, loadVideos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStats();
  }, [loadStats]);

  function onUploaded() {
    void loadStats();
    void loadVideos(debounced, tag);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-zinc-900 to-fuchsia-600/20 p-8 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <p className="text-sm text-indigo-200">Hola{user ? `, ${user.nombre}` : ""} 👋</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Tu bóveda de vídeos, segura y al instante.
        </h1>
        <p className="mt-3 max-w-xl text-zinc-300">
          Sube directamente a tu almacenamiento S3, organiza con tags y metadatos libres, y
          reproduce con enlaces temporales que nunca exponen tus archivos.
        </p>

        {/* Buscador global */}
        <div className="mt-6 flex max-w-2xl items-center gap-2 rounded-2xl border border-white/15 bg-zinc-950/60 p-2 backdrop-blur">
          <span className="pl-2 text-zinc-500">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Buscar por título, descripción, tags o metadatos (ej. "cliente:acme")'
            className="flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-zinc-500"
          />
          {(query || tag) && (
            <button
              onClick={() => {
                setQuery("");
                setTag("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              Limpiar
            </button>
          )}
        </div>
        {tag && (
          <p className="mt-3 text-sm text-zinc-300">
            Filtrando por tag{" "}
            <button onClick={() => setTag("")} className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs">
              #{tag} ×
            </button>
          </p>
        )}
      </section>

      <StatsPanel stats={stats} onTagClick={setTag} activeTag={tag} />

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <aside className="h-fit rounded-2xl border border-white/10 bg-zinc-900/60 p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 font-semibold">Subir vídeo</h2>
          <VideoUpload onUploaded={onUploaded} />
        </aside>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Biblioteca</h2>
            {videos && (
              <span className="text-sm text-zinc-500">
                {videos.length} resultado{videos.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

          {!videos ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-video animate-pulse rounded-2xl bg-zinc-800/60" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-zinc-400">
              {debounced || tag
                ? "Ningún vídeo coincide con la búsqueda."
                : "Aún no has subido vídeos. ¡Empieza con el formulario de la izquierda!"}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} onTagClick={setTag} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
