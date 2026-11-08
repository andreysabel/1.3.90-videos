import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { POST as uploadUrl } from "@/app/api/videos/upload-url/route";
import { GET as watchUrl } from "@/app/api/videos/watch-url/route";
import { GET as searchVideos, POST as saveMetadata } from "@/app/api/videos/metadata/route";
import { GET as dashboard } from "@/app/api/dashboard/route";
import getClientPromise from "@/lib/mongodb";
import { BUCKET, getS3Client } from "@/lib/s3";
import type { DashboardStats, SessionUser, VideoDTO } from "@/lib/types";
import { loginAs, makeUser } from "../support/session";
import { getRequest, jsonRequest, servicesUp } from "../support/http";

/**
 * Integración del ciclo de vida completo de un vídeo contra MongoDB y RustFS
 * reales: URL prefirmada → PUT directo a S3 → metadatos → búsqueda →
 * reproducción → estadísticas. Usa la BD videovault_test y el bucket videos-test.
 */

/** Simula el navegador: pide la URL de subida y hace el PUT directo a RustFS. */
async function uploadVideo(
  user: SessionUser,
  fileName: string,
  bytes: Uint8Array<ArrayBuffer>,
  type = "video/mp4",
) {
  await loginAs(user);
  const res = await uploadUrl(
    jsonRequest("/api/videos/upload-url", { fileName, contentType: type, size: bytes.byteLength }),
  );
  expect(res.status).toBe(200);
  const { uploadUrl: url, s3Key } = await res.json();

  const put = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: bytes });
  expect(put.status).toBe(200);
  return s3Key as string;
}

async function save(user: SessionUser, body: Record<string, unknown>) {
  await loginAs(user);
  return saveMetadata(jsonRequest("/api/videos/metadata", body));
}

async function search(user: SessionUser, query = "") {
  await loginAs(user);
  const res = await searchVideos(getRequest(`/api/videos/metadata${query}`));
  expect(res.status).toBe(200);
  return ((await res.json()).videos as VideoDTO[]).map((v) => v.nombre).sort();
}

const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);

