"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Reproductor HTML5 que pide al backend una URL prefirmada de lectura
 * (GET temporal) y la usa como `src`. Si la URL caduca mientras la página
 * sigue abierta, el evento `error` del <video> solicita una nueva una vez.
 */
export default function VideoPlayer({
  s3Key,
  className = "",
}: {
  s3Key: string;
  className?: string;
}) {
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);

  const loadUrl = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/watch-url?s3Key=${encodeURIComponent(s3Key)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el vídeo");
      setWatchUrl(json.watchUrl);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [s3Key]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUrl();
  }, [loadUrl]);

  function onVideoError() {
    if (retried) {
      setError("No se pudo reproducir el vídeo");
      return;
    }
    setRetried(true);
    void loadUrl();
  }

  if (error) {
    return (
      <div className={`grid aspect-video place-items-center bg-zinc-900 text-sm text-red-300 ${className}`}>
        {error}
      </div>
    );
  }

  if (!watchUrl) {
    return <div className={`aspect-video animate-pulse bg-zinc-800 ${className}`} />;
  }

  return (
    <video
      key={watchUrl}
      src={watchUrl}
      controls
      preload="metadata"
      playsInline
      onError={onVideoError}
      className={`aspect-video w-full bg-black object-contain ${className}`}
    />
  );
}
