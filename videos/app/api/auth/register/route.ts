import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { MongoServerError } from "mongodb";
import { getCollections } from "@/lib/mongodb";
import { setSessionCookie, signSession } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register
 * Crea un usuario con la contraseña hasheada (bcrypt, 12 rondas) e inicia sesión.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!nombre || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Nombre o email no válidos" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 },
    );
  }

  const { users } = await getCollections();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const { insertedId } = await users.insertOne({
      nombre,
      email,
      passwordHash,
      createdAt: new Date(),
    });

    const user = { id: insertedId.toHexString(), nombre, email };
    const res = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(res, await signSession(user));
    return res;
  } catch (err) {
    // Índice único sobre email → código 11000 si ya existe
    if (err instanceof MongoServerError && err.code === 11000) {
      return NextResponse.json({ error: "Ese email ya está registrado" }, { status: 409 });
    }
    throw err;
  }
}
