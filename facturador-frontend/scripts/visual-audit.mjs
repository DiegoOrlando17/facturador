// Capturas de todas las rutas en tres anchos para comparar antes/después de cada fase.
//
// Requisitos: API y Vite corriendo, playwright-core instalado (npm i -D playwright-core)
// y un Chromium local. Solo navega: no hace clicks en acciones.
//
// Variables:
//   VISUAL_BASE_URL     (default http://localhost:5173)
//   VISUAL_OUT          (default ./visual-audit-output)
//   VISUAL_CHROMIUM     ruta a chrome.exe (default: Chromium de Playwright en %LOCALAPPDATA%)
//   VISUAL_ADMIN_EMAIL / VISUAL_ADMIN_PASSWORD
//   VISUAL_TENANT_SLUG / VISUAL_TENANT_EMAIL / VISUAL_TENANT_PASSWORD
//
// Uso: node scripts/visual-audit.mjs

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.VISUAL_BASE_URL || "http://localhost:5173";
const outDir = path.resolve(process.env.VISUAL_OUT || "visual-audit-output");
const executablePath =
  process.env.VISUAL_CHROMIUM ||
  path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1243/chrome-win64/chrome.exe");

const admin = {
  email: process.env.VISUAL_ADMIN_EMAIL,
  password: process.env.VISUAL_ADMIN_PASSWORD,
};
const tenant = {
  slug: process.env.VISUAL_TENANT_SLUG,
  email: process.env.VISUAL_TENANT_EMAIL,
  password: process.env.VISUAL_TENANT_PASSWORD,
};

const viewports = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "tablet", width: 900, height: 1000 },
  { tag: "mobile", width: 390, height: 844 },
];

const publicRoutes = ["/", "/registro", "/tutoriales", "/verificar-email?token=invalido", "/recuperar-contrasena", "/restablecer-contrasena?token=invalido", "/login", "/portal-cliente/login", "/ruta-inexistente"];
const adminRoutes = [
  "/admin",
  "/admin/tenants",
  "/admin/tenants?tab=onboarding",
  "/admin/billing",
  "/admin/integrations",
  "/admin/alerts",
  "/admin/audit",
  "/admin/account",
  "/admin/admins",
  "/admin/settings",
];
const portalRoutes = [
  "/portal-cliente",
  "/portal-cliente/pagos",
  "/portal-cliente/comprobantes",
  "/portal-cliente/reportes",
  "/portal-cliente/perfil-fiscal",
  "/portal-cliente/integraciones",
  "/portal-cliente/onboarding",
  "/portal-cliente/suscripcion",
];

function fileName(tag, route) {
  const slug = route.replace(/[/?=&]+/g, "_").replace(/^_+|_+$/g, "") || "inicio";
  return path.join(outDir, `${tag}-${slug}.png`);
}

async function capture(page, tag, route, report) {
  const errors = [];
  const onConsole = (message) => {
    if (message.type() === "error") errors.push(message.text());
  };
  page.on("console", onConsole);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: fileName(tag, route), fullPage: true });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  report.push({ tag, route, overflow: scrollWidth > viewportWidth ? scrollWidth : null, errors: errors.length });
  page.off("console", onConsole);
}

async function loginAdmin(page) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', admin.email);
  await page.fill('input[type="password"]', admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/);
}

async function loginTenant(page) {
  await page.goto(`${baseUrl}/portal-cliente/login`);
  await page.waitForSelector("input");
  const inputs = await page.$$("input");
  await inputs[0].fill(tenant.slug);
  await inputs[1].fill(tenant.email);
  await inputs[2].fill(tenant.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath });
const report = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  for (const route of publicRoutes) await capture(page, viewport.tag, route, report);
  if (admin.email && admin.password) {
    await loginAdmin(page);
    for (const route of adminRoutes) await capture(page, viewport.tag, route, report);
  }
  if (tenant.slug && tenant.email && tenant.password) {
    await loginTenant(page);
    for (const route of portalRoutes) await capture(page, viewport.tag, route, report);
  }
  await context.close();
}

await browser.close();

console.table(report);
const overflowing = report.filter((row) => row.overflow);
if (overflowing.length) {
  console.log(`\n${overflowing.length} capturas con desborde horizontal.`);
}
console.log(`Capturas en ${outDir}`);
