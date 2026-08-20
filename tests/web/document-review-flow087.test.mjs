import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source =
  fs.readFileSync(
    new URL(
      "../../channels/web/public/bot/guia-masonico.js",
      import.meta.url
    ),
    "utf8"
  );

function getReviewFunction() {
  const start =
    source.indexOf(
      "async function processDocumentReviewWeb("
    );

  assert.ok(
    start >= 0,
    "Debe existir processDocumentReviewWeb"
  );

  const end =
    source.indexOf(
      "\n  function ",
      start + 30
    );

  assert.ok(
    end > start,
    "Debe poder delimitarse processDocumentReviewWeb"
  );

  return source.slice(start, end);
}

test(
  "V089 helper elimina menú y clases visuales",
  () => {
    const start =
      source.indexOf(
        "function clearDocumentReviewMenuWeb()"
      );

    assert.ok(start >= 0);

    const end =
      source.indexOf(
        "\n  function ",
        start + 20
      );

    const fn =
      source.slice(start, end);

    assert.match(
      fn,
      /ui\.suggestionBox\.replaceChildren\(\)/
    );

    assert.match(
      fn,
      /gm-suggestions--menu/
    );

    assert.match(
      fn,
      /gm-suggestions--main-menu/
    );
  }
);

test(
  "V089 cancelar autorización conserva menú",
  () => {
    const fn = getReviewFunction();

    const cancel =
      fn.indexOf("if (!accepted)");

    const returnPos =
      fn.indexOf("return;", cancel);

    const clear =
      fn.indexOf(
        "clearDocumentReviewMenuWeb();"
      );

    assert.ok(cancel >= 0);
    assert.ok(returnPos > cancel);
    assert.ok(clear > returnPos);
  }
);

test(
  "V089 autorización retira menú antes de procesar",
  () => {
    const fn = getReviewFunction();

    const clear =
      fn.indexOf(
        "clearDocumentReviewMenuWeb();"
      );

    const busy =
      fn.indexOf("setBusy(true);");

    const fetch =
      fn.indexOf(
        "const response = await fetch("
      );

    assert.ok(clear >= 0);
    assert.ok(busy > clear);
    assert.ok(fetch > busy);
  }
);

test(
  "V089 resultado y contador siguen mostrándose",
  () => {
    const fn = getReviewFunction();

    assert.match(
      fn,
      /String\(data\?\.review \|\| ""\)\.trim\(\)/
    );

    assert.match(
      fn,
      /updateReviewUsage\(data\.reviews\)/
    );

    assert.match(
      fn,
      /Revisiones de documentos disponibles:/
    );
  }
);

test(
  "V089 menú permanece oculto al finalizar revisión",
  () => {
    const fn = getReviewFunction();

    const clear =
      fn.indexOf(
        "clearDocumentReviewMenuWeb();"
      );

    const finallyPos =
      fn.indexOf("finally {");

    const busyFalse =
      fn.indexOf(
        "setBusy(false);",
        finallyPos
      );

    const renderAfterClear =
      fn.indexOf(
        "renderMenuButtonsWeb();",
        clear
      );

    assert.ok(clear >= 0);
    assert.ok(finallyPos > clear);
    assert.ok(busyFalse > finallyPos);

    assert.equal(
      renderAfterClear,
      -1,
      "No debe reconstruirse automáticamente el menú"
    );

    assert.match(
      fn,
      /CARTES_DOCUMENT_FLOW_WEB_V089/
    );
  }
);

test(
  "V089 menú sigue disponible cuando usuario lo solicita",
  () => {
    const start =
      source.indexOf(
        "async function mostrarMenuWeb()"
      );

    assert.ok(start >= 0);

    const end =
      source.indexOf(
        "\n  function ",
        start + 20
      );

    const fn =
      source.slice(start, end);

    assert.match(
      fn,
      /renderMenuButtonsWeb\(\)/
    );
  }
);