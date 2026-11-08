import Link from "next/link";

const features = [
  {
    icon: "⚡",
    title: "Subida directa a S3",
    text: "El navegador sube a RustFS con URLs prefirmadas. Tu servidor nunca procesa los gigas del vídeo.",
  },
  {
    icon: "🔒",
    title: "Privado por defecto",
    text: "El bucket no es público: cada reproducción usa un enlace temporal firmado para tu sesión.",
  },
  {
    icon: "🏷️",
    title: "Metadatos flexibles",
    text: "Tags y pares clave-valor libres (proyecto, cliente…) consultables desde un buscador global.",
  },
  {
    icon: "📊",
    title: "Dashboard de uso",
    text: "Número de vídeos y espacio ocupado calculados con agregaciones de MongoDB.",
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[500px] max-w-4xl rounded-full bg-gradient-to-r from-indigo-600/30 to-fuchsia-600/30 blur-3xl" />

      <section className="relative mx-auto max-w-5xl px-4 pb-16 pt-24 text-center sm:px-6">
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
          Next.js 16 · MongoDB · RustFS (S3)
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
          Tus vídeos, en tu propia
          <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            {" "}bóveda
          </span>
          .
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
          VideoVault sube, organiza y reproduce vídeos pesados sobre almacenamiento S3 compatible,
          con seguridad de extremo a extremo y búsqueda por metadatos.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Empezar gratis
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
          >
            Ir al dashboard
          </Link>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-3 font-medium">{f.title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
