import { inject } from "vitest";

const BASE = "http://localhost:3000";

export function jsonRequest(path: string, body: unknown, method = "POST") {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function getRequest(path: string) {
  return new Request(`${BASE}${path}`);
}

/** true si MongoDB y RustFS están disponibles (lo decide el globalSetup). */
export const servicesUp = inject("servicesDown").length === 0;
