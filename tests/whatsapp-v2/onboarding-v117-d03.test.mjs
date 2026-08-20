import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL(
    "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
    import.meta.url
  ),
  "utf8"
);

test(
  "117-D03 reconoce el mensaje público oficial",
  () => {
    assert.match(
      source,
      /"hola quiero conocer a cartes"/
    );

    assert.match(
      source,
      /function isPublicEntryInput/
    );
  }
);

test(
  "117-D03 entrada pública se considera non-query",
  () => {
    const start =
      source.indexOf(
        "function isNonQueryInput"
      );

    const end =
      source.indexOf(
        "function cleanText",
        start
      );

    const fn =
      source.slice(start, end);

    assert.match(
      fn,
      /isPublicEntryInput\(raw\)/
    );
  }
);

test(
  "117-D03 banner se intercepta antes de reservar consulta",
  () => {
    const processStart =
      source.indexOf(
        "async function processMessage"
      );

    const reserve =
      source.indexOf(
        "d.reservarConsultaMensual",
        processStart
      );

    const publicEntry =
      source.indexOf(
        "if (isPublicEntryInput(text))",
        processStart
      );

    assert.ok(publicEntry > processStart);
    assert.ok(reserve > publicEntry);
  }
);

test(
  "117-D03 banner termina antes de continuar al Core",
  () => {
    const start =
      source.indexOf(
        "if (isPublicEntryInput(text))"
      );

    const end =
      source.indexOf(
        "// WHATSAPP_NON_QUERY_MENU_V019",
        start
      );

    const branch =
      source.slice(start, end);

    assert.match(
      branch,
      /handlePublicEntryWhatsApp/
    );

    assert.match(
      branch,
      /return;/
    );

    assert.doesNotMatch(
      branch,
      /reservarConsultaMensual/
    );
  }
);

test(
  "117-D03 usa created para distinguir cuenta nueva",
  () => {
    assert.match(
      source,
      /isNewAccount:\s*identity\?\.created === true/
    );
  }
);

test(
  "117-D03 cuenta nueva recibe onboarding completo",
  () => {
    const start =
      source.indexOf(
        "async function handlePublicEntryWhatsApp"
      );

    const end =
      source.indexOf(
        "async function sendMainMenu",
        start + 20
      );

    const fn =
      source.slice(start, end);

    assert.match(
      fn,
      /if \(isNewAccount\)/
    );

    assert.match(
      fn,
      /Hola, soy Cartes/
    );

    assert.match(
      fn,
      /no consumen ninguna consulta/
    );
  }
);

test(
  "117-D03 cuenta existente muestra saldo actual",
  () => {
    const start =
      source.indexOf(
        "async function handlePublicEntryWhatsApp"
      );

    const end =
      source.indexOf(
        "async function sendMainMenu",
        start + 20
      );

    const fn =
      source.slice(start, end);

    assert.match(
      fn,
      /Bienvenido de nuevo a Cartes/
    );

    assert.match(
      fn,
      /obtenerEstadoUsoMensual/
    );

    assert.match(
      fn,
      /Consultas disponibles/
    );
  }
);

test(
  "117-D03 solo muestra fechas de suscripción para Plus",
  () => {
    const start =
      source.indexOf(
        "async function handlePublicEntryWhatsApp"
      );

    const end =
      source.indexOf(
        "async function sendMainMenu",
        start + 20
      );

    const fn =
      source.slice(start, end);

    assert.match(
      fn,
      /if \(plan === "plus"\)/
    );

    assert.match(
      fn,
      /resolveSubscriptionDates/
    );
  }
);