import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

/** POST /api/auth/logout — borra la cookie de sesión. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
