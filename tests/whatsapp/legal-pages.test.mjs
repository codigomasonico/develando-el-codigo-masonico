import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const termsPath = new URL("../../channels/web/public/cartes-whatsapp/terminos.html", import.meta.url);
const privacyPath = new URL("../../channels/web/public/cartes-whatsapp/privacy.html", import.meta.url);

test("las páginas legales existen y usan el correo oficial", async () => {
  const [terms, privacy] = await Promise.all([
    readFile(termsPath, "utf8"),
    readFile(privacyPath, "utf8")
  ]);
  for (const html of [terms, privacy]) {
    assert.match(html, /soporte@develandoelcodigomasonico\.com/);
    assert.doesNotMatch(html, /develandoelcodigomasonico@gmail\.com/);
    assert.match(html, /30 de julio de 2026/);
  }
});

test("los documentos legales se enlazan entre sí", async () => {
  const [terms, privacy] = await Promise.all([
    readFile(termsPath, "utf8"),
    readFile(privacyPath, "utf8")
  ]);
  assert.match(terms, /href="\/cartes-whatsapp\/privacy\.html"/);
  assert.match(privacy, /href="\/cartes-whatsapp\/terminos\.html"/);
});

test("el aviso cubre documentos, pagos y derechos ARCO", async () => {
  const privacy = await readFile(privacyPath, "utf8");
  assert.match(privacy, /Documentos enviados para revisión/);
  assert.match(privacy, /Mercado Pago/);
  assert.match(privacy, /acceso, rectificación, cancelación y oposición/i);
  assert.match(privacy, /se elimina al terminar el intento/);
});

test("los términos reflejan precios y límites aprobados", async () => {
  const terms = await readFile(termsPath, "utf8");
  assert.match(terms, /\$149 MXN al mes/);
  assert.match(terms, /\$99 MXN/);
  assert.match(terms, /máximo de 2 paquetes/);
  assert.match(terms, /máximo de 5 páginas/);
});
