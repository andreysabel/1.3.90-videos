Actúa como un Desarrollador Fullstack Senior experto en Next.js, bases de datos y DevOps. Quiero construir un proyecto llamado "VideoVault", una plataforma de gestión y reproducción de vídeos utilizando Next.js 16 (App Router), MongoDB (driver nativo) y RustFS (almacenamiento de objetos compatible con S3). 

El objetivo es permitir que el cliente (browser) suba vídeos pesados de forma directa y segura a nuestro almacenamiento RustFS local usando URLs prefirmadas (presigned URLs), evitando que el servidor de Next.js consuma ancho de banda o procese los gigabytes del vídeo.

Por favor, genera toda la estructura del proyecto y los archivos clave basados en las siguientes especificaciones:

---

### 1. ARQUITECTURA Y CONFIGURACIÓN

#### Variables de Entorno (.env.local)
Crea y utiliza exactamente estas variables:
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=videovault
RUSTFS_ENDPOINT=http://localhost:9001
RUSTFS_ACCESS_KEY=rustfsadmin
RUSTFS_SECRET_KEY=rustfsadmin
RUSTFS_BUCKET=videos
JWT_SECRET=your-secret-key-here

#### Clientes de Conexión (Backend)
- `lib/mongodb.ts`: Inicializa y exporta el cliente nativo de MongoDB (`MongoClient`) con patrón singleton.
- `lib/s3.ts`: Configura el cliente de AWS SDK (`@aws-sdk/client-s3`) apuntando al endpoint de RustFS (`http://localhost:9001`) con soporte para path-style addressing (`forcePathStyle: true`) y las credenciales indicadas.

---

### 2. FUNCIONALIDADES & RUTAS API (Next.js backend)

#### A. Autenticación (JWT & bcryptjs)
- `api/auth/register`: Registro de usuario, hasheando la contraseña.
- `api/auth/login`: Validación y generación de un JWT (guardado en HttpOnly cookie).

#### B. Generación de URLs Prefirmadas (Seguridad)
- `api/videos/upload-url`: Endpoint protegido por JWT. Debe:
  1. Verificar o crear de forma automática el bucket "videos" en RustFS si no existe.
  2. Generar un identificador único (UUID o timestamp) para el video.
  3. Crear una URL prefirmada de subida (PUT) mediante `@aws-sdk/s3-request-presigner` con expiración corta (ej. 15 minutos).
  4. Devolver la URL de subida (`uploadUrl`) y el identificador final (`s3Key`).

- `api/videos/watch-url`: Endpoint que recibe la `s3Key`, valida la sesión, y genera una URL de lectura temporal (GET) para reproducir el vídeo con seguridad en el reproductor HTML5 sin exponer el archivo de forma pública ni perpetua.

#### C. Gestión de Metadatos (MongoDB nativo)
- `api/videos/metadata`: 
  - `POST`: Guarda el documento del video con { s3Key, nombre, descripción, tags (array), fecha, tamaño, userId, kv (objeto clave-valor libre, ej: { proyecto: "demo", cliente: "acme" }) }.
  - `GET`: Permite buscar por palabras clave (nombre, descripción, tags, etc.) usando consultas flexibles de MongoDB, listando los videos.

- `api/dashboard`: Pipeline de agregación de MongoDB para calcular el total de vídeos subidos y la suma total de espacio ocupado (`tamaño`).

---

### 3. INTERFAZ DE USUARIO (Next.js frontend y Tailwind CSS)

- `components/VideoUpload.tsx`: Componente de subida. Debe solicitar la URL prefirmada al API de Next.js, y luego usar `fetch(uploadUrl, { method: 'PUT', body: archivo })` mostrando el progreso real. Tras completarse con éxito, envía los metadatos al backend de MongoDB (`POST api/videos/metadata`).
- `components/VideoPlayer.tsx`: Reproductor HTML5 (`<video src={watchUrl} controls />`) que cargue dinámicamente la URL prefirmada obtenida de `watch-url`.
- `app/dashboard/page.tsx`: Vista profesional y landing (landing page con diseño moderno) que incluya:
  - Buscador global por tags, título, descripción y metadatos.
  - El grid de reproducción de videos.
  - Panel informativo del dashboard (estadísticas de uso y espacio consumido).

Por favor, escribe el código de manera modular, limpia, segura, documentando los pasos más importantes y garantizando que las credenciales S3 (RustFS) nunca se expongan al cliente.