import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollections } from "@/lib/mongodb";
import { setSessionCookie, signSession } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Valida credenciales y emite un JWT guardado en una cookie HttpOnly.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña obligatorios" }, { status: 400 });
  }

  const { users } = await getCollections();
  const doc = await users.findOne({ email });

  // Mismo mensaje en ambos casos para no revelar qué emails existen.
  const ok = doc ? await bcrypt.compare(password, doc.passwordHash) : false;
  if (!doc || !ok) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const user = { id: doc._id.toHexString(), nombre: doc.nombre, email: doc.email };
  const res = NextResponse.json({ user });
  setSessionCookie(res, await signSession(user));
  return res;
}
