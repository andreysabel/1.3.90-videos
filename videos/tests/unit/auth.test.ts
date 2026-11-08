import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  getSessionUser,
  setSessionCookie,
  signSession,
  unauthorized,
  verifySession,
} from "@/lib/auth";
import { cookieJar, loginAs, makeUser } from "../support/session";

const user = { id: "507f1f77bcf86cd799439011", nombre: "Ana", email: "ana@example.com" };
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);
const now = () => Math.floor(Date.now() / 1000);

describe("JWT de sesión", () => {
  it("firma y verifica un token devolviendo el usuario", async () => {
    const token = await signSession(user);
    expect(token.split(".")).toHaveLength(3);
    expect(await verifySession(token)).toEqual(user);
  });

  it("devuelve null sin token, con basura o con la firma alterada", async () => {
    const token = await signSession(user);
    const [header, payload] = token.split(".");
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("no-es-un-jwt")).toBeNull();
    expect(await verifySession(`${header}.${payload}.firmafalsa`)).toBeNull();
  });

  it("rechaza tokens firmados con otro secreto", async () => {
    const foreign = await new SignJWT({ nombre: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("otro-secreto"));
    expect(await verifySession(foreign)).toBeNull();
  });

  it("rechaza tokens caducados", async () => {
    const expired = await new SignJWT({ nombre: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt(now() - 7200)
      .setExpirationTime(now() - 3600)
      .sign(secret());
    expect(await verifySession(expired)).toBeNull();
  });

  it("rechaza tokens sin sujeto", async () => {
    const noSub = await new SignJWT({ nombre: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret());
    expect(await verifySession(noSub)).toBeNull();
  });
});

describe("getSessionUser", () => {
  it("lee el usuario de la cookie de la petición", async () => {
    const u = await loginAs(makeUser({ nombre: "Luis" }));
    expect(await getSessionUser()).toEqual(u);
  });

  it("devuelve null sin cookie o con cookie inválida", async () => {
    expect(await getSessionUser()).toBeNull();
    cookieJar.set(SESSION_COOKIE, "basura");
    expect(await getSessionUser()).toBeNull();
  });
});

describe("cookies de sesión", () => {
  it("la cookie es HttpOnly, SameSite=Lax, de todo el sitio y dura 7 días", () => {
    const res = NextResponse.json({});
    setSessionCookie(res, "token123");
    const header = res.headers.get("set-cookie")!;
    expect(header).toContain(`${SESSION_COOKIE}=token123`);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=604800/);
  });

  it("clearSessionCookie la expira", () => {
    const res = NextResponse.json({});
    clearSessionCookie(res);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("unauthorized devuelve 401 con mensaje", async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "No autenticado" });
  });
});
