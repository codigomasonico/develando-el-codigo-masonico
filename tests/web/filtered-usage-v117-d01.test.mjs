import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const whatsapp = readFileSync(
  new URL(
    "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
    import.meta.url
  ),
  "utf8"
);

const web = readFileSync(
  new URL(
    "../../core/ai/guia-masonico.mjs",
    import.meta.url
  ),
  "utf8"
);

test("117-D01 WhatsApp detecta filtered", () => {
  assert.match(
    whatsapp,
    /const filtered = data\?\.filtered === true;/
  );
});

test("117-D01 WhatsApp filtered libera y no completa esa rama", () => {
  assert.match(
    whatsapp,
    /if \(filtered\) \{[\s\S]*?liberarConsultaMensual[\s\S]*?\} else \{[\s\S]*?completarConsultaMensual/
  );
});

test("117-D01 Web detecta filtered", () => {
  assert.match(
    web,
    /coreData\?\.filtered === true/
  );
});

test("117-D01 Web libera filtered o respuesta vacia", () => {
  assert.match(
    web,
    /if \(filtered \|\| !coreAnswer\) \{[\s\S]*?liberarConsultaMensual/
  );
});

test("117-D01 Web no guarda filtered en memoria", () => {
  assert.match(
    web,
    /data\?\.filtered !== true/
  );
});

test("117-D01 Web devuelve usage posterior", () => {
  assert.match(
    web,
    /obtenerEstadoUsoMensual[\s\S]*?usageResponse/
  );
});