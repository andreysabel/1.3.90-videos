import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env";
import type { UserDoc, VideoDoc } from "./types";

/**
 * Cliente nativo de MongoDB con patrón singleton.
 *
 * En desarrollo, el hot-reload de Next.js re-evalúa los módulos en cada cambio;
 * guardamos la promesa de conexión en `globalThis` para no abrir una conexión
 * nueva (y agotar el pool) en cada recarga.
 */
const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoIndexesReady?: Promise<void>;
};

function getClientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(env.mongodbUri);
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

/** Crea (una sola vez por proceso) los índices que necesita la aplicación. */
async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection<VideoDoc>("videos").createIndex({ s3Key: 1 }, { unique: true }),
    db.collection<VideoDoc>("videos").createIndex({ userId: 1, fecha: -1 }),
    db.collection<VideoDoc>("videos").createIndex({ tags: 1 }),
  ]);
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = client.db(env.mongodbDb);
  globalForMongo._mongoIndexesReady ??= ensureIndexes(db);
  await globalForMongo._mongoIndexesReady;
  return db;
}

export async function getCollections() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("users"),
    videos: db.collection<VideoDoc>("videos"),
  };
}

export default getClientPromise;
