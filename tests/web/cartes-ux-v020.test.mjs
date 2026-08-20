import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createWhatsAppHandler } from "../../channels/whatsapp/functions/cartes-whatsapp.mjs";

const USER_ID = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function metaMessage(message) {
  return { messages: [message], statuses: [] };
}

function baseDeps(message, extras = {}) {
  return {
    env: { META_APP_SECRET: "x" },
    verifyMetaSignature: () => true,
    extractMetaEvents: () => metaMessage(message),
    extractMessageText: (m) => m?.text?.body || "",
    claimInboundMessage: async () => true,
    resolverOCrearUsuarioPorIdentidad: async () => ({ user_id: USER_ID }),
    obtenerSuscripcionUsuario: async () => null,
    obtenerPlanUsuario: async () => "gratuito",
    clearFlow: async () => {},
    getFlow: async () => ({ flow: "payment_provider" }),
    sendWhatsAppTextParts: async () => {},
    sendWhatsAppInteractiveList: async () => {},
    sendWhatsAppReplyButtons: async () => {},
    ...extras
  };
}

test("UX actual Web conserva proveedores y Volver al menú", () => {
  const web = fs.readFileSync(
    new URL("../../channels/web/public/bot/guia-masonico.js", import.meta.url),
    "utf8"
  );

  assert.match(web, /label: "Volver al menú", value: "menu"/);
  assert.match(web, /label: "Mercado Pago"/);
  assert.match(web, /label: "PayPal"/);
  assert.match(web, /accepted_terms: true/);
  assert.match(web, /mostrarAccionPagoWeb/);
});

test("UX actual WhatsApp usa lista principal de seis opciones en gratuito", async () => {
  const lists = [];
  const buttons = [];

  const handler = createWhatsAppHandler(baseDeps({
    id: "wamid.CURRENT.MENU",
    from: "5211111111111",
    phoneNumberId: "999",
    type: "text",
    text: { body: "Menú" }
  }, {
    sendWhatsAppInteractiveList: async (args) => { lists.push(args); },
    sendWhatsAppReplyButtons: async (args) => { buttons.push(args); }
  }));

  const response = await handler(
    new Request("https://qa.invalid", { method: "POST", body: "{}" })
  );

  assert.equal(response.status, 200);
  assert.equal(lists.length, 1);
  assert.equal(buttons.length, 0);

  const rows = lists[0].sections.flatMap((section) => section.rows || []);

  assert.deepEqual(
    rows.map((row) => row.id),
    [
      "menu_conversar",
      "menu_plus",
      "menu_suscribirme",
      "menu_suscripcion",
      "menu_ayuda",
      "menu_legal"
    ]
  );
});

test("UX actual WhatsApp Plus oculta opciones comerciales", async () => {
  const lists = [];

  const handler = createWhatsAppHandler(baseDeps({
    id: "wamid.CURRENT.PLUS",
    from: "5211111111111",
    phoneNumberId: "999",
    type: "text",
    text: { body: "Menú" }
  }, {
    obtenerSuscripcionUsuario: async () => ({ plan_actual: "plus" }),
    obtenerPlanUsuario: async () => "plus",
    sendWhatsAppInteractiveList: async (args) => { lists.push(args); }
  }));

  const response = await handler(
    new Request("https://qa.invalid", { method: "POST", body: "{}" })
  );

  assert.equal(response.status, 200);
  assert.equal(lists.length, 1);

  const rows = lists[0].sections.flatMap((section) => section.rows || []);

  assert.deepEqual(
    rows.map((row) => row.id),
    [
      "menu_conversar",
      "menu_document_review",
      "menu_suscripcion",
      "menu_ayuda",
      "menu_legal"
    ]
  );
});

test("UX actual WhatsApp punto abre menú antes de cualquier flow", async () => {
  const lists = [];
  let clearCalls = 0;
  let getFlowCalls = 0;
  let checkoutCalls = 0;

  const handler = createWhatsAppHandler(baseDeps({
    id: "wamid.CURRENT.DOT",
    from: "5211111111111",
    phoneNumberId: "999",
    type: "text",
    text: { body: "." }
  }, {
    clearFlow: async () => { clearCalls += 1; },
    getFlow: async () => {
      getFlowCalls += 1;
      return { flow: "payment_provider" };
    },
    sendWhatsAppInteractiveList: async (args) => { lists.push(args); },
    createCheckoutForCartes: async () => { checkoutCalls += 1; }
  }));

  const response = await handler(
    new Request("https://qa.invalid", { method: "POST", body: "{}" })
  );

  assert.equal(response.status, 200);
  assert.equal(clearCalls, 1);
  assert.equal(getFlowCalls, 0);
  assert.equal(checkoutCalls, 0);
  assert.equal(lists.length, 1);
});

test("UX actual navegación no inicia checkout", async () => {
  let checkoutCalls = 0;

  const handler = createWhatsAppHandler(baseDeps({
    id: "wamid.CURRENT.NOCHECKOUT",
    from: "5211111111111",
    phoneNumberId: "999",
    type: "text",
    text: { body: "Menú" }
  }, {
    createCheckoutForCartes: async () => { checkoutCalls += 1; }
  }));

  await handler(new Request("https://qa.invalid", {
    method: "POST",
    body: "{}"
  }));

  assert.equal(checkoutCalls, 0);
});