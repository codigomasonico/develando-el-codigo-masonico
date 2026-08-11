import assert from "node:assert/strict";
import test from "node:test";
import {
  completarConsultaMensual,
  completarVinculacionConWhatsApp,
  iniciarVinculacionWeb,
  obtenerEstadoUsoMensual,
  obtenerEstadoVinculacionWeb,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad
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
