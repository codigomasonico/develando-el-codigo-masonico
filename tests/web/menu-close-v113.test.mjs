import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../channels/web/public/bot/guia-masonico.js",
    import.meta.url
  ),
  "utf8"
);

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.ok(start >= 0, `No se encontró ${startMarker}`);
  assert.ok(end > start, `No se encontró ${endMarker}`);

  return source.slice(start, end);
}

const menuHandler = section(
  "async function ejecutarOpcionMenuWeb(opcion) {",
  "// WEB_SUBSCRIPTION_FLOW_V018"
);

test(
  "V113 seleccionar una opción no reconstruye el menú principal",
  () => {
    assert.doesNotMatch(
      menuHandler,
      /renderMenuButtonsWeb\(\);/
    );

    assert.match(
      menuHandler,
      /restoreDefaultSuggestionsWeb\(\);/
    );
  }
);

test(
  "V113 Revisar documento cierra el menú antes de abrir archivo",
  () => {
    assert.match(
      menuHandler,
      /restoreDefaultSuggestionsWeb\(\);\s*ui\.documentInput\.value = "";\s*ui\.documentInput\.click\(\);/
    );
  }
);

test(
  "V113 Mi suscripción gratuito vuelve a sugerencias y no al menú",
  () => {
    assert.match(
      source,
      /webSubscriptionFlow = "";\s*restoreDefaultSuggestionsWeb\(\);/
    );

    assert.doesNotMatch(
      source,
      /webSubscriptionFlow = "";\s*renderMenuButtonsWeb\(\);/
    );
  }
);

test(
  "V113 Mi suscripción Plus conserva botones de acciones",
  () => {
    assert.match(
      source,
      /webSubscriptionFlow = "subscription_actions";\s*renderSubscriptionActionsWeb\(actions\);/
    );
  }
);

test(
  "V113 comando Menú sigue pudiendo abrir el menú",
  () => {
    assert.match(
      source,
      /async function mostrarMenuWeb\(\)[\s\S]*?renderMenuButtonsWeb\(\);/
    );
  }
);