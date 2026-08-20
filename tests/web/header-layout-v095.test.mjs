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

test("V095 separa identidad, acciones y métricas del header", () => {
  const identity = js.indexOf('class="gm-header__identity"');
  const actions = js.indexOf('class="gm-header__actions"');
  const metrics = js.indexOf('class="gm-header__metrics"');
  const usage = js.indexOf('class="gm-header__usage"');
  const reviews = js.indexOf('class="gm-header__reviews"');

  assert.ok(identity >= 0);
  assert.ok(actions > identity);
  assert.ok(metrics > actions);
  assert.ok(usage > metrics);
  assert.ok(reviews > usage);
});

test("V095 conserva los selectores funcionales de contadores", () => {
  assert.match(js, /const usage = shell\.querySelector\("\.gm-header__usage"\)/);
  assert.match(js, /const reviewsUsage = shell\.querySelector\("\.gm-header__reviews"\)/);
});

test("V095 coloca métricas a ancho completo debajo de la fila superior", () => {
  assert.match(css, /CARTES_HEADER_LAYOUT_V095/);
  assert.match(css, /grid-template-areas:\s*"identity actions"\s*"metrics metrics"/);
  assert.match(css, /\.gm-header__metrics\s*\{[\s\S]*?grid-area:\s*metrics[\s\S]*?width:\s*100%/);
});

test("V095 elimina el corte agresivo de palabras en métricas", () => {
  assert.match(
    css,
    /\.gm-header__metrics \.gm-header__usage,[\s\S]*?white-space:\s*nowrap[\s\S]*?overflow-wrap:\s*normal[\s\S]*?word-break:\s*normal/
  );
});
