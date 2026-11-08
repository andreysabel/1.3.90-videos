import { MongoClient } from "mongodb";
import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Utilidades para dejar limpios la BD y el bucket de test.
 * Se usan desde el globalSetup de Vitest y de Playwright.
 */
export interface TestStores {
  mongodbUri: string;
  mongodbDb: string;
  rustfsEndpoint: string;
  rustfsAccessKey: string;
  rustfsSecretKey: string;
  rustfsBucket: string;
}

function s3Client(stores: TestStores) {
  return new S3Client({
    endpoint: stores.rustfsEndpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: stores.rustfsAccessKey, secretAccessKey: stores.rustfsSecretKey },
  });
}

/** Comprueba que MongoDB y RustFS responden; devuelve los que fallan. */
export async function checkServices(stores: TestStores): Promise<string[]> {
  const down: string[] = [];
  const mongo = new MongoClient(stores.mongodbUri, { serverSelectionTimeoutMS: 2000 });
  try {
    await mongo.db("admin").command({ ping: 1 });
  } catch {
    down.push(`MongoDB (${stores.mongodbUri})`);
  } finally {
    await mongo.close();
  }
  try {
    const res = await fetch(stores.rustfsEndpoint, { signal: AbortSignal.timeout(2000) });
    await res.body?.cancel();
  } catch {
    down.push(`RustFS (${stores.rustfsEndpoint})`);
  }
  return down;
}

export async function dropTestStores(stores: TestStores) {
  if (!stores.mongodbDb.match(/_(test|e2e)$/) || !stores.rustfsBucket.match(/-(test|e2e)$/)) {
    throw new Error("Por seguridad, solo se limpian BD *_test/_e2e y buckets *-test/-e2e");
  }

  const mongo = new MongoClient(stores.mongodbUri, { serverSelectionTimeoutMS: 2000 });
  try {
    await mongo.db(stores.mongodbDb).dropDatabase();
  } finally {
    await mongo.close();
  }

  const s3 = s3Client(stores);
  const Bucket = stores.rustfsBucket;
  try {
    let token: string | undefined;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token }));
      if (page.Contents?.length) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket,
            Delete: { Objects: page.Contents.map((o) => ({ Key: o.Key! })) },
          }),
        );
      }
      token = page.NextContinuationToken;
    } while (token);
    await s3.send(new DeleteBucketCommand({ Bucket }));
  } catch (err) {
    if ((err as Error).name !== "NoSuchBucket") throw err;
  } finally {
    s3.destroy();
  }
}
