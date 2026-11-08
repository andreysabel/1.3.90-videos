"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";

/** Formulario compartido de login / registro. */
export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error inesperado");

      await refresh();
      // Respeta ?next=… que añade el proxy al redirigir a /login.
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next?.startsWith("/") ? next : "/dashboard";
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  const input =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-indigo-400";

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/60 p-8 shadow-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isRegister ? "Crea tu cuenta" : "Bienvenido de nuevo"}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        {isRegister ? "Empieza a guardar tus vídeos en minutos." : "Accede a tu biblioteca de vídeos."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {isRegister && <input name="nombre" required placeholder="Nombre" className={input} />}
        <input name="email" type="email" required placeholder="Email" className={input} />
        <input
          name="password"
          type="password"
          required
          minLength={isRegister ? 8 : undefined}
          placeholder={isRegister ? "Contraseña (mín. 8 caracteres)" : "Contraseña"}
          className={input}
        />

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <button
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Un momento…" : isRegister ? "Registrarme" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-400">
        {isRegister ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
        <Link href={isRegister ? "/login" : "/register"} className="text-indigo-300 hover:underline">
          {isRegister ? "Inicia sesión" : "Regístrate"}
        </Link>
      </p>
    </div>
  );
}
