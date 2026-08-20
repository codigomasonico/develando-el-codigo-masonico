import assert from "node:assert/strict";
import test from "node:test";
import {
  completarConsultaMensual,
  completarVinculacionConWhatsApp,
  iniciarVinculacionWeb,
  obtenerEstadoUsoMensual,
  obtenerEstadoVinculacionWeb,
  obtenerSuscripcionUsuario,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarSuscripcionUsuario
} from "../../core/ai/lib-cartes-account.mjs";

function memoryStore() {
  const data = new Map(); let seq = 0;
  return {
    async get(key) { const e = data.get(key); return e ? structuredClone(e.data) : null; },
    async getWithMetadata(key) { const e = data.get(key); return e ? { data: structuredClone(e.data), etag: e.etag, metadata: {} } : null; },
    async setJSON(key, value, options = {}) {
      const current = data.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
      seq += 1; const etag = `"e-${seq}"`; data.set(key, { data: structuredClone(value), etag }); return { modified: true, etag };
    }
  };
}

const NOW = new Date("2026-08-08T12:00:00.000Z");

test("genera un código temporal de 6 dígitos", async () => {
  const store = memoryStore();
  const link = await iniciarVinculacionWeb({ webIdentity: "web_core004_test", fecha: NOW, store });
  assert.match(link.code, /^\d{6}$/);
  assert.equal(link.status, "pending");
  assert.equal(link.instruction, `VINCULAR ${link.code}`);
});

test("WhatsApp consume el código y reasigna la identidad web", async () => {
  const store = memoryStore();
  const web = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "web_merge_test", fecha: NOW, store });
  const wa = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5213322338888", fecha: NOW, store });
  const link = await iniciarVinculacionWeb({ webIdentity: "web_merge_test", fecha: NOW, store });
  const done = await completarVinculacionConWhatsApp({ code: link.code, whatsappUserId: wa.user_id, fecha: NOW, store });
  assert.equal(done.linked, true);
  const resolved = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "web_merge_test", fecha: NOW, store });
  assert.equal(resolved.user_id, wa.user_id);
  assert.notEqual(web.user_id, wa.user_id);
  const status = await obtenerEstadoVinculacionWeb({ webIdentity: "web_merge_test", fecha: NOW, store });
  assert.equal(status.linked, true);
});

test("la fusión conserva el consumo de Web y WhatsApp", async () => {
  const store = memoryStore();
  const web = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "web_usage_merge", fecha: NOW, store });
  const wa = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5213311111111", fecha: NOW, store });
  const wr = await reservarConsultaMensual({ userId: web.user_id, requestId: "web-before", channel: "web", fecha: NOW, store });
  await completarConsultaMensual({ userId: web.user_id, periodo: wr.periodo, requestId: "web-before", fecha: NOW, store });
  const qr = await reservarConsultaMensual({ userId: wa.user_id, requestId: "wa-before", channel: "whatsapp", fecha: NOW, store });
  await completarConsultaMensual({ userId: wa.user_id, periodo: qr.periodo, requestId: "wa-before", fecha: NOW, store });
  const link = await iniciarVinculacionWeb({ webIdentity: "web_usage_merge", fecha: NOW, store });
  await completarVinculacionConWhatsApp({ code: link.code, whatsappUserId: wa.user_id, fecha: NOW, store });
  const state = await obtenerEstadoUsoMensual({ userId: wa.user_id, fecha: NOW, store });
  assert.equal(state.usadas, 2);
  assert.equal(state.disponibles, 3);
});

test("un código expirado no vincula cuentas", async () => {
  const store = memoryStore();
  const wa = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5213344444444", fecha: NOW, store });
  const link = await iniciarVinculacionWeb({ webIdentity: "web_expired_link", fecha: NOW, store });
  const later = new Date(NOW.getTime() + 11 * 60 * 1000);
  await assert.rejects(() => completarVinculacionConWhatsApp({ code: link.code, whatsappUserId: wa.user_id, fecha: later, store }), /expiró/);
});

test("una identidad web ya vinculada no puede generar otro código", async () => {
  const store = memoryStore();
  const wa = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5213355555555", fecha: NOW, store });
  const first = await iniciarVinculacionWeb({ webIdentity: "web_no_relink", fecha: NOW, store });
  await completarVinculacionConWhatsApp({ code: first.code, whatsappUserId: wa.user_id, fecha: NOW, store });
  const again = await iniciarVinculacionWeb({ webIdentity: "web_no_relink", fecha: NOW, store });
  assert.equal(again.linked, true);
  assert.equal(again.code, undefined);
});

