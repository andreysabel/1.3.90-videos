import "server-only";

/**
 * Lectura centralizada y validada de variables de entorno.
 * `server-only` garantiza que este módulo (y por tanto las credenciales
 * de RustFS y el secreto JWT) nunca acaben en el bundle del cliente.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (revisa .env.local)`);
  }
  return value;
}

export const env = {
  get mongodbUri() {
    return required("MONGODB_URI");
  },
  get mongodbDb() {
    return required("MONGODB_DB");
  },
  get rustfsEndpoint() {
    return required("RUSTFS_ENDPOINT");
  },
  get rustfsAccessKey() {
    return required("RUSTFS_ACCESS_KEY");
  },
  get rustfsSecretKey() {
    return required("RUSTFS_SECRET_KEY");
  },
  get rustfsBucket() {
    return required("RUSTFS_BUCKET");
  },
  get jwtSecret() {
    return required("JWT_SECRET");
  },
};
