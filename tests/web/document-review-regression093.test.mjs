import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const core = fs.readFileSync(
  new URL("../../core/ai/cartes-document-review.mjs", import.meta.url),
  "utf8"
);

const web = fs.readFileSync(
  new URL("../../channels/web/public/bot/guia-masonico.js", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../channels/web/public/bot/guia-masonico.css", import.meta.url),
  "utf8"
);

const wa = fs.readFileSync(
  new URL("../../channels/whatsapp/functions/cartes-whatsapp.mjs", import.meta.url),
  "utf8"
);

function postCommitBlock() {
  const complete =
    core.indexOf("await completarRevisionMensual");

  const ret =
    core.indexOf("return {", complete);

  assert.ok(complete >= 0);
  assert.ok(ret > complete);

  return core.slice(complete, ret);
}

test(
  "V093 no lee estado remoto después de completar la revisión",
  () => {
    assert.match(
      core,
      /CARTES_DOCUMENT_COMMIT_V093/
    );

    assert.doesNotMatch(
      postCommitBlock(),
      /obtenerEstadoRevisionesMensual\s*\(/
    );
  }
);

test(
  "V093 Web muestra únicamente cantidad disponible",
  () => {
    assert.match(
      web,
      /Revisiones de documentos disponibles: \$\{restantes\}/
    );

    assert.doesNotMatch(
      web,
      /Revisiones de documentos disponibles: \$\{restantes\} de \$\{total\}/
    );

    assert.doesNotMatch(
      web,
      /Revisiones disponibles:[^\\\r\n]*\$\{[^}\r\n]*disponibles[^}\r\n]*\} de \$\{/
    );
  }
);

test(
  "V093 WhatsApp muestra únicamente cantidad disponible",
  () => {
    assert.doesNotMatch(
      wa,
      /Revisiones disponibles:[^\\\r\n]*\$\{[^}\r\n]*disponibles[^}\r\n]*\} de \$\{/
    );
  }
);

test(
  "V093 contador Web queda contenido dentro del header",
  () => {
    assert.match(
      css,
      /CARTES_REVIEW_COUNTER_LAYOUT_V093/
    );

    assert.match(
      css,
      /\.gm-header\s*>\s*div:not\(\.gm-header__actions\)[\s\S]*?min-width:\s*0/
    );

    assert.match(
      css,
      /\.gm-header__reviews[\s\S]*?overflow-wrap:\s*anywhere/
    );

    assert.match(
      css,
      /\.gm-header__reviews[\s\S]*?white-space:\s*normal/
    );
  }
);