describe.skipIf(!servicesUp)("API de vídeos", () => {
  const alice = makeUser({ nombre: "Alice" });
  const bob = makeUser({ nombre: "Bob" });

  afterAll(async () => {
    await (await getClientPromise()).close();
  });

  describe("todas las rutas exigen sesión", () => {
    it.each([
      ["upload-url", () => uploadUrl(jsonRequest("/api/videos/upload-url", {}))],
      ["watch-url", () => watchUrl(getRequest("/api/videos/watch-url?s3Key=x"))],
      ["metadata POST", () => saveMetadata(jsonRequest("/api/videos/metadata", {}))],
      ["metadata GET", () => searchVideos(getRequest("/api/videos/metadata"))],
      ["dashboard", () => dashboard()],
    ])("%s → 401", async (_, call) => {
      expect((await call()).status).toBe(401);
    });
  });

  describe("POST /api/videos/upload-url", () => {
    it("crea el bucket si no existe y devuelve una URL PUT prefirmada", async () => {
      await loginAs(alice);
      const res = await uploadUrl(
        jsonRequest("/api/videos/upload-url", {
          fileName: "Presentación final.mp4",
          contentType: "video/mp4",
          size: 1234,
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.s3Key).toMatch(new RegExp(`^users/${alice.id}/[0-9a-f-]{36}-.+\\.mp4$`));
      expect(body.expiresIn).toBe(900);
      const url = new URL(body.uploadUrl);
      expect(url.origin).toBe("http://localhost:9001");
      expect(url.pathname).toBe(`/${BUCKET()}/${body.s3Key}`);
      expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
      expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
      // La respuesta solo contiene la URL y la clave, nunca las credenciales.
      expect(Object.keys(body).sort()).toEqual(["expiresIn", "s3Key", "uploadUrl"]);

      await expect(getS3Client().send(new HeadBucketCommand({ Bucket: BUCKET() }))).resolves.toBeDefined();
    });

    it.each([
      [{ fileName: "doc.pdf", contentType: "application/pdf", size: 10 }, /vídeo/],
      [{ fileName: "", contentType: "video/mp4", size: 10 }, /vídeo/],
      [{ fileName: "a.mp4", contentType: "video/mp4", size: 0 }, /Tamaño/],
      [{ fileName: "a.mp4", contentType: "video/mp4", size: 6 * 1024 ** 3 }, /Tamaño/],
    ])("rechaza %j con 400", async (body, message) => {
      await loginAs(alice);
      const res = await uploadUrl(jsonRequest("/api/videos/upload-url", body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(message);
    });

    it("la firma obliga a respetar el Content-Type declarado", async () => {
      await loginAs(alice);
      const res = await uploadUrl(
        jsonRequest("/api/videos/upload-url", { fileName: "a.mp4", contentType: "video/mp4", size: 4 }),
      );
      const { uploadUrl: url } = await res.json();
      const put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "text/html" },
        body: bytes(4),
      });
      expect(put.status).toBe(403);
    });

    it("la firma obliga a respetar el tamaño declarado", async () => {
      await loginAs(alice);
      const res = await uploadUrl(
        jsonRequest("/api/videos/upload-url", { fileName: "a.mp4", contentType: "video/mp4", size: 4 }),
      );
      const { uploadUrl: url } = await res.json();
      const put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
        body: bytes(4000),
      });
      expect(put.ok).toBe(false);
    });
  });

  describe("ciclo completo: subida, metadatos, búsqueda, reproducción y dashboard", () => {
    let demoKey: string;

    beforeAll(async () => {
      demoKey = await uploadVideo(alice, "demo.mp4", bytes(3000, 1));
      const formacion = await uploadVideo(alice, "formacion.webm", bytes(1000, 2), "video/webm");
      const bobKey = await uploadVideo(bob, "bob.mp4", bytes(500, 3));

      const seeds: [SessionUser, Record<string, unknown>][] = [
        [
          alice,
          {
            s3Key: demoKey,
            nombre: "Demo producto",
            descripcion: "Vídeo de lanzamiento de primavera",
            tags: ["Demo", "marketing", "demo"],
            kv: { Proyecto: "launch", cliente: "acme" },
            tamano: 999_999_999, // el servidor debe ignorarlo
          },
        ],
        [
          alice,
          {
            s3Key: formacion,
            nombre: "Formación interna",
            descripcion: "Onboarding del equipo",
            tags: "rrhh, marketing",
            kv: { cliente: "globex" },
          },
        ],
        [bob, { s3Key: bobKey, nombre: "Vídeo de Bob", tags: ["demo"], kv: { cliente: "acme" } }],
      ];
      for (const [user, body] of seeds) {
        expect((await save(user, body)).status).toBe(201);
      }
    });

    it("POST metadata guarda el tamaño y tipo reales leídos de RustFS", async () => {
      const key = await uploadVideo(alice, "extra.mp4", bytes(2048));
      const res = await save(alice, {
        s3Key: key,
        nombre: "  Extra  ",
        tags: [" A ", "a"],
        kv: { "$bad": "x", Ok: 1 },
        tamano: 1,
      });
      expect(res.status).toBe(201);
      const { video } = await res.json();
      expect(video).toMatchObject({
        s3Key: key,
        nombre: "Extra",
        descripcion: "",
        tags: ["a"],
        kv: { ok: "1" },
        tamano: 2048,
        contentType: "video/mp4",
      });
      expect(new Date(video.fecha).getTime()).toBeGreaterThan(Date.now() - 60_000);
      expect(video).not.toHaveProperty("userId");

      // Se registra solo una vez
      expect((await save(alice, { s3Key: key, nombre: "Otra vez" })).status).toBe(409);
    });

    it("POST metadata rechaza claves de otro usuario (403)", async () => {
      const bobKey = await uploadVideo(bob, "privado.mp4", bytes(10));
      const res = await save(alice, { s3Key: bobKey, nombre: "Robado" });
      expect(res.status).toBe(403);
    });

    it("POST metadata devuelve 404 si el objeto no se llegó a subir", async () => {
      const res = await save(alice, { s3Key: `users/${alice.id}/no-existe.mp4`, nombre: "Fantasma" });
      expect(res.status).toBe(404);
    });

    it("POST metadata exige nombre", async () => {
      const res = await save(alice, { s3Key: demoKey, nombre: "   " });
      expect(res.status).toBe(400);
    });

    it("GET metadata lista solo los vídeos del usuario, del más reciente al más antiguo", async () => {
      await loginAs(alice);
      const res = await searchVideos(getRequest("/api/videos/metadata"));
      const { videos } = (await res.json()) as { videos: VideoDTO[] };
      expect(videos.map((v) => v.nombre)).not.toContain("Vídeo de Bob");
      const dates = videos.map((v) => new Date(v.fecha).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));

      expect(await search(bob)).toEqual(["Vídeo de Bob"]);
    });

    it.each([
      ["?q=demo", ["Demo producto"]], // nombre / tag
      ["?q=PRIMAVERA", ["Demo producto"]], // descripción, sin mayúsculas
      ["?q=onboarding", ["Formación interna"]],
      ["?q=marketing", ["Demo producto", "Formación interna"]], // tag compartido
      ["?q=globex", ["Formación interna"]], // valor de kv
      ["?q=proyecto", ["Demo producto"]], // clave de kv
      ["?q=cliente:acme", ["Demo producto"]], // sintaxis clave:valor
      ["?q=cliente:ACM", ["Demo producto"]], // parcial, sin mayúsculas
      ["?q=marketing%20acme", ["Demo producto"]], // varias palabras = AND
      ["?tag=rrhh", ["Formación interna"]],
      ["?tag=marketing&q=demo", ["Demo producto"]],
      ["?q=.*", []], // regex escapada: no lo encuentra todo
      ["?q=inexistente", []],
    ])("búsqueda %s", async (query, expected) => {
      expect(await search(alice, query)).toEqual(expected);
    });

    it("watch-url devuelve una URL GET temporal que sirve el vídeo", async () => {
      await loginAs(alice);
      const res = await watchUrl(getRequest(`/api/videos/watch-url?s3Key=${encodeURIComponent(demoKey)}`));
      expect(res.status).toBe(200);
      const { watchUrl: url, expiresIn } = await res.json();
      expect(expiresIn).toBe(3600);

      const video = await fetch(url);
      expect(video.status).toBe(200);
      expect(video.headers.get("content-type")).toBe("video/mp4");
      expect(new Uint8Array(await video.arrayBuffer())).toEqual(bytes(3000, 1));

      // Admite peticiones por rangos, necesarias para avanzar en el <video>
      const partial = await fetch(url, { headers: { Range: "bytes=0-99" } });
      expect(partial.status).toBe(206);
      expect((await partial.arrayBuffer()).byteLength).toBe(100);
    });

    it("el bucket no es público: sin firma no se puede leer", async () => {
      const res = await fetch(`http://localhost:9001/${BUCKET()}/${demoKey}`);
      expect(res.status).toBe(403);
    });

    it("watch-url no da acceso a vídeos de otro usuario", async () => {
      await loginAs(bob);
      const res = await watchUrl(getRequest(`/api/videos/watch-url?s3Key=${encodeURIComponent(demoKey)}`));
      expect(res.status).toBe(404);
    });

    it("watch-url exige el parámetro s3Key", async () => {
      await loginAs(alice);
      expect((await watchUrl(getRequest("/api/videos/watch-url"))).status).toBe(400);
    });

    it("dashboard agrega nº de vídeos, espacio total, media y tags del usuario", async () => {
      await loginAs(alice);
      const stats = (await (await dashboard()).json()) as DashboardStats;
      // demo (3000) + formación (1000) + extra (2048)
      expect(stats.totalVideos).toBe(3);
      expect(stats.totalBytes).toBe(6048);
      expect(stats.avgBytes).toBe(2016);
      expect(stats.topTags[0]).toEqual({ tag: "marketing", count: 2 });
      expect(stats.topTags.map((t) => t.tag).sort()).toEqual(["a", "demo", "marketing", "rrhh"]);
    });

    it("dashboard de un usuario sin vídeos devuelve ceros", async () => {
      await loginAs(makeUser());
      expect(await (await dashboard()).json()).toEqual({
        totalVideos: 0,
        totalBytes: 0,
        avgBytes: 0,
        topTags: [],
      });
    });
  });
});
