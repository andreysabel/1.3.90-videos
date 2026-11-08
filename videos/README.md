# VideoVault

Plataforma de gestión y reproducción de vídeos con **Next.js 16 (App Router)**, **MongoDB** (driver nativo) y **RustFS** (almacenamiento compatible con S3).

El navegador sube los vídeos **directamente a RustFS** con URLs prefirmadas; el servidor de Next.js solo firma URLs y guarda metadatos, nunca procesa los bytes del vídeo.

## Puesta en marcha

```bash
# 1. Servicios (RustFS API en :9001, consola en :9002, MongoDB en :27017)
docker compose up -d          # o solo `docker compose up -d rustfs` si ya tienes MongoDB local

# 2. Variables de entorno
cp .env.example .env.local   # y cambia JWT_SECRET por un valor aleatorio largo

# 3. App
npm install
npm run dev                  # http://localhost:3000
```

El bucket `videos` se crea automáticamente en la primera subida.

## Estructura

```
proxy.ts                      Redirecciones optimistas según sesión (antes middleware.ts)
lib/
  env.ts                      Variables de entorno validadas (server-only)
  mongodb.ts                  MongoClient singleton + índices
  s3.ts                       S3Client → RustFS (forcePathStyle) + ensureBucket()
  auth.ts                     JWT (jose) en cookie HttpOnly
  types.ts / format.ts        Tipos compartidos y utilidades de formato
context/AuthContext.tsx       Estado de sesión global en el cliente
app/api/
  auth/{register,login,logout,me}
  videos/upload-url           POST → URL PUT prefirmada (15 min) + s3Key
  videos/watch-url            GET  → URL GET prefirmada (1 h) para <video>
  videos/metadata             POST guarda metadatos · GET búsqueda flexible
  dashboard                   Agregación: nº de vídeos, espacio total, tags más usados
app/{page,login,register,dashboard}
components/
  VideoUpload.tsx             Subida directa con barra de progreso real
  VideoPlayer.tsx             <video> con URL prefirmada (se renueva si caduca)
  DashboardView.tsx           Hero + buscador + estadísticas + grid
  StatsPanel.tsx, VideoCard.tsx, Navbar.tsx, AuthForm.tsx
```

## Flujo de subida

1. `VideoUpload` → `POST /api/videos/upload-url` con `{ fileName, contentType, size }`.
2. El servidor valida el JWT, asegura el bucket, genera `users/<userId>/<uuid>-<nombre>` y firma un `PUT` (Content-Type y Content-Length incluidos en la firma).
3. El navegador hace el `PUT` directamente a RustFS.
4. `POST /api/videos/metadata` guarda `{ s3Key, nombre, descripcion, tags, fecha, tamano, userId, kv }`. El tamaño se lee del objeto real con `HeadObject`, no del cliente.

## Búsqueda

`GET /api/videos/metadata?q=...&tag=...`

- Cada palabra de `q` debe aparecer en el nombre, la descripción, los tags o en alguna clave o valor de `kv` (sin distinguir mayúsculas).
- `clave:valor` filtra por un metadato concreto, p. ej. `cliente:acme`.
- `tag` filtra por un tag exacto (al hacer clic en un tag se aplica este filtro).

## Pruebas

```bash
npm test            # Vitest: unitarias + integración (99 pruebas)
npm run test:unit   # solo unitarias (no necesitan servicios)
npm run test:e2e    # Playwright: recorrido completo en Chrome (compila la app)
```

| Nivel | Ubicación | Qué cubre |
|---|---|---|
| Unitarias | `tests/unit` | Formato, validación y saneado (tags, kv, claves S3, filtro de búsqueda), JWT y cookies, redirecciones del `proxy.ts` |
| Integración | `tests/integration` | Las Route Handlers contra MongoDB y RustFS reales: registro y login, URLs prefirmadas (incluido que la firma impide cambiar el tipo o el tamaño), PUT directo, metadatos, búsqueda, aislamiento entre usuarios, bucket privado, peticiones por rangos y agregación del dashboard |
| E2E | `tests/e2e` | Registro, subida de un WebM real generado en el navegador, reproducción en `<video>`, búsqueda, filtro por tag y logout/login |

- Las pruebas de integración usan la BD `videovault_test` y el bucket `videos-test`; las E2E usan `videovault_e2e` y `videos-e2e`. Se vacían antes y después de cada ejecución, así que los datos reales no se tocan.
- Si MongoDB o RustFS no están levantados, las pruebas de integración se omiten con un aviso; las E2E fallan indicando qué servicio falta.
- Las E2E usan el Chrome instalado (`channel: "chrome"`), así que no hace falta `npx playwright install`.

## Decisiones de diseño

- **Las credenciales nunca llegan al cliente.** `lib/env.ts`, `lib/s3.ts` y `lib/auth.ts` importan `server-only`, así que la build falla si se importan desde un Client Component.
- **El bucket es privado.** Solo se reproduce mediante URLs GET temporales, y `watch-url` comprueba que el vídeo pertenece al usuario.
- **Aislamiento por usuario.** Las claves S3 llevan el prefijo `users/<userId>/` y `metadata` rechaza las claves de otro prefijo.
- **Progreso real con `XMLHttpRequest`.** `fetch` no expone el progreso de subida (los request streams requieren HTTP/2 y RustFS local sirve HTTP/1.1), así que el `PUT` usa XHR y su `upload.onprogress`.
- **Checksums desactivados en el SDK** (`requestChecksumCalculation: "WHEN_REQUIRED"`). Las versiones recientes del AWS SDK añaden CRC32 a las URLs prefirmadas, que el navegador no puede calcular.
- **CORS.** `ensureBucket()` intenta aplicar `PutBucketCors`, y `docker-compose.yml` define también `RUSTFS_CORS_ALLOWED_ORIGINS`.
- **Proxy de solo conveniencia.** `proxy.ts` redirige según la cookie, pero cada Route Handler vuelve a verificar el JWT.
