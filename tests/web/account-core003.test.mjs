import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAN_CARTES_GRATUITO,
  PLAN_CARTES_PLUS,
  completarConsultaMensual,
  obtenerEstadoUsoMensual,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarPlanUsuario,
  vincularIdentidadUsuario
} from "../../core/ai/lib-cartes-account.mjs";

function memoryStore() {
  const data = new Map();
  let seq = 0;
  return {
    async get(key) { const e = data.get(key); return e ? structuredClone(e.data) : null; },
    async getWithMetadata(key) { const e = data.get(key); return e ? { data: structuredClone(e.data), etag: e.etag, metadata: {} } : null; },
    async setJSON(key, value, options = {}) {
      const current = data.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
      seq += 1;
      const etag = `"e-${seq}"`;
      data.set(key, { data: structuredClone(value), etag });
      return { modified: true, etag };
    }
  };
}

const AUG = new Date("2026-08-08T12:00:00.000Z");

test("Web y WhatsApp vinculados comparten el mismo user_id", async () => {
  const store = memoryStore();
  const wa = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5218115774235", fecha: AUG, store });
  await vincularIdentidadUsuario({ userId: wa.user_id, tipo: "web", valor: "web_core003", fecha: AUG, store });
  const web = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "web_core003", fecha: AUG, store });
  assert.equal(web.user_id, wa.user_id);
});

test("el consumo se contabiliza por user_id y no por canal", async () => {
  const store = memoryStore();
  const user = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "web_shared", fecha: AUG, store });
  const r1 = await reservarConsultaMensual({ userId: user.user_id, plan: PLAN_CARTES_GRATUITO, requestId: "web-1", channel: "web", fecha: AUG, store });
  await completarConsultaMensual({ userId: user.user_id, periodo: r1.periodo, requestId: "web-1", fecha: AUG, store });
  const r2 = await reservarConsultaMensual({ userId: user.user_id, plan: PLAN_CARTES_GRATUITO, requestId: "wa-1", channel: "whatsapp", fecha: AUG, store });
  await completarConsultaMensual({ userId: user.user_id, periodo: r2.periodo, requestId: "wa-1", fecha: AUG, store });
  const state = await obtenerEstadoUsoMensual({ userId: user.user_id, plan: PLAN_CARTES_GRATUITO, fecha: AUG, store });
  assert.equal(state.usadas, 2);
  assert.equal(state.disponibles, 3);
});

test("gratuito bloquea la sexta consulta compartida", async () => {
  const store = memoryStore();
  const user = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "web_five", fecha: AUG, store });
  for (let i=1; i<=5; i+=1) {
    const r = await reservarConsultaMensual({ userId: user.user_id, plan: PLAN_CARTES_GRATUITO, requestId: `req-${i}`, channel: i % 2 ? "web" : "whatsapp", fecha: AUG, store });
    assert.equal(r.permitida, true);
    await completarConsultaMensual({ userId: user.user_id, periodo: r.periodo, requestId: `req-${i}`, fecha: AUG, store });
  }
  const sixth = await reservarConsultaMensual({ userId: user.user_id, plan: PLAN_CARTES_GRATUITO, requestId: "req-6", channel: "web", fecha: AUG, store });
  assert.equal(sixth.permitida, false);
  assert.equal(sixth.disponibles, 0);
});

test("Plus eleva el límite central a 50 sin reiniciar consumo", async () => {
  const store = memoryStore();
  const user = await resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: "5218111111111", fecha: AUG, store });
  const r = await reservarConsultaMensual({ userId: user.user_id, plan: PLAN_CARTES_GRATUITO, requestId: "free-1", channel: "whatsapp", fecha: AUG, store });
  await completarConsultaMensual({ userId: user.user_id, periodo: r.periodo, requestId: "free-1", fecha: AUG, store });
  await sincronizarPlanUsuario({ userId: user.user_id, plan: PLAN_CARTES_PLUS, source: "whatsapp", fecha: AUG, store });
  const state = await obtenerEstadoUsoMensual({ userId: user.user_id, fecha: AUG, store });
  assert.equal(state.plan, PLAN_CARTES_PLUS);
  assert.equal(state.limite, 50);
  assert.equal(state.usadas, 1);
  assert.equal(state.disponibles, 49);
});
