import { describe, expect, it } from "vitest";
import {
  buildS3Key,
  buildSearchFilter,
  escapeRegex,
  isOwnS3Key,
  normalizeKv,
  normalizeTags,
} from "@/lib/validation";

describe("escapeRegex", () => {
  it("escapa los metacaracteres para que la búsqueda sea literal", () => {
    const literal = "a.b*c(1)+[x]?$^|\\";
    expect(new RegExp(escapeRegex(literal)).test(literal)).toBe(true);
    expect(new RegExp(escapeRegex("a.b")).test("axb")).toBe(false);
  });
});

describe("normalizeTags", () => {
  it("acepta un array: recorta, pasa a minúsculas y quita duplicados y vacíos", () => {
    expect(normalizeTags([" Demo", "demo", "", "  ", "4K"])).toEqual(["demo", "4k"]);
  });

  it("acepta una cadena separada por comas", () => {
    expect(normalizeTags("marketing, Demo ,demo,,rrhh")).toEqual(["marketing", "demo", "rrhh"]);
  });

  it("devuelve [] con entradas vacías o nulas", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags("")).toEqual([]);
  });

  it("limita a 30 tags", () => {
    const many = Array.from({ length: 50 }, (_, i) => `t${i}`);
    expect(normalizeTags(many)).toHaveLength(30);
  });
});

describe("normalizeKv", () => {
  it("normaliza claves a minúsculas y convierte valores a string", () => {
    expect(normalizeKv({ Proyecto: " demo ", version: 2 })).toEqual({
      proyecto: "demo",
      version: "2",
    });
  });

  it("descarta claves peligrosas para MongoDB ($ o .) o demasiado largas", () => {
    const input = {
      $where: "1",
      "a.b": "x",
      ["k".repeat(41)]: "x",
      ok_key: "y",
      "con-guion": "z",
    };
    expect(normalizeKv(input)).toEqual({ ok_key: "y", "con-guion": "z" });
  });

  it("recorta los valores a 200 caracteres", () => {
    expect(normalizeKv({ nota: "x".repeat(500) }).nota).toHaveLength(200);
  });

  it.each([null, undefined, "texto", 42, ["a", "b"]])("devuelve {} para %j", (input) => {
    expect(normalizeKv(input)).toEqual({});
  });
});

describe("buildS3Key / isOwnS3Key", () => {
  it("coloca el objeto bajo el prefijo del usuario y sanea el nombre", () => {
    const key = buildS3Key("u1", "Mi vídeo final (v2).mp4", "uuid");
    expect(key).toMatch(/^users\/u1\/uuid-[\w.-]+\.mp4$/);
    expect(isOwnS3Key("u1", key)).toBe(true);
  });

  it("neutraliza intentos de path traversal en el nombre", () => {
    const key = buildS3Key("u1", "../../otro/x.mp4", "id");
    expect(key.startsWith("users/u1/id-")).toBe(true);
    expect(key.slice("users/u1/".length)).not.toContain("/");
  });

  it("limita la longitud del nombre conservando la extensión", () => {
    const key = buildS3Key("u1", `${"a".repeat(300)}.mp4`, "id");
    expect(key.length).toBeLessThanOrEqual("users/u1/id-".length + 80);
    expect(key.endsWith(".mp4")).toBe(true);
  });

  it("rechaza claves de otro usuario o con ..", () => {
    expect(isOwnS3Key("u1", "users/u2/x.mp4")).toBe(false);
    expect(isOwnS3Key("u1", "users/u1/../u2/x.mp4")).toBe(false);
    expect(isOwnS3Key("u1", "users/u10/x.mp4")).toBe(false);
    expect(isOwnS3Key("u1", "")).toBe(false);
  });
});

describe("buildSearchFilter", () => {
  it("sin texto ni tag solo filtra por usuario", () => {
    expect(buildSearchFilter("u1", "", "")).toEqual({ $and: [{ userId: "u1" }] });
  });

  it("filtra por tag exacto en minúsculas", () => {
    expect(buildSearchFilter("u1", "", " Demo ").$and).toContainEqual({ tags: "demo" });
  });

  it("cada palabra genera un $or sobre nombre, descripción, tags y kv", () => {
    const { $and } = buildSearchFilter("u1", "hola   mundo", "");
    expect($and).toHaveLength(3);
    const or = $and[1].$or;
    expect(or.map((c: object) => Object.keys(c)[0])).toEqual([
      "nombre",
      "descripcion",
      "tags",
      "_kv.k",
      "_kv.v",
    ]);
    expect(or[0].nombre).toEqual({ $regex: "hola", $options: "i" });
  });

  it("interpreta clave:valor como filtro sobre kv.clave", () => {
    const { $and } = buildSearchFilter("u1", "Cliente:acme", "");
    expect($and[1]).toEqual({ "kv.cliente": { $regex: "acme", $options: "i" } });
  });

  it("escapa los términos para evitar inyección de expresiones regulares", () => {
    const { $and } = buildSearchFilter("u1", ".*", "");
    expect($and[1].$or[0].nombre.$regex).toBe("\\.\\*");
  });

  it("limita a 10 términos", () => {
    const q = Array.from({ length: 20 }, (_, i) => `w${i}`).join(" ");
    expect(buildSearchFilter("u1", q, "").$and).toHaveLength(11);
  });
});
