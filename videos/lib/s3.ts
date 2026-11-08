import "server-only";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "./env";

/**
 * Cliente S3 apuntando a RustFS.
 *
 * - `forcePathStyle: true`: RustFS (como MinIO) espera URLs del tipo
 *   http://host:puerto/bucket/clave en lugar de http://bucket.host/clave.
 * - La región es obligatoria para firmar (SigV4) pero RustFS la ignora.
 * - Las credenciales solo existen aquí, en el servidor (`server-only`).
 */
const globalForS3 = globalThis as unknown as {
  _s3Client?: S3Client;
  _bucketReady?: Promise<void>;
};

export function getS3Client(): S3Client {
  globalForS3._s3Client ??= new S3Client({
    endpoint: env.rustfsEndpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.rustfsAccessKey,
      secretAccessKey: env.rustfsSecretKey,
    },
    // Evita que el SDK añada checksums CRC32 a las URLs prefirmadas de PUT:
    // el navegador no los calcula y la subida fallaría con firma inválida.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return globalForS3._s3Client;
}

export const BUCKET = () => env.rustfsBucket;

/**
 * Comprueba que el bucket existe y, si no, lo crea.
 * También aplica una política CORS para que el navegador pueda hacer el
 * PUT/GET directo con las URLs prefirmadas. Se memoiza por proceso.
 */
export function ensureBucket(): Promise<void> {
  globalForS3._bucketReady ??= (async () => {
    const s3 = getS3Client();
    const Bucket = BUCKET();
    try {
      await s3.send(new HeadBucketCommand({ Bucket }));
    } catch (err: unknown) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status !== 404 && (err as Error).name !== "NotFound") throw err;
      await s3.send(new CreateBucketCommand({ Bucket }));
      console.info(`[s3] Bucket "${Bucket}" creado en RustFS`);
    }

    try {
      await s3.send(
        new PutBucketCorsCommand({
          Bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: ["*"],
                AllowedMethods: ["GET", "PUT", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag", "Content-Length", "Content-Range"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
    } catch (err) {
      // Algunas versiones de RustFS no implementan PutBucketCors y ya permiten
      // CORS por defecto (o mediante RUSTFS_CORS_ALLOWED_ORIGINS); no es fatal.
      console.warn("[s3] No se pudo aplicar CORS al bucket:", (err as Error).message);
    }
  })().catch((err) => {
    // Si falla, permitimos reintentar en la siguiente petición.
    globalForS3._bucketReady = undefined;
    throw err;
  });
  return globalForS3._bucketReady;
}
