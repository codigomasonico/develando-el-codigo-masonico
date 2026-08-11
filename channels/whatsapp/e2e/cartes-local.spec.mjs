import { test, expect } from "@playwright/test";

test("el menú usa el título Menú", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Menú" }).first()).toBeVisible();
  await expect(page.getByText("Ver opciones", { exact: true })).toHaveCount(0);
});

test("una entrada inútil muestra el menú y no consume consultas", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Mensaje");
  await input.fill(".");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("No entendí tu mensaje", { exact: false })).toBeVisible();
  await expect(page.getByText("Consultas simuladas: 0/5")).toBeVisible();
});

test("Suscribirme inicia el flujo legal y Mercado Pago sin pedir otro comando", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Suscribirme" }).first().click();
  await expect(page.getByText("Antes de continuar", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Sí, acepto" }).click();
  await expect(page.getByRole("button", { name: "Mercado Pago" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PayPal" })).toHaveCount(0);
});

test("Mi suscripción gratuita no muestra cancelación", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mi suscripción" }).first().click();
  await expect(page.getByText("Cartes gratuito", { exact: true })).toBeVisible();
  await expect(page.getByText("Inactivo", { exact: true })).toBeVisible();
  await expect(page.getByText("0 de 5", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Darme de baja" })).toHaveCount(0);
});

test("las páginas legales cargan", async ({ request }) => {
  await expect((await request.get("/terminos.html")).status()).toBe(200);
  await expect((await request.get("/privacy.html")).status()).toBe(200);
});
