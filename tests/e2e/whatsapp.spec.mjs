import { CARTES_FREE_QUERY_LIMIT, CARTES_PLUS_QUERY_LIMIT } from "../../core/ai/config.mjs";
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

import {
  createWhatsAppHandler
} from '../../channels/whatsapp/functions/cartes-whatsapp.mjs';

import {
  extractMetaEvents,
  extractMessageText,
  verifyMetaSignature
} from '../../channels/whatsapp/functions/lib-meta.mjs';

import {
  normalizePayPalSubscription
} from '../../channels/whatsapp/functions/lib-paypal.mjs';

const SECRET = 'e2e-meta-secret';
const PHONE = '5218115774235';
const PHONE_ID = '1205856839283337';
const USER_ID = 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function payload(text, id) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-e2e',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+52 33 2233 8888',
            phone_number_id: PHONE_ID
          },
          contacts: [{
            wa_id: PHONE,
            profile: { name: 'QA' }
          }],
          messages: [{
            from: PHONE,
            id,
            timestamp: '1700000000',
            type: 'text',
            text: { body: text }
          }]
        }
      }]
    }]
  };
}

function signedRequest(body) {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');

  const signature =
    'sha256=' +
    crypto.createHmac('sha256', SECRET).update(raw).digest('hex');

  return new Request(
    'https://qa.invalid/.netlify/functions/cartes-whatsapp',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature
      },
      body: raw
    }
  );
}

function harness({
  plan = 'gratuito',
  subscription = null,
  flow = null
} = {}) {
  const sent = [];
  const lists = [];
  const calls = [];

  let activeFlow = flow;
  let currentSubscription = subscription;

  let usage = plan === 'plus'
    ? { usadas: 7, limite: CARTES_PLUS_QUERY_LIMIT, disponibles: CARTES_PLUS_QUERY_LIMIT - 7 }
    : { usadas: 0, limite: CARTES_FREE_QUERY_LIMIT, disponibles: CARTES_FREE_QUERY_LIMIT };

  const deps = {
    env: {
      META_APP_SECRET: SECRET,
      WHATSAPP_VERIFY_TOKEN: 'verify-e2e',
      CARTES_TERMS_URL: 'https://example.test/terms',
      CARTES_PRIVACY_URL: 'https://example.test/privacy'
    },

    verifyMetaSignature,
    extractMetaEvents,
    extractMessageText,

    claimInboundMessage: async () => true,
    releaseInboundMessage: async () => {},

    resolverOCrearUsuarioPorIdentidad: async () => ({
      user_id: USER_ID
    }),

    obtenerPlanUsuario: async () => plan,
    obtenerSuscripcionUsuario: async () => currentSubscription,

    reservarConsultaMensual: async () => ({
      permitida: true,
      duplicada: false,
      plan,
      periodo: '2026-08'
    }),

    completarConsultaMensual: async () => {
      usage = {
        ...usage,
        usadas: usage.usadas + 1,
        disponibles: usage.disponibles - 1
      };
    },

    liberarConsultaMensual: async () => {},

    obtenerEstadoUsoMensual: async () => usage,

    completarVinculacionConWhatsApp: async () => ({
      linked: true
    }),

    getFlow: async () => activeFlow,

    setFlow: async (_userId, next, data) => {
      activeFlow = { flow: next, data };
    },

    clearFlow: async () => {
      activeFlow = null;
    },

    guiaMasonico: async () =>
      Response.json({
        answer: 'Respuesta E2E del mismo Core de Cartes.'
      }),

    sendWhatsAppTextParts: async (args) => {
      sent.push(args);
    },

    sendWhatsAppInteractiveList: async (args) => {
      lists.push(args);
    },

    sendWhatsAppReplyButtons: async () => {},

    createCheckoutForCartes: async () => {
      calls.push('checkout');
      throw new Error('Checkout no debe ejecutarse en esta prueba');
    },

    cancelPayPalSubscription: async () => {
      calls.push('paypal-cancel');
    },

    getPayPalSubscription: async () => ({
      id: 'I-E2E',
      plan_id: 'P-E2E',
      custom_id: USER_ID,
      status: 'CANCELLED',
      billing_info: {
        next_billing_time: '2026-09-14T00:00:00.000Z'
      }
    }),

    normalizePayPalSubscription,

    sincronizarSuscripcionUsuario: async ({ subscription: updated }) => {
      currentSubscription = updated;
      calls.push('sync-subscription');

      return {
        plan: 'plus',
        subscription: updated
      };
    }
  };

  return {
    deps,
    sent,
    lists,
    calls,
    getFlow: () => activeFlow,
    getSubscription: () => currentSubscription
  };
}

test('WhatsApp E2E procesa consulta, usa el Core y actualiza contador', async () => {
  const h = harness();
  const handler = createWhatsAppHandler(h.deps);

  const response = await handler(
    signedRequest(payload(
      '¿Qué representa la escuadra?',
      'wamid.E2E.QUERY'
    ))
  );

  expect(response.status).toBe(200);

  const body = await response.json();

  expect(body.respuestas).toBe(1);
  expect(body.fallos).toBe(0);
  expect(h.sent).toHaveLength(2);

  expect(h.sent[0].phoneNumberId).toBe(PHONE_ID);
  expect(h.sent[0].to).toBe(PHONE);
  expect(h.sent[0].text).toContain('mismo Core');

  expect(h.sent[1].text).toContain(
    `\*Consultas disponibles:\* ${CARTES_FREE_QUERY_LIMIT - 1} de ${CARTES_FREE_QUERY_LIMIT}`
  );
});

test('WhatsApp E2E Menú interrumpe un flujo de pago sin ejecutar checkout', async () => {
  const h = harness({
    flow: { flow: 'payment_provider' }
  });

  const handler = createWhatsAppHandler(h.deps);

  const response = await handler(
    signedRequest(payload('Menú', 'wamid.E2E.MENU'))
  );

  expect(response.status).toBe(200);
  expect(h.getFlow()).toBeNull();
  expect(h.calls).not.toContain('checkout');
  expect(h.lists).toHaveLength(1);

  const rows =
    h.lists[0].sections.flatMap((section) => section.rows || []);

  expect(rows.map((row) => row.id)).toEqual([
    'menu_conversar',
    'menu_plus',
    'menu_suscribirme',
    'menu_suscripcion',
    'menu_ayuda',
    'menu_legal'
  ]);
});

test('WhatsApp E2E cancela renovación PayPal conservando periodo vigente', async () => {
  const h = harness({
    plan: 'plus',
    subscription: {
      provider: 'paypal',
      subscription_id: 'I-E2E',
      plan_id: 'P-E2E',
      custom_id: USER_ID,
      status: 'authorized',
      provider_status: 'ACTIVE',
      renovacion_cancelada: false,
      next_payment_date: '2026-09-14T00:00:00.000Z',
      access_until: null,
      plan_actual: 'plus'
    }
  });

  const handler = createWhatsAppHandler(h.deps);

  await handler(
    signedRequest(payload(
      'cancelar',
      'wamid.E2E.CANCEL.1'
    ))
  );

  expect(h.getFlow()?.flow).toBe('confirm_cancel');

  await handler(
    signedRequest(payload(
      'SÍ',
      'wamid.E2E.CANCEL.2'
    ))
  );

  expect(h.calls).toContain('paypal-cancel');
  expect(h.calls).toContain('sync-subscription');

  const subscription = h.getSubscription();

  expect(subscription.renovacion_cancelada).toBe(true);
  expect(subscription.status).toBe('cancelled');
  expect(subscription.access_until)
    .toBe('2026-09-14T00:00:00.000Z');

  expect(
    h.sent.some((item) =>
      item.text.includes('renovación de Cartes Plus fue cancelada')
    )
  ).toBe(true);
});