import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth";

/** GET /api/auth/me — devuelve el usuario de la sesión actual. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ user });
}
