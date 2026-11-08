import { NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { MongoServerError } from "mongodb";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { getCollections } from "@/lib/mongodb";
import { BUCKET, getS3Client } from "@/lib/s3";
import { buildSearchFilter, isOwnS3Key, normalizeKv, normalizeTags } from "@/lib/validation";
import type { VideoDoc, VideoDTO } from "@/lib/types";

function toDTO(doc: VideoDoc): VideoDTO {
  return {
    id: doc._id!.toHexString(),
    s3Key: doc.s3Key,
    nombre: doc.nombre,
    descripcion: doc.descripcion,
    tags: doc.tags,
    fecha: doc.fecha.toISOString(),
    tamano: doc.tamano,
    contentType: doc.contentType,
    kv: doc.kv ?? {},
  };
}

/**
 * POST /api/videos/metadata
 * Guarda los metadatos tras una subida correcta. El tamaño y el tipo se leen
 * del propio objeto en RustFS (HeadObject), así no dependemos de lo que diga
 * el cliente y verificamos que la subida realmente se completó.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const s3Key = String(body?.s3Key ?? "");
  const nombre = String(body?.nombre ?? "").trim().slice(0, 200);
  const descripcion = String(body?.descripcion ?? "").trim().slice(0, 2000);

  // Un usuario solo puede registrar objetos bajo su propio prefijo.
  if (!isOwnS3Key(user.id, s3Key)) {
    return NextResponse.json({ error: "s3Key no válida" }, { status: 403 });
  }
  if (!nombre) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  let head;
  try {
    head = await getS3Client().send(new HeadObjectCommand({ Bucket: BUCKET(), Key: s3Key }));
  } catch {
    return NextResponse.json({ error: "El vídeo no existe en el almacenamiento" }, { status: 404 });
  }

  const doc: VideoDoc = {
    s3Key,
    nombre,
    descripcion,
    tags: normalizeTags(body?.tags),
    fecha: new Date(),
    tamano: head.ContentLength ?? 0,
    contentType: head.ContentType ?? "video/mp4",
    userId: user.id,
    kv: normalizeKv(body?.kv),
  };

  const { videos } = await getCollections();
  try {
    const { insertedId } = await videos.insertOne(doc);
    return NextResponse.json({ video: toDTO({ ...doc, _id: insertedId }) }, { status: 201 });
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      return NextResponse.json({ error: "Ese vídeo ya está registrado" }, { status: 409 });
    }
    throw err;
  }
}

/**
 * GET /api/videos/metadata?q=texto&tag=x
 * Búsqueda flexible sobre los vídeos del usuario (ver buildSearchFilter).
 * `kv` es un objeto libre sin esquema, por eso se convierte con
 * $objectToArray para poder buscar en sus claves y valores.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const filter = buildSearchFilter(user.id, params.get("q") ?? "", params.get("tag") ?? "");

  const { videos } = await getCollections();
  const docs = await videos
    .aggregate<VideoDoc>([
      { $match: { userId: user.id } },
      { $addFields: { _kv: { $objectToArray: { $ifNull: ["$kv", {}] } } } },
      { $match: filter },
      { $project: { _kv: 0 } },
      { $sort: { fecha: -1 } },
      { $limit: 100 },
    ])
    .toArray();

  return NextResponse.json({ videos: docs.map(toDTO) });
}
