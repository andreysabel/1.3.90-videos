import type { TestProject } from "vitest/node";
import { checkServices, dropTestStores, type TestStores } from "./cleanup";

/**
 * Antes de toda la suite: comprueba servicios y parte de una BD/bucket vacíos.
 * Si MongoDB o RustFS no están levantados, las pruebas de integración se
 * saltan (las unitarias siguen ejecutándose).
 */
export default async function setup(project: TestProject) {
  const env = project.config.env as Record<string, string>;
  const stores: TestStores = {
    mongodbUri: env.MONGODB_URI,
    mongodbDb: env.MONGODB_DB,
    rustfsEndpoint: env.RUSTFS_ENDPOINT,
    rustfsAccessKey: env.RUSTFS_ACCESS_KEY,
    rustfsSecretKey: env.RUSTFS_SECRET_KEY,
    rustfsBucket: env.RUSTFS_BUCKET,
  };

  const down = await checkServices(stores);
  project.provide("servicesDown", down);
  if (down.length) {
    console.warn(`\n⚠ Servicios no disponibles: ${down.join(", ")}. Se omiten las pruebas de integración.\n`);
    return;
  }

  await dropTestStores(stores);
  return () => dropTestStores(stores);
}

declare module "vitest" {
  export interface ProvidedContext {
    servicesDown: string[];
  }
}
