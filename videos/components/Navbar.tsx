"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm">
            ▶
          </span>
          VideoVault
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {loading ? null : user ? (
            <>
              <Link href="/dashboard" className="text-zinc-300 hover:text-white">
                Dashboard
              </Link>
              <span className="hidden text-zinc-500 sm:inline">{user.email}</span>
              <button
                onClick={logout}
                className="rounded-full border border-white/15 px-4 py-1.5 text-zinc-200 hover:bg-white/10"
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-zinc-300 hover:text-white">
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-white px-4 py-1.5 font-medium text-zinc-900 hover:bg-zinc-200"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
