import { ObjectId } from "mongodb";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

/** Cookies "del navegador" que verá `cookies()` en las Route Handlers. */
export const cookieJar = new Map<string, string>();

export function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  const id = new ObjectId().toHexString();
  return { id, nombre: "Tester", email: `${id}@example.com`, ...overrides };
}

/** Simula un usuario con sesión iniciada (JWT válido en la cookie). */
export async function loginAs(user: SessionUser = makeUser()) {
  cookieJar.set(SESSION_COOKIE, await signSession(user));
  return user;
}

/** Copia la cookie de sesión de una respuesta al tarro, como haría el navegador. */
export function storeSessionCookie(res: Response) {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  if (match?.[1]) cookieJar.set(SESSION_COOKIE, match[1]);
  else cookieJar.delete(SESSION_COOKIE);
}
