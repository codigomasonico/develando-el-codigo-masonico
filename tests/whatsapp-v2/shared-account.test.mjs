import test from "node:test";
import assert from "node:assert/strict";
import {
  completarConsultaMensual,
  iniciarVinculacionWeb,
  completarVinculacionConWhatsApp,
  obtenerEstadoUsoMensual,
  obtenerPlanUsuario,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarSuscripcionUsuario
} from "../../core/ai/lib-cartes-account.mjs";

class MemoryStore {
  constructor() { this.map = new Map(); this.seq = 0; }
  clone(v) { return v == null ? v : structuredClone(v); }
  async get(key) { return this.clone(this.map.get(key)?.data ?? null); }
  async getWithMetadata(key) {
    const e = this.map.get(key);
    return e ? { data: this.clone(e.data), etag: e.etag, metadata: null } : { data: null, etag: null, metadata: null };
  }
  async setJSON(key, data, options = {}) {
    const current = this.map.get(key);
    if (options.onlyIfNew && current) return { modified: false, etag: current.etag };
    if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false, etag: current?.etag || null };
    const etag = `e${++this.seq}`;
    this.map.set(key, { data: this.clone(data), etag });
    return { modified: true, etag };
  }
  async delete(key) { return this.map.delete(key); }
}

test("Web y WhatsApp pueden converger en el mismo user_id", async () => {
  const store = new MemoryStore();
  const web = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "browser-abc", store });
  const wa = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5218115774235", store });
  assert.notEqual(web.user_id, wa.user_id);

  const link = await iniciarVinculacionWeb({ webIdentity: "browser-abc", store });
  assert.match(link.code, /^\d{6}$/);
  const done = await completarVinculacionConWhatsApp({ code: link.code, whatsappUserId: wa.user_id, store });
  assert.equal(done.user_id, wa.user_id);

  const webAfter = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "browser-abc", store });
  const waAfter = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5218115774235", store });
  assert.equal(webAfter.user_id, waAfter.user_id);
});

test("plan gratuito comparte límite central de 5 consultas", async () => {
  const store = new MemoryStore();
  const user = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5218115774235", store });
  for (let i = 1; i <= 5; i++) {
    const r = await reservarConsultaMensual({ userId: user.user_id, requestId: `req-${i}`, channel: i % 2 ? "whatsapp" : "web", store });
    assert.equal(r.permitida, true);
    await completarConsultaMensual({ userId: user.user_id, periodo: r.periodo, requestId: `req-${i}`, store });
  }
  const blocked = await reservarConsultaMensual({ userId: user.user_id, requestId: "req-6", channel: "web", store });
  assert.equal(blocked.permitida, false);
  assert.equal(blocked.limite, 5);
});

test("suscripción Plus central eleva el límite compartido a 50", async () => {
  const store = new MemoryStore();
  const user = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5218115774235", store });
  await sincronizarSuscripcionUsuario({ userId: user.user_id, subscription: { provider: "paypal", status: "authorized", subscription_id: "I-TEST" }, source: "test", store });
  assert.equal(await obtenerPlanUsuario({ userId: user.user_id, store }), "plus");
  const usage = await obtenerEstadoUsoMensual({ userId: user.user_id, store });
  assert.equal(usage.limite, 50);
  assert.equal(usage.disponibles, 50);
});
