import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";
import { SESSION_COOKIE, signSession } from "@/lib/auth";

const BASE = "http://localhost:3000";

async function request(path: string, withSession = false) {
  const headers = new Headers();
  if (withSession) {
    const token = await signSession({ id: "u1", nombre: "A", email: "a@example.com" });
    headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  }
  return new NextRequest(`${BASE}${path}`, { headers });
}

describe("proxy", () => {
  it("redirige /dashboard a /login conservando el destino si no hay sesión", async () => {
    const res = await proxy(await request("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${BASE}/login?next=%2Fdashboard`);
  });

  it("redirige si la cookie es inválida", async () => {
    const req = new NextRequest(`${BASE}/dashboard`, {
      headers: { cookie: `${SESSION_COOKIE}=falso` },
    });
    expect((await proxy(req)).status).toBe(307);
  });

  it("deja pasar a /dashboard con sesión válida", async () => {
    const res = await proxy(await request("/dashboard", true));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/login", "/register"])("con sesión, %s redirige al dashboard", async (path) => {
    const res = await proxy(await request(path, true));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${BASE}/dashboard`);
  });

  it.each(["/login", "/register"])("sin sesión, %s es accesible", async (path) => {
    const res = await proxy(await request(path));
    expect(res.headers.get("location")).toBeNull();
  });

  it("solo se aplica a las rutas necesarias", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*", "/login", "/register"]);
  });
});
