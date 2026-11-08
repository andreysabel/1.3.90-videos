import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { BUCKET, ensureBucket, getS3Client } from "@/lib/s3";
import { buildS3Key } from "@/lib/validation";

const UPLOAD_URL_TTL_SECONDS = 15 * 60; // 15 minutos
const MAX_SIZE_BYTES = 5 * 1024 ** 3; // 5 GB: límite de un PUT simple en S3

/**
 * POST /api/videos/upload-url   (protegido por JWT)
 * Body: { fileName, contentType, size }
 *
 * 1. Asegura que el bucket existe en RustFS (lo crea si no).
 * 2. Genera una clave única: users/<userId>/<uuid>-<nombre-saneado>.
 * 3. Firma una URL PUT válida 15 minutos.
 * El navegador sube el fichero directamente a RustFS con esa URL:
 * el servidor de Next.js nunca recibe los bytes del vídeo.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const fileName = String(body?.fileName ?? "");
  const contentType = String(body?.contentType ?? "");
  const size = Number(body?.size ?? 0);

  if (!fileName || !contentType.startsWith("video/")) {
    return NextResponse.json({ error: "Solo se admiten ficheros de vídeo" }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Tamaño de fichero no válido (máx. 5 GB)" }, { status: 400 });
  }

  try {
    await ensureBucket();
  } catch (err) {
    console.error("[upload-url] RustFS no disponible:", err);
    return NextResponse.json(
      { error: "El almacenamiento de vídeos no está disponible" },
      { status: 503 },
    );
  }

  const s3Key = buildS3Key(user.id, fileName, randomUUID());

  // ContentType y ContentLength forman parte de la firma: el navegador
  // debe enviar exactamente esos valores o RustFS rechazará la subida.
  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: s3Key,
      ContentType: contentType,
      ContentLength: size,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      // Por defecto el presigner no firma Content-Type: lo forzamos para que
      // la URL solo sirva para subir el tipo de vídeo declarado.
      signableHeaders: new Set(["content-type"]),
    },
  );

  return NextResponse.json({ uploadUrl, s3Key, expiresIn: UPLOAD_URL_TTL_SECONDS });
}
