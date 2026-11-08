import { afterAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import getClientPromise, { getCollections } from "@/lib/mongodb";
import { SESSION_COOKIE } from "@/lib/auth";
import { cookieJar, storeSessionCookie } from "../support/session";
import { jsonRequest, servicesUp } from "../support/http";

/** Integración: rutas de autenticación contra MongoDB real (BD videovault_test). */
describe.skipIf(!servicesUp)("API de autenticación", () => {
  const email = `ana.${Date.now()}@example.com`;
  const password = "contraseña-segura";

  afterAll(async () => {
    await (await getClientPromise()).close();
  });

  describe("POST /api/auth/register", () => {
    it("crea el usuario, hashea la contraseña y abre sesión", async () => {
      const res = await register(
        jsonRequest("/api/auth/register", { nombre: " Ana ", email: email.toUpperCase(), password }),
      );
      expect(res.status).toBe(201);

      const { user } = await res.json();
      expect(user).toMatchObject({ nombre: "Ana", email });
      expect(user.id).toMatch(/^[a-f0-9]{24}$/);
      expect(res.headers.get("set-cookie")).toMatch(new RegExp(`${SESSION_COOKIE}=.+HttpOnly`, "i"));

      const { users } = await getCollections();
      const doc = await users.findOne({ email });
      expect(doc?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      expect(doc?.passwordHash).not.toContain(password);
    });

    it("rechaza un email ya registrado con 409", async () => {
      const res = await register(
        jsonRequest("/api/auth/register", { nombre: "Otra", email, password }),
      );
      expect(res.status).toBe(409);
    });

    it.each([
      [{ nombre: "", email: "x@example.com", password: "12345678" }, /nombre o email/i],
      [{ nombre: "X", email: "no-es-email", password: "12345678" }, /nombre o email/i],
      [{ nombre: "X", email: "x@example.com", password: "corta" }, /8 caracteres/],
    ])("valida la entrada %j → 400", async (body, message) => {
      const res = await register(jsonRequest("/api/auth/register", body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(message);
    });

    it("rechaza un cuerpo que no es JSON", async () => {
      const res = await register(jsonRequest("/api/auth/register", "{roto"));
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("inicia sesión con credenciales válidas (email sin distinguir mayúsculas)", async () => {
      const res = await login(jsonRequest("/api/auth/login", { email: ` ${email.toUpperCase()} `, password }));
      expect(res.status).toBe(200);
      expect((await res.json()).user.email).toBe(email);
      expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    });

    it("devuelve el mismo 401 para contraseña incorrecta y para email inexistente", async () => {
      const wrongPass = await login(jsonRequest("/api/auth/login", { email, password: "mala" }));
      const noUser = await login(
        jsonRequest("/api/auth/login", { email: "nadie@example.com", password }),
      );
      expect(wrongPass.status).toBe(401);
      expect(noUser.status).toBe(401);
      expect(await wrongPass.json()).toEqual(await noUser.json());
    });

    it("exige email y contraseña", async () => {
      const res = await login(jsonRequest("/api/auth/login", { email }));
      expect(res.status).toBe(400);
    });
  });

  describe("sesión: /me y /logout", () => {
    it("/me devuelve 401 sin sesión", async () => {
      expect((await me()).status).toBe(401);
    });

    it("la cookie emitida en el login da acceso a /me", async () => {
      const res = await login(jsonRequest("/api/auth/login", { email, password }));
      storeSessionCookie(res);
      expect(cookieJar.has(SESSION_COOKIE)).toBe(true);

      const meRes = await me();
      expect(meRes.status).toBe(200);
      expect((await meRes.json()).user).toMatchObject({ email, nombre: "Ana" });
    });

    it("logout borra la cookie", async () => {
      const res = await logout();
      expect(res.status).toBe(200);
      storeSessionCookie(res);
      expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
      expect((await me()).status).toBe(401);
    });
  });
});
