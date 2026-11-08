import { afterEach, vi } from "vitest";
import { cookieJar } from "./session";

/**
 * Fuera de Next.js no existe el contexto de petición que usa `cookies()`.
 * Lo sustituimos por un "tarro" de cookies controlado por los tests.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
  }),
}));

afterEach(() => {
  cookieJar.clear();
});
