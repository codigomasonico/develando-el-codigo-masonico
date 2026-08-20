import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test(
  "V115E3 endpoint Web inicia cambio con lookup existente",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../core/ai/cartes-link.mjs",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /action === "start_change_whatsapp"/
    );

    assert.match(
      source,
      /resolverUsuarioExistentePorIdentidad/
    );

    assert.match(
      source,
      /iniciarCambioNumeroWhatsApp/
    );

    const actionStart =
      source.indexOf(
        'action === "start_change_whatsapp"'
      );

    const actionEnd =
      source.indexOf(
        'action === "unlink_whatsapp"',
        actionStart
      );

    const block =
      source.slice(
        actionStart,
        actionEnd
      );

    assert.ok(actionStart >= 0);
    assert.ok(actionEnd > actionStart);

    assert.doesNotMatch(
      block,
      /resolverOCrearUsuarioPorIdentidad/
    );
  }
);

test(
  "V115E3 Web ofrece cambiar número con confirmación y código",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../channels/web/public/bot/guia-masonico.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /label: "Cambiar número de WhatsApp"/
    );

    assert.match(
      source,
      /confirm_change_whatsapp/
    );

    assert.match(
      source,
      /action: "start_change_whatsapp"/
    );

    assert.match(
      source,
      /Código generado: \$\{instruction\}/
    );

    assert.match(
      source,
      /número actual seguirá vinculado/
    );
  }
);

test(
  "V115E3 WhatsApp procesa CAMBIAR antes de VINCULAR y antes de resolver identidad",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
          import.meta.url
        ),
        "utf8"
      );

    const processStart =
      source.indexOf(
        "async function processMessage("
      );

    assert.ok(processStart >= 0);

    const tail =
      source.slice(processStart);

    const change =
      tail.indexOf(
        "const changeMatch"
      );

    const link =
      tail.indexOf(
        "const linkMatch"
      );

    const resolve =
      tail.indexOf(
        "resolverOCrearUsuarioPorIdentidad"
      );

    assert.ok(change >= 0);
    assert.ok(link > change);
    assert.ok(resolve > change);

    assert.match(
      tail,
      /completarCambioNumeroWhatsApp/
    );

    assert.match(
      tail,
      /whatsappPhone:\s*phone/
    );
  }
);

test(
  "V115E3 WhatsApp permite iniciar cambio desde el número actual",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /id: "change_whatsapp_confirm"/
    );

    assert.match(
      source,
      /d\.iniciarCambioNumeroWhatsApp/
    );

    assert.match(
      source,
      /CAMBIAR NÚMERO/
    );

    assert.match(
      source,
      /Este número actual seguirá vinculado/
    );

    assert.match(
      source,
      /identity_in_use/
    );
  }
);

test(
  "V115E3 no agrega cambio de número al menú principal WhatsApp",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
          import.meta.url
        ),
        "utf8"
      );

    const start =
      source.indexOf(
        "async function sendMainMenu("
      );

    assert.ok(start >= 0);

    const tail =
      source.slice(start);

    const next =
      tail
        .slice(1)
        .search(
          /\n(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/
        );

    const block =
      next >= 0
        ? tail.slice(
            0,
            next + 1
          )
        : tail;

    assert.doesNotMatch(
      block,
      /change_whatsapp/
    );

    assert.doesNotMatch(
      block,
      /Cambiar número/
    );
  }
);