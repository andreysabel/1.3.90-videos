import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "./env";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "vv_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

function secretKey() {
  return new TextEncoder().encode(env.jwtSecret);
}

/** Firma un JWT HS256 con los datos mínimos del usuario. */
export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ nombre: user.nombre, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Verifica el JWT; devuelve null si es inválido o ha caducado. */
export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      nombre: String(payload.nombre ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

/** Lee y valida la sesión desde la cookie HttpOnly de la petición actual. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Guarda el JWT en una cookie HttpOnly (inaccesible desde JavaScript). */
export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Respuesta 401 estándar para los endpoints protegidos. */
export function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}
