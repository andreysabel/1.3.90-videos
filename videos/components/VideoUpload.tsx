"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { formatBytes } from "@/lib/format";
import type { VideoDTO } from "@/lib/types";

type Phase = "idle" | "signing" | "uploading" | "saving" | "done" | "error";

const EXT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  ogv: "video/ogg",
};

/** Algunos SO no informan el MIME (p. ej. .mkv en Windows): lo deducimos por extensión. */
function videoType(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? "";
}

/**
 * PUT directo a RustFS con progreso real.
 * `fetch` no expone el progreso de subida (los request streams exigen HTTP/2,
 * y RustFS en local sirve HTTP/1.1), así que usamos XMLHttpRequest, que sí
 * emite `upload.onprogress` con los bytes enviados.
 */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (loaded: number) => void,
  xhrRef: { current: XMLHttpRequest | null },
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`RustFS respondió ${xhr.status}`));
    xhr.onerror = () =>
      reject(new Error("Error de red al subir (¿RustFS arrancado y con CORS habilitado?)"));
    xhr.onabort = () => reject(new Error("Subida cancelada"));
    xhr.send(file);
  });
}

export default function VideoUpload({ onUploaded }: { onUploaded?: (video: VideoDTO) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [loaded, setLoaded] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [kvRows, setKvRows] = useState<{ k: string; v: string }[]>([{ k: "", v: "" }]);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef(0);

  const busy = phase === "signing" || phase === "uploading" || phase === "saving";
  const percent = file ? Math.round((loaded / file.size) * 100) : 0;

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!videoType(f).startsWith("video/")) {
      setError("El fichero seleccionado no es un vídeo");
      return;
    }
    setFile(f);
    setError(null);
    setPhase("idle");
    setLoaded(0);
    const nameInput = formRef.current?.elements.namedItem("nombre") as HTMLInputElement | null;
    if (nameInput && !nameInput.value) nameInput.value = f.name.replace(/\.[^.]+$/, "");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || busy) return;
    const form = new FormData(e.currentTarget);
    const contentType = videoType(file);
    setError(null);

    try {
      // 1) Pedimos al backend una URL prefirmada de subida (PUT, 15 min).
      setPhase("signing");
      const signRes = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType, size: file.size }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error ?? "No se pudo preparar la subida");

      // 2) Subida directa navegador → RustFS. Next.js no toca los bytes.
      setPhase("uploading");
      startedAt.current = Date.now();
      setSpeed(0);
      await putWithProgress(
        sign.uploadUrl,
        file,
        contentType,
        (bytes) => {
          const elapsed = (Date.now() - startedAt.current) / 1000;
          setLoaded(bytes);
          if (elapsed > 0) setSpeed(bytes / elapsed);
        },
        xhrRef,
      );

      // 3) Registramos los metadatos en MongoDB.
      setPhase("saving");
      const kv = Object.fromEntries(
        kvRows.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v.trim()]),
      );
      const metaRes = await fetch("/api/videos/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key: sign.s3Key,
          nombre: form.get("nombre"),
          descripcion: form.get("descripcion"),
          tags: String(form.get("tags") ?? "").split(","),
          kv,
        }),
      });
      const meta = await metaRes.json();
      if (!metaRes.ok) throw new Error(meta.error ?? "No se pudieron guardar los metadatos");

      setPhase("done");
      onUploaded?.(meta.video);
      formRef.current?.reset();
      setFile(null);
      setKvRows([{ k: "", v: "" }]);
    } catch (err) {
      setPhase("error");
      setError((err as Error).message);
    } finally {
      xhrRef.current = null;
    }
  }

  const input =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-500 focus:border-indigo-400 disabled:opacity-50";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragging ? "border-indigo-400 bg-indigo-500/10" : "border-white/15 hover:border-white/30"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          type="file"
          accept="video/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <span className="text-3xl">⬆</span>
        {file ? (
          <span className="text-sm">
            <strong className="text-white">{file.name}</strong>
            <span className="text-zinc-400"> · {formatBytes(file.size)}</span>
          </span>
        ) : (
          <span className="text-sm text-zinc-400">
            Arrastra un vídeo aquí o <span className="text-indigo-300">haz clic para elegirlo</span>
          </span>
        )}
      </label>

      <input name="nombre" required placeholder="Título" disabled={busy} className={input} />
      <textarea
        name="descripcion"
        rows={2}
        placeholder="Descripción"
        disabled={busy}
        className={input}
      />
      <input
        name="tags"
        placeholder="Tags separados por comas (demo, marketing, 4k)"
        disabled={busy}
        className={input}
      />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
          Metadatos clave-valor
        </legend>
        {kvRows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={row.k}
              onChange={(e) =>
                setKvRows((rows) => rows.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))
              }
              placeholder="clave (proyecto)"
              disabled={busy}
              className={input}
            />
            <input
              value={row.v}
              onChange={(e) =>
                setKvRows((rows) => rows.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))
              }
              placeholder="valor (demo)"
              disabled={busy}
              className={input}
            />
            <button
              type="button"
              disabled={busy || kvRows.length === 1}
              onClick={() => setKvRows((rows) => rows.filter((_, j) => j !== i))}
              className="rounded-xl border border-white/10 px-3 text-zinc-400 hover:text-white disabled:opacity-30"
              aria-label="Quitar par"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => setKvRows((rows) => [...rows, { k: "", v: "" }])}
          className="text-xs text-indigo-300 hover:underline"
        >
          + Añadir par
        </button>
      </fieldset>

      {(phase === "uploading" || phase === "saving" || phase === "signing") && file && (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>
              {phase === "signing" && "Solicitando URL segura…"}
              {phase === "uploading" &&
                `${formatBytes(loaded)} de ${formatBytes(file.size)} · ${formatBytes(speed)}/s`}
              {phase === "saving" && "Guardando metadatos…"}
            </span>
            <span>{percent}%</span>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {phase === "done" && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          ¡Vídeo subido y catalogado!
        </p>
      )}

      <div className="flex gap-2">
        <button
          disabled={!file || busy}
          className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Subiendo…" : "Subir vídeo"}
        </button>
        {phase === "uploading" && (
          <button
            type="button"
            onClick={() => xhrRef.current?.abort()}
            className="rounded-xl border border-white/15 px-4 text-sm text-zinc-300 hover:bg-white/10"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
