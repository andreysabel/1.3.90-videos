import { expect, test, type Page } from "@playwright/test";

/**
 * Recorrido completo de usuario en un navegador real:
 * registro → subida directa a RustFS → reproducción → búsqueda → logout/login.
 * Las pruebas comparten estado (mismo usuario), por eso se ejecutan en serie.
 */
test.describe.configure({ mode: "serial" });

const user = {
  nombre: "E2E Tester",
  email: `e2e.${Date.now()}@example.com`,
  password: "contraseña-e2e",
};

/**
 * Genera un WebM real de ~1 s dentro del propio navegador (canvas + MediaRecorder),
 * así la prueba no depende de ficheros binarios en el repositorio.
 */
async function recordWebm(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement("canvas"), { width: 160, height: 90 });
    const ctx = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(25), { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));

    recorder.start(100);
    for (let frame = 0; frame < 25; frame++) {
      ctx.fillStyle = `hsl(${frame * 14}, 80%, 50%)`;
      ctx.fillRect(0, 0, 160, 90);
      await new Promise((r) => setTimeout(r, 40));
    }
    recorder.stop();
    await stopped;

    const buffer = await new Blob(chunks, { type: "video/webm" }).arrayBuffer();
    let binary = "";
    for (const b of new Uint8Array(buffer)) binary += String.fromCharCode(b);
    return btoa(binary);
  });
  return Buffer.from(base64, "base64");
}

const search = (page: Page) => page.getByPlaceholder(/Buscar por título/);

test("sin sesión, el dashboard redirige al login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeVisible();
});

test("la landing enlaza al registro", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("bóveda");
  await page.getByRole("link", { name: "Empezar gratis" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("registro y dashboard vacío", async ({ page }) => {
  await page.goto("/register");
  await page.getByPlaceholder("Nombre").fill(user.nombre);
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder(/Contraseña/).fill(user.password);
  await page.getByRole("button", { name: "Registrarme" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(`Hola, ${user.nombre}`)).toBeVisible();
  await expect(page.getByText("Aún no has subido vídeos")).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
});

test("sube un vídeo directo a RustFS, lo cataloga y lo reproduce", async ({ page }) => {
  await login(page);
  const video = await recordWebm(page);
  expect(video.byteLength).toBeGreaterThan(1000);

  // La subida debe ir del navegador a RustFS, nunca a través de Next.js.
  const putToStorage = page.waitForRequest(
    (req) => req.method() === "PUT" && req.url().startsWith("http://localhost:9001/videos-e2e/"),
  );

  await page.locator('input[type="file"]').setInputFiles({
    name: "atardecer-en-la-playa.webm",
    mimeType: "video/webm",
    buffer: video,
  });
  // El título se rellena a partir del nombre del fichero
  await expect(page.getByPlaceholder("Título", { exact: true })).toHaveValue("atardecer-en-la-playa");
  await page.getByPlaceholder("Título", { exact: true }).fill("Atardecer en la playa");
  await page.getByPlaceholder("Descripción", { exact: true }).fill("Grabación de prueba automatizada");
  await page.getByPlaceholder(/Tags separados/).fill("Playa, verano");
  await page.getByPlaceholder("clave (proyecto)").fill("cliente");
  await page.getByPlaceholder("valor (demo)").fill("acme");
  await page.getByRole("button", { name: "Subir vídeo" }).click();

  const put = await putToStorage;
  expect(new URL(put.url()).searchParams.get("X-Amz-Signature")).toBeTruthy();
  expect((await put.response())?.status()).toBe(200);

  await expect(page.getByText("¡Vídeo subido y catalogado!")).toBeVisible();

  // La tarjeta aparece en la biblioteca con sus metadatos
  const card = page.locator("article", { hasText: "Atardecer en la playa" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "#playa" })).toBeVisible();
  await expect(card.getByRole("button", { name: "#verano" })).toBeVisible();
  await expect(card.getByText("cliente:")).toBeVisible();

  // El <video> usa una URL prefirmada y el navegador carga los metadatos del fichero
  const player = card.locator("video");
  await expect(player).toHaveAttribute("src", /localhost:9001\/videos-e2e\/.+X-Amz-Signature=/);
  await expect
    .poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  expect(await player.evaluate((v: HTMLVideoElement) => v.error)).toBeNull();

  // Panel de estadísticas actualizado
  const tile = (label: string) => page.getByText(label, { exact: true }).locator("..");
  await expect(tile("Vídeos subidos")).toContainText("1");
  await expect(tile("Espacio ocupado")).toContainText(/\d+(\.\d)? (KB|B)/);
});

test("busca por texto, por clave:valor y filtra por tag", async ({ page }) => {
  await login(page);
  const card = page.locator("article", { hasText: "Atardecer en la playa" });
  await expect(card).toBeVisible();

  for (const q of ["ATARDECER", "automatizada", "cliente:acme", "verano"]) {
    await search(page).fill(q);
    await expect(page.getByText("1 resultado", { exact: true })).toBeVisible();
    await expect(card).toBeVisible();
  }

  await search(page).fill("no-existe-nada");
  await expect(page.getByText("Ningún vídeo coincide con la búsqueda.")).toBeVisible();

  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(card).toBeVisible();

  // Clic en un tag de la tarjeta → filtro por tag
  await card.getByRole("button", { name: "#playa" }).click();
  await expect(page.getByText("Filtrando por tag")).toBeVisible();
  await expect(card).toBeVisible();
});

test("logout cierra la sesión y el vídeo persiste al volver a entrar", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Credenciales incorrectas")).toBeVisible();

  await login(page);
  await expect(page.locator("article", { hasText: "Atardecer en la playa" })).toBeVisible();
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
