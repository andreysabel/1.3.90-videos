import type { ObjectId } from "mongodb";

/** Documento de la colección `users`. */
export interface UserDoc {
  _id?: ObjectId;
  nombre: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

/** Documento de la colección `videos` (solo metadatos; el binario vive en RustFS). */
export interface VideoDoc {
  _id?: ObjectId;
  s3Key: string;
  nombre: string;
  descripcion: string;
  tags: string[];
  fecha: Date;
  /** Tamaño en bytes */
  tamano: number;
  contentType: string;
  userId: string;
  /** Metadatos clave-valor libres, p. ej. { proyecto: "demo", cliente: "acme" } */
  kv: Record<string, string>;
}

/** Forma serializada que se envía al cliente. */
export interface VideoDTO {
  id: string;
  s3Key: string;
  nombre: string;
  descripcion: string;
  tags: string[];
  fecha: string;
  tamano: number;
  contentType: string;
  kv: Record<string, string>;
}

export interface DashboardStats {
  totalVideos: number;
  totalBytes: number;
  avgBytes: number;
  topTags: { tag: string; count: number }[];
}

export interface SessionUser {
  id: string;
  nombre: string;
  email: string;
}
