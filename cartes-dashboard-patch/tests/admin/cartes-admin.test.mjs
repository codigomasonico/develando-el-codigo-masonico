import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("dashboard Cartes existe y no expone PII", async () => {
  const html = await text("channels/web/public/admin/cartes/index.html");
  const js = await text("channels/web/public/admin/cartes/admin.js");
  assert.match(html, /Administración privada/);
  assert.match(html, /Actividad por usuario/);
  assert.doesNotMatch(js, /identity_value|customer\?\.email|customer\?\.phone/i);
});

test("endpoint de estadísticas exige autorización", async () => {
  const source = await text("netlify/functions/cartes-admin-stats.js");
  assert.match(source, /isAuthorized/);
  assert.match(source, /unauthorized/);
  assert.match(source, /buildCartesAdminStats/);
});

test("estadísticas son de solo lectura", async () => {
  const source = await text("netlify/lib/cartes-admin-stats.js");
  assert.match(source, /store\.list/);
  assert.match(source, /store\.get/);
  assert.doesNotMatch(source, /store\.setJSON|store\.delete\(|store\.set\(/);
});
