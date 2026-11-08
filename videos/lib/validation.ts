import type { Document } from "mongodb";

/**
 * Funciones puras de validación y construcción de consultas, separadas de
 * las Route Handlers para poder probarlas de forma unitaria.
 */

export function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normaliza tags: minúsculas, sin espacios extremos, sin duplicados. */
export function normalizeTags(input: unknown): string[] {
  const list = Array.isArray(input) ? input : String(input ?? "").split(",");
  return [...new Set(list.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 30);
}

/** Acepta solo pares string→string con claves seguras (sin `$` ni `.`). */
export function normalizeKv(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = k.trim().toLowerCase();
    if (!/^[\w-]{1,40}$/.test(key)) continue;
    out[key] = String(v).trim().slice(0, 200);
  }
  return out;
}

/** Clave única del objeto en S3, siempre bajo el prefijo del usuario. */
export function buildS3Key(userId: string, fileName: string, id: string): string {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-80);
  return `users/${userId}/${id}-${safeName}`;
}

export function isOwnS3Key(userId: string, s3Key: string): boolean {
  return s3Key.startsWith(`users/${userId}/`) && !s3Key.includes("..");
}

/**
 * Construye el filtro de búsqueda de vídeos:
 * - Cada palabra de `q` debe aparecer (AND) en alguno de: nombre, descripción,
 *   tags, claves o valores de `kv` (OR), sin distinguir mayúsculas.
 * - Sintaxis `clave:valor` (p. ej. `cliente:acme`) filtra por `kv.clave`.
 * - `tag` filtra por tag exacto.
 * Requiere que el pipeline haya añadido `_kv` con $objectToArray.
 */
export function buildSearchFilter(userId: string, q: string, tag: string): Document {
  const and: Document[] = [{ userId }];
  if (tag) and.push({ tags: tag.trim().toLowerCase() });

  for (const term of q.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, 10)) {
    const kvMatch = term.match(/^([\w-]+):(.+)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      and.push({ [`kv.${key.toLowerCase()}`]: { $regex: escapeRegex(value), $options: "i" } });
      continue;
    }
    const rx = { $regex: escapeRegex(term), $options: "i" };
    and.push({
      $or: [{ nombre: rx }, { descripcion: rx }, { tags: rx }, { "_kv.k": rx }, { "_kv.v": rx }],
    });
  }
  return { $and: and };
}
