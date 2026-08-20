import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
    import.meta.url
  ),
  "utf8"
);

test(
  "V079 navegación se evalúa antes del consentimiento documental",
  () => {
    const nav =
      source.indexOf(
        "const pendingDocumentNavigationFlow"
      );

    const flow =
      source.indexOf(
        "const flow = await d.getFlow(userId);",
        nav
      );

    assert.ok(nav >= 0);
    assert.ok(flow > nav);
  }
);

test(
  "V079 Mi suscripción puede abandonar consentimiento documental",
  () => {
    assert.match(
      source,
      /pendingDocumentNavigationFlow\?\.flow\s*===\s*[\s\S]*?"document_review_consent"/
    );

    assert.match(
      source,
      /"mi suscripcion"/
    );

    assert.match(
      source,
      /documentNavigationCommands\.has\(normalized\)/
    );

    assert.match(
      source,
      /WA_DOCUMENT_FLOW_NAVIGATION_V079/
    );
  }
);

test(
  "V079 Ayuda y Privacidad también pueden abandonar consentimiento",
  () => {
    assert.match(
      source,
      /"ayuda y soporte"/
    );

    assert.match(
      source,
      /"privacidad y terminos"/
    );
  }
);

test(
  "V079 un error documental limpia el flow antes de responder",
  () => {
    const start =
      source.indexOf(
        "async function procesarDocumentoWhatsApp("
      );

    assert.ok(start >= 0);

    let end =
      source.indexOf(
        "\nasync function ",
        start + 20
      );

    if (end < 0) {
      end = source.length;
    }

    const fn =
      source.slice(start, end);

    const catchPos =
      fn.indexOf(
        "catch (error)"
      );

    const clearPos =
      fn.indexOf(
        "await d.clearFlow(userId)",
        catchPos
      );

    const sendPos =
      fn.indexOf(
        "await d.sendWhatsAppTextParts({",
        clearPos
      );

    assert.ok(catchPos >= 0);
    assert.ok(clearPos > catchPos);
    assert.ok(sendPos > clearPos);
  }
);

test(
  "V079 no cambia los nombres de otros flows",
  () => {
    assert.match(
      source,
      /accept_terms/
    );

    assert.match(
      source,
      /payment_provider/
    );

    assert.match(
      source,
      /confirm_cancel/
    );
  }
);