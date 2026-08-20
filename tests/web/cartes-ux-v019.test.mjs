import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  sendWhatsAppInteractiveList,
  sendWhatsAppReplyButtons
} from "../../channels/whatsapp/functions/lib-meta.mjs";
import { createWhatsAppHandler } from "../../channels/whatsapp/functions/cartes-whatsapp.mjs";

const USER_ID = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("V019 Web: legal usa links y botones, pago no duplica texto + botones", () => {
  const web = fs.readFileSync(new URL("../../channels/web/public/bot/guia-masonico.js", import.meta.url), "utf8");

  assert.match(web, /WEB_SUBSCRIPTION_UX_V019/);
  assert.match(web, /document\.createElement\("a"\)/);
  assert.match(web, /Ver Términos de uso/);
  assert.match(web, /Ver Aviso de privacidad/);
  assert.match(web, /label: "Aceptar"/);
  assert.match(web, /label: "No aceptar"/);
  assert.match(web, /label: "Mercado Pago"/);
  assert.match(web, /label: "PayPal"/);

  const section = web.slice(
    web.indexOf('webSubscriptionFlow = "payment_provider"'),
    web.indexOf('if (webSubscriptionFlow === "payment_provider")')
  );
  assert.doesNotMatch(section, /1\. Mercado Pago|2\. PayPal/);
});

test("V019 Meta: reply buttons genera payload interactive correcto", async () => {
  let payload = null;

  await sendWhatsAppReplyButtons({
    to: "5211111111111",
    phoneNumberId: "999",
    body: "Confirma",
    buttons: [
      { id: "terms_accept", title: "Sí, acepto" },
      { id: "terms_reject", title: "No acepto" }
    ]
  }, {
    env: {
      WHATSAPP_ACCESS_TOKEN: "TOKEN_TEST",
      WHATSAPP_GRAPH_VERSION: "v25.0"
    },
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(init.body);
      return new Response(JSON.stringify({ messages: [{ id: "wamid.TEST" }] }), { status: 200 });
    }
  });

  assert.equal(payload.type, "interactive");
  assert.equal(payload.interactive.type, "button");
  assert.equal(payload.interactive.action.buttons.length, 2);
});

test("V019 Meta: lista principal contiene las seis opciones", async () => {
  let payload = null;

  await sendWhatsAppInteractiveList({
    to: "5211111111111",
    phoneNumberId: "999",
    body: "Menú",
    sections: [{
      title: "Menú principal",
      rows: [
        { id: "1", title: "Uno" },
        { id: "2", title: "Dos" },
        { id: "3", title: "Tres" },
        { id: "4", title: "Cuatro" },
        { id: "5", title: "Cinco" },
        { id: "6", title: "Seis" }
      ]
    }]
  }, {
    env: {
      WHATSAPP_ACCESS_TOKEN: "TOKEN_TEST",
      WHATSAPP_GRAPH_VERSION: "v25.0"
    },
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(init.body);
      return new Response(JSON.stringify({ messages: [{ id: "wamid.TEST" }] }), { status: 200 });
    }
  });

  assert.equal(payload.interactive.type, "list");
  assert.equal(payload.interactive.action.sections[0].rows.length, 6);
});

test("V019 WhatsApp: botón Suscribirme abre aceptación interactiva", async () => {
  const interactive = [];
  let flowSet = null;

  const handler = createWhatsAppHandler({
    env: { META_APP_SECRET: "x" },
    verifyMetaSignature: () => true,
    extractMetaEvents: () => ({
      messages: [{
        id: "wamid.V019.SUB",
        from: "5211111111111",
        phoneNumberId: "999",
        interactive: { list_reply: { id: "menu_suscribirme", title: "Suscribirme" } }
      }],
      statuses: []
    }),
    extractMessageText: () => "",
    claimInboundMessage: async () => true,
    resolverOCrearUsuarioPorIdentidad: async () => ({ user_id: USER_ID }),
    obtenerSuscripcionUsuario: async () => null,
    obtenerPlanUsuario: async () => "gratuito",
    getFlow: async () => null,
    setFlow: async (_userId, flow) => { flowSet = flow; },
    sendWhatsAppReplyButtons: async (args) => { interactive.push(args); },
    sendWhatsAppTextParts: async () => {}
  });

  const response = await handler(new Request("https://qa.invalid", {
    method: "POST",
    body: "{}"
  }));

  assert.equal(response.status, 200);
  assert.equal(flowSet, "accept_terms");
  assert.equal(interactive.length, 1);
  assert.deepEqual(interactive[0].buttons.map(x => x.id), ["terms_accept", "terms_reject", "menu_main"]);
});

test("V019 WhatsApp: botón Aceptar muestra Mercado Pago/PayPal sin texto duplicado", async () => {
  const interactive = [];
  let flowSet = null;

  const handler = createWhatsAppHandler({
    env: { META_APP_SECRET: "x" },
    verifyMetaSignature: () => true,
    extractMetaEvents: () => ({
      messages: [{
        id: "wamid.V019.ACCEPT",
        from: "5211111111111",
        phoneNumberId: "999",
        interactive: { button_reply: { id: "terms_accept", title: "Sí, acepto" } }
      }],
      statuses: []
    }),
    extractMessageText: () => "",
    claimInboundMessage: async () => true,
    resolverOCrearUsuarioPorIdentidad: async () => ({ user_id: USER_ID }),
    obtenerSuscripcionUsuario: async () => null,
    obtenerPlanUsuario: async () => "gratuito",
    getFlow: async () => ({ flow: "accept_terms" }),
    setFlow: async (_userId, flow) => { flowSet = flow; },
    sendWhatsAppReplyButtons: async (args) => { interactive.push(args); },
    sendWhatsAppTextParts: async () => {}
  });

  const response = await handler(new Request("https://qa.invalid", {
    method: "POST",
    body: "{}"
  }));

  assert.equal(response.status, 200);
  assert.equal(flowSet, "payment_provider");
  assert.equal(interactive.length, 1);
  assert.deepEqual(interactive[0].buttons.map(x => x.id), ["payment_mp", "payment_paypal", "menu_main"]);
  assert.doesNotMatch(interactive[0].body, /1\. Mercado Pago|2\. PayPal/);
});

test("V019 WhatsApp: No acepto limpia el flujo y no genera checkout", async () => {
  let clearCalls = 0;
  let checkoutCalls = 0;

  const handler = createWhatsAppHandler({
    env: { META_APP_SECRET: "x" },
    verifyMetaSignature: () => true,
    extractMetaEvents: () => ({
      messages: [{
        id: "wamid.V019.REJECT",
        from: "5211111111111",
        phoneNumberId: "999",
        interactive: { button_reply: { id: "terms_reject", title: "No acepto" } }
      }],
      statuses: []
    }),
    extractMessageText: () => "",
    claimInboundMessage: async () => true,
    resolverOCrearUsuarioPorIdentidad: async () => ({ user_id: USER_ID }),
    obtenerSuscripcionUsuario: async () => null,
    obtenerPlanUsuario: async () => "gratuito",
    getFlow: async () => ({ flow: "accept_terms" }),
    clearFlow: async () => { clearCalls += 1; },
    createCheckoutForCartes: async () => { checkoutCalls += 1; },
    sendWhatsAppInteractiveList: async () => {},
    sendWhatsAppTextParts: async () => {}
  });

  const response = await handler(new Request("https://qa.invalid", {
    method: "POST",
    body: "{}"
  }));

  assert.equal(response.status, 200);
  assert.equal(clearCalls, 1);
  assert.equal(checkoutCalls, 0);
});
