import test from "node:test";
import assert from "node:assert/strict";
import accesoCartes, { construirUrlAccesoCartes } from "../../channels/whatsapp/functions/cartes-acceso.mjs";
import { readFile } from "node:fs/promises";

test("la URL pública prepara el mensaje inicial de Cartes", () => {
  const url = construirUrlAccesoCartes({ numero: "+52 33 2233 8888" });
  assert.equal(
    url,
    "https://wa.me/523322338888?text=Hola%2C%20quiero%20conocer%20a%20Cartes."
  );
});

test("el acceso público redirige a WhatsApp", async () => {
  const previo = process.env.CARTES_WHATSAPP_NUMBER;
  process.env.CARTES_WHATSAPP_NUMBER = "523322338888";
  try {
    const response = await accesoCartes(new Request("https://cartes.develandoelcodigomasonico.com/"));
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("location"),
      "https://wa.me/523322338888?text=Hola%2C%20quiero%20conocer%20a%20Cartes."
    );
  } finally {
    if (previo === undefined) delete process.env.CARTES_WHATSAPP_NUMBER;
    else process.env.CARTES_WHATSAPP_NUMBER = previo;
  }
});

test("Netlify expone Cartes WhatsApp bajo la ruta unificada", async () => {
  const config = await readFile(new URL("../../netlify.toml", import.meta.url), "utf8");
  assert.match(config, /from\s*=\s*"\/cartes-whatsapp"/);
  assert.match(config, /to\s*=\s*"\/\.netlify\/functions\/cartes-acceso"/);
  assert.match(config, /status\s*=\s*302/);
  assert.match(config, /force\s*=\s*true/);
});

test("la página estática queda solo como respaldo", async () => {
  const html = await readFile(new URL("../../channels/web/public/cartes-whatsapp/index.html", import.meta.url), "utf8");
  assert.match(html, /\.netlify\/functions\/cartes-acceso/);
});
