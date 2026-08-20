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

test("V097 subtitulo queda fuera del bloque angosto de identidad", () => {
  const identityStart = js.indexOf('class="gm-header__identity"');
  const actionsStart = js.indexOf('class="gm-header__actions"');
  const subtitleStart = js.indexOf('class="gm-header__subtitle gm-header__status"');
  const metricsStart = js.indexOf('class="gm-header__metrics"');

  assert.ok(identityStart >= 0);
  assert.ok(actionsStart > identityStart);
  assert.ok(subtitleStart > actionsStart);
  assert.ok(metricsStart > subtitleStart);

  const identityBlock = js.slice(identityStart, actionsStart);
  assert.doesNotMatch(identityBlock, /Asistente de Develando el Código Masónico/);
});

test("V097 conserva exactamente un subtitulo visible", () => {
  const matches = js.match(/Asistente de Develando el Código Masónico/g) || [];
  assert.equal(matches.length, 1);
});

test("V097 usa una fila completa para el subtitulo", () => {
  assert.match(css, /CARTES_HEADER_LAYOUT_V097/);
  assert.match(
    css,
    /grid-template-areas:\s*"identity actions"\s*"subtitle subtitle"\s*"metrics metrics"/
  );
  assert.match(
    css,
    /\.gm-header__subtitle\s*\{[\s\S]*?grid-area:\s*subtitle[\s\S]*?white-space:\s*nowrap/
  );
});

test("V097 conserva los contadores de V093 y layout V095", () => {
  assert.match(js, /class="gm-header__usage"/);
  assert.match(js, /class="gm-header__reviews"/);
  assert.match(js, /class="gm-header__metrics"/);
});
