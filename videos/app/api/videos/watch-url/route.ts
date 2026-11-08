import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { getCollections } from "@/lib/mongodb";
import { BUCKET, getS3Client } from "@/lib/s3";

const WATCH_URL_TTL_SECONDS = 60 * 60; // 1 hora: suficiente para ver el vídeo

/**
 * GET /api/videos/watch-url?s3Key=...   (protegido por JWT)
 * Comprueba que el vídeo pertenece al usuario y devuelve una URL GET
 * temporal para usar como `src` del <video>. El bucket nunca es público.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const s3Key = new URL(request.url).searchParams.get("s3Key");
  if (!s3Key) {
    return NextResponse.json({ error: "Falta el parámetro s3Key" }, { status: 400 });
  }

  const { videos } = await getCollections();
  const video = await videos.findOne({ s3Key, userId: user.id });
  if (!video) {
    return NextResponse.json({ error: "Vídeo no encontrado" }, { status: 404 });
  }

  const watchUrl = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: BUCKET(),
      Key: s3Key,
      ResponseContentType: video.contentType,
    }),
    { expiresIn: WATCH_URL_TTL_SECONDS },
  );

  return NextResponse.json({ watchUrl, expiresIn: WATCH_URL_TTL_SECONDS });
}