test("dos suscripciones Plus vigentes distintas bloquean la vinculación sin modificar cuentas", async () => {
  const store = memoryStore();

  const web = await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_double_plus",
    fecha: NOW,
    store
  });

  const wa = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5213366666666",
    fecha: NOW,
    store
  });

  await sincronizarSuscripcionUsuario({
    userId: web.user_id,
    subscription: {
      provider: "mercadopago",
      preapproval_id: "MP-WEB-ACTIVE",
      status: "authorized"
    },
    source: "test-web-mp",
    fecha: NOW,
    store
  });

  await sincronizarSuscripcionUsuario({
    userId: wa.user_id,
    subscription: {
      provider: "paypal",
      subscription_id: "I-WA-CANCELLED",
      status: "cancelled",
      renovacion_cancelada: true,
      access_until: "2026-09-14T00:00:00.000Z"
    },
    source: "test-wa-paypal",
    fecha: NOW,
    store
  });

  const link = await iniciarVinculacionWeb({
    webIdentity: "web_double_plus",
    fecha: NOW,
    store
  });

  const done = await completarVinculacionConWhatsApp({
    code: link.code,
    whatsappUserId: wa.user_id,
    fecha: NOW,
    store
  });

  assert.equal(done.linked, false);
  assert.equal(done.conflict, "active_subscriptions");

  const webAfter = await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_double_plus",
    fecha: NOW,
    store
  });

  const waAfter = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5213366666666",
    fecha: NOW,
    store
  });

  assert.equal(webAfter.user_id, web.user_id);
  assert.equal(waAfter.user_id, wa.user_id);
  assert.notEqual(webAfter.user_id, waAfter.user_id);

  const status = await obtenerEstadoVinculacionWeb({
    webIdentity: "web_double_plus",
    fecha: NOW,
    store
  });

  assert.equal(status.linked, false);
  assert.equal(status.status, "pending");

  const webSub = await obtenerSuscripcionUsuario({
    userId: web.user_id,
    fecha: NOW,
    store
  });

  const waSub = await obtenerSuscripcionUsuario({
    userId: wa.user_id,
    fecha: NOW,
    store
  });

  assert.equal(webSub.provider, "mercadopago");
  assert.equal(webSub.preapproval_id, "MP-WEB-ACTIVE");
  assert.equal(waSub.provider, "paypal");
  assert.equal(waSub.subscription_id, "I-WA-CANCELLED");
});
test("un navegador nuevo recupera una cuenta Plus mediante el mismo WhatsApp", async () => {
  const store = memoryStore();

  const wa = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5213377777777",
    fecha: NOW,
    store
  });

  const firstWeb = await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_recovery_original",
    fecha: NOW,
    store
  });

  const firstLink = await iniciarVinculacionWeb({
    webIdentity: "web_recovery_original",
    fecha: NOW,
    store
  });

  await completarVinculacionConWhatsApp({
    code: firstLink.code,
    whatsappUserId: wa.user_id,
    fecha: NOW,
    store
  });

  await sincronizarSuscripcionUsuario({
    userId: wa.user_id,
    subscription: {
      provider: "paypal",
      subscription_id: "I-RECOVERY-PLUS",
      status: "authorized"
    },
    source: "test-recovery",
    fecha: NOW,
    store
  });

  const reservation = await reservarConsultaMensual({
    userId: wa.user_id,
    requestId: "recovery-query-1",
    channel: "whatsapp",
    fecha: NOW,
    store
  });

  await completarConsultaMensual({
    userId: wa.user_id,
    periodo: reservation.periodo,
    requestId: "recovery-query-1",
    fecha: NOW,
    store
  });

  const newWebBefore = await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_recovery_new_browser",
    fecha: NOW,
    store
  });

  assert.notEqual(newWebBefore.user_id, wa.user_id);

  const recoveryLink = await iniciarVinculacionWeb({
    webIdentity: "web_recovery_new_browser",
    fecha: NOW,
    store
  });

  const recovered = await completarVinculacionConWhatsApp({
    code: recoveryLink.code,
    whatsappUserId: wa.user_id,
    fecha: NOW,
    store
  });

  assert.equal(recovered.linked, true);
  assert.equal(recovered.user_id, wa.user_id);

  const newWebAfter = await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_recovery_new_browser",
    fecha: NOW,
    store
  });

  assert.equal(newWebAfter.user_id, wa.user_id);

  const subscription = await obtenerSuscripcionUsuario({
    userId: wa.user_id,
    fecha: NOW,
    store
  });

  assert.equal(subscription.plan_actual, "plus");
  assert.equal(subscription.provider, "paypal");
  assert.equal(subscription.subscription_id, "I-RECOVERY-PLUS");

  const usage = await obtenerEstadoUsoMensual({
    userId: wa.user_id,
    fecha: NOW,
    store
  });

  assert.equal(usage.limite, 50);
  assert.equal(usage.usadas, 1);
  assert.equal(usage.disponibles, 49);
});