import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const js = fs.readFileSync(
  new URL("../../channels/web/public/bot/guia-masonico.js", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../channels/web/public/bot/guia-masonico.css", import.meta.url),
  "utf8"
);

test("Revisar documento está dentro del menú Plus", () => {
  assert.match(js, /\["7", "Revisar documento"\]/);
  assert.match(js, /"7": "revisar_documento"/);
  assert.match(js, /ui\.documentInput\.click\(\)/);
});

test("ya no existe botón documental independiente", () => {
  assert.doesNotMatch(js, /gm-document-upload/);
  assert.doesNotMatch(js, />📎 Subir documento</);
});

test("contador documental tiene selector propio", () => {
  assert.match(js, /class="gm-header__reviews"/);
  assert.doesNotMatch(js, /class="gm-header__usage gm-header__reviews"/);
  assert.match(js, /Revisiones de documentos disponibles:/);
});

test("consultas y revisiones comparten estilo pero no clase", () => {
  assert.match(
    css,
    /\.gm-header__usage,\s*\.gm-header__reviews\s*\{/
  );
});