import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL(
    "../../channels/web/public/bot/guia-masonico.css",
    import.meta.url
  ),
  "utf8"
);

test("V075 aplica border-box a todo el widget Cartes", () => {
  assert.match(
    css,
    /\.gm-shell,\s*\.gm-shell \*\s*\{\s*box-sizing:\s*border-box/
  );
});

test("V075 evita overflow horizontal del panel y mensajes", () => {
  assert.match(
    css,
    /\.gm-shell\s*\{\s*overflow-x:\s*hidden/
  );

  assert.match(
    css,
    /\.gm-messages\s*\{[\s\S]*?overflow-x:\s*hidden/
  );
});

test("V075 mantiene el menú principal dentro del panel", () => {
  assert.match(
    css,
    /\.gm-suggestions\.gm-suggestions--main-menu\s*\{[\s\S]*?width:\s*calc\(100% - 24px\)/
  );

  assert.match(
    css,
    /margin-left:\s*12px/
  );

  assert.match(
    css,
    /margin-right:\s*12px/
  );
});

test("V075 mantiene botones e input dentro de su contenedor", () => {
  assert.match(
    css,
    /\.gm-suggestions--main-menu \.gm-suggestion\s*\{[\s\S]*?width:\s*100%/
  );

  assert.match(
    css,
    /\.gm-input\s*\{[\s\S]*?max-width:\s*100%/
  );
});