import { CARTES_PLUS_REVIEW_LIMIT, CARTES_REVIEW_PACK_SIZE, CARTES_REVIEW_PACK_MAX_PER_PERIOD } from "../../core/ai/config.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  completarRevisionMensual,
  obtenerEstadoRevisionesMensual,
  reservarRevisionMensual
} from "../../core/ai/lib-cartes-reviews.mjs";

import {
  fusionarPaquetesRevision,
  registrarPaqueteRevisionPagado
} from "../../core/ai/lib-cartes-review-packs.mjs";

const USER = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const USER_B = "usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = new Date("2026-08-15T16:00:00.000Z");
const EXPIRES = "2026-09-14T00:00:00.000Z";

function memoryStore() {
  const map = new Map();
  let sequence = 0;
  const clone = (value) => value == null ? value : structuredClone(value);

  return {
    async get(key) {
      return clone(map.get(key)?.data ?? null);
    },

    async getWithMetadata(key) {
      const item = map.get(key);

      return item
        ? { data: clone(item.data), etag: item.etag, metadata: {} }
        : { data: null, etag: null, metadata: {} };
    },

    async setJSON(key, value, options = {}) {
      const current = map.get(key);

      if (options.onlyIfNew && current) return { modified: false };

      if (
        options.onlyIfMatch &&
        current?.etag !== options.onlyIfMatch
      ) {
        return { modified: false };
      }

      if (options.onlyIfMatch && !current) return { modified: false };

      sequence += 1;

      map.set(key, {
        data: clone(value),
        etag: `e${sequence}`
      });

      return { modified: true, etag: `e${sequence}` };
    }
  };
}

async function consumirRevisiones(store, count) {
  for (let i = 1; i <= count; i += 1) {
    const requestId = `used-${i}`;

    const reservation =
      await reservarRevisionMensual({
        userId: USER,
        plan: "plus",
        requestId,
        channel: i % 2 ? "web" : "whatsapp",
        fecha: NOW,
        store
      });

    assert.equal(reservation.permitida, true);

    await completarRevisionMensual({
      userId: USER,
      periodo: reservation.periodo,
      requestId,
      fecha: NOW,
      store
    });
  }
}

test("V091 primer paquete suma el tamaño configurado al limite base", async () => {
  const store = memoryStore();

  await consumirRevisiones(store, CARTES_PLUS_REVIEW_LIMIT);

  let state =
    await obtenerEstadoRevisionesMensual({
      userId: USER,
      plan: "plus",
      fecha: NOW,
      store
    });

  assert.equal(state.limite, CARTES_PLUS_REVIEW_LIMIT);
  assert.equal(state.usadas, CARTES_PLUS_REVIEW_LIMIT);
  assert.equal(state.disponibles, 0);

  await registrarPaqueteRevisionPagado({
    userId: USER,
    provider: "mercadopago",
    paymentId: "MP-PACK-1",
    expiresAt: EXPIRES,
    fecha: NOW,
    store
  });

  state =
    await obtenerEstadoRevisionesMensual({
      userId: USER,
      plan: "plus",
      fecha: NOW,
      store
    });

  assert.equal(state.limite_base, CARTES_PLUS_REVIEW_LIMIT);
  assert.equal(state.extras, 3);
  assert.equal(state.limite, CARTES_PLUS_REVIEW_LIMIT + CARTES_REVIEW_PACK_SIZE);
  assert.equal(state.usadas, CARTES_PLUS_REVIEW_LIMIT);
  assert.equal(state.disponibles, CARTES_REVIEW_PACK_SIZE);
  assert.equal(state.paquetes_comprados, 1);
});

test("V091 segundo paquete suma nuevamente el tamaño configurado y el tercero se bloquea", async () => {
  const store = memoryStore();

  await registrarPaqueteRevisionPagado({
    userId: USER,
    provider: "mercadopago",
    paymentId: "MP-PACK-1",
    expiresAt: EXPIRES,
    fecha: NOW,
    store
  });

  await registrarPaqueteRevisionPagado({
    userId: USER,
    provider: "paypal",
    paymentId: "PP-PACK-2",
    expiresAt: EXPIRES,
    fecha: NOW,
    store
  });

  const state =
    await obtenerEstadoRevisionesMensual({
      userId: USER,
      plan: "plus",
      fecha: NOW,
      store
    });

  assert.equal(state.limite, CARTES_PLUS_REVIEW_LIMIT + (CARTES_REVIEW_PACK_SIZE * CARTES_REVIEW_PACK_MAX_PER_PERIOD));
  assert.equal(state.paquetes_comprados, CARTES_REVIEW_PACK_MAX_PER_PERIOD);

  await assert.rejects(
    registrarPaqueteRevisionPagado({
      userId: USER,
      provider: "paypal",
      paymentId: "PP-PACK-3",
      expiresAt: EXPIRES,
      fecha: NOW,
      store
    }),
    (error) => error?.code === "pack_limit"
  );
});

