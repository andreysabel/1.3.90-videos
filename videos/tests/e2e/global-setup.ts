import { e2eEnv } from "../../playwright.config";
import { checkServices, dropTestStores, type TestStores } from "../support/cleanup";

const stores: TestStores = {
  mongodbUri: e2eEnv.MONGODB_URI,
  mongodbDb: e2eEnv.MONGODB_DB,
  rustfsEndpoint: e2eEnv.RUSTFS_ENDPOINT,
  rustfsAccessKey: e2eEnv.RUSTFS_ACCESS_KEY,
  rustfsSecretKey: e2eEnv.RUSTFS_SECRET_KEY,
  rustfsBucket: e2eEnv.RUSTFS_BUCKET,
};

/** Falla pronto si faltan servicios y parte de una BD y un bucket vacíos. */
export default async function globalSetup() {
  const down = await checkServices(stores);
  if (down.length) {
    throw new Error(
      `Servicios no disponibles: ${down.join(", ")}. Arranca MongoDB y RustFS (docker compose up -d rustfs).`,
    );
  }
  await dropTestStores(stores);
  return () => dropTestStores(stores);
}