test("V091 mismo pago es idempotente", async () => {
  const store = memoryStore();

  const first =
    await registrarPaqueteRevisionPagado({
      userId: USER,
      provider: "mercadopago",
      paymentId: "MP-IDEMPOTENT",
      expiresAt: EXPIRES,
      fecha: NOW,
      store
    });

  const second =
    await registrarPaqueteRevisionPagado({
      userId: USER,
      provider: "mercadopago",
      paymentId: "MP-IDEMPOTENT",
      expiresAt: EXPIRES,
      fecha: NOW,
      store
    });

  assert.equal(first.duplicado, false);
  assert.equal(second.duplicado, true);
  assert.equal(second.paquetes_comprados, 1);
});

test("V091 paquete vencido deja de ampliar cuota", async () => {
  const store = memoryStore();

  await registrarPaqueteRevisionPagado({
    userId: USER,
    provider: "paypal",
    paymentId: "PP-OLD",
    expiresAt: "2026-08-16T00:00:00.000Z",
    fecha: NOW,
    store
  });

  const state =
    await obtenerEstadoRevisionesMensual({
      userId: USER,
      plan: "plus",
      fecha: new Date("2026-08-17T00:00:00.000Z"),
      store
    });

  assert.equal(state.limite, CARTES_PLUS_REVIEW_LIMIT);
  assert.equal(state.paquetes_comprados, 0);
});

test("V091 paquetes se fusionan con la cuenta Web WhatsApp", async () => {
  const store = memoryStore();

  await registrarPaqueteRevisionPagado({
    userId: USER,
    provider: "mercadopago",
    paymentId: "MP-SOURCE",
    expiresAt: EXPIRES,
    fecha: NOW,
    store
  });

  await registrarPaqueteRevisionPagado({
    userId: USER_B,
    provider: "paypal",
    paymentId: "PP-TARGET",
    expiresAt: EXPIRES,
    fecha: NOW,
    store
  });

  await fusionarPaquetesRevision({
    sourceUserId: USER,
    targetUserId: USER_B,
    fecha: NOW,
    store
  });

  const state =
    await obtenerEstadoRevisionesMensual({
      userId: USER_B,
      plan: "plus",
      fecha: NOW,
      store
    });

  assert.equal(state.paquetes_comprados, CARTES_REVIEW_PACK_MAX_PER_PERIOD);
  assert.equal(state.limite, CARTES_PLUS_REVIEW_LIMIT + (CARTES_REVIEW_PACK_SIZE * CARTES_REVIEW_PACK_MAX_PER_PERIOD));
});

test("V091 Mercado Pago usa Checkout Pro de pago unico", () => {
  const source =
    fs.readFileSync(
      new URL(
        "../../channels/whatsapp/functions/lib-cartes-review-pack-payments.mjs",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(source, /\/checkout\/preferences/);
  assert.match(source, /const PRICE = CARTES_REVIEW_PACK_PRICE_MXN/);
  assert.match(source, /external_reference/);
  assert.match(source, /notification_url/);
  assert.match(source, /expiration_date_to/);
});

test("V091 PayPal usa Orders v2 y CAPTURE", () => {
  const source =
    fs.readFileSync(
      new URL(
        "../../channels/whatsapp/functions/lib-cartes-review-pack-payments.mjs",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(source, /\/v2\/checkout\/orders/);
  assert.match(source, /intent:\s*"CAPTURE"/);
  assert.match(source, /value:\s*PRICE\.toFixed\(2\)/);
  assert.match(source, /\/capture/);
  assert.match(source, /PayPal-Request-Id/);
});

test("V091 suscripciones recurrentes permanecen separadas", () => {
  const mp =
    fs.readFileSync(
      new URL(
        "../../channels/whatsapp/functions/lib-mercadopago.mjs",
        import.meta.url
      ),
      "utf8"
    );

  const paypal =
    fs.readFileSync(
      new URL(
        "../../channels/whatsapp/functions/lib-paypal.mjs",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(mp, /const PRICE = CARTES_PLUS_PRICE_MXN/);
  assert.match(mp, /\/preapproval_plan/);
  assert.match(paypal, /PAYPAL_PLAN_ID/);
  assert.match(paypal, /\/v1\/billing\/subscriptions/);

  assert.doesNotMatch(mp, /cartes-review-pack-3/);
  assert.doesNotMatch(paypal, /cartes-review-pack-3/);
});

test("V091 Web ofrece compra desde Mi suscripcion", () => {
  const source =
    fs.readFileSync(
      new URL(
        "../../channels/web/public/bot/guia-masonico.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(source, /Comprar \$\{currentReviewPackSize\} revisiones - \$\$\{currentReviewPackPrice\}/);
  assert.match(source, /Paquetes adicionales:/);
  assert.match(source, /reviewPackEndpoint/);
  assert.match(source, /review_pack_provider/);
});

test("V091 WhatsApp ofrece compra y saldo compartido", () => {
  const source =
    fs.readFileSync(
      new URL(
        "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(source, /review_pack_buy/);
  assert.match(source, /Paquetes adicionales:/);
  assert.match(source, /createReviewPackCheckout/);
  assert.match(source, /review_pack_provider/);
});