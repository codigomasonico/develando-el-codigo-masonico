import assert from "node:assert/strict";
import test from "node:test";

import {
  cambiarNumeroWhatsAppUsuario,
  completarConsultaMensual,
  desvincularIdentidadUsuario,
  obtenerEstadoUsoMensual,
  obtenerPlanUsuario,
  obtenerSuscripcionUsuario,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad,
  resolverUsuarioExistentePorIdentidad,
  sincronizarSuscripcionUsuario,
  vincularIdentidadUsuario
} from "../../core/ai/lib-cartes-account.mjs";

const NOW = new Date("2026-08-17T16:00:00.000Z");

function clone(value) {
  return value == null
    ? value
    : JSON.parse(JSON.stringify(value));
}

function memoryStore() {
  const values = new Map();
  const etags = new Map();
  let sequence = 0;

  function nextEtag() {
    sequence += 1;
    return `etag-${sequence}`;
  }

  return {
    async get(key) {
      return clone(values.get(key) ?? null);
    },

    async getWithMetadata(key) {
      return {
        data: clone(values.get(key) ?? null),
        etag: etags.get(key) || null
      };
    },

    async setJSON(key, value, options = {}) {
      const exists = values.has(key);
      const currentEtag = etags.get(key) || null;

      if (options.onlyIfNew && exists) {
        return { modified: false, etag: currentEtag };
      }

      if (
        Object.prototype.hasOwnProperty.call(options, "onlyIfMatch") &&
        options.onlyIfMatch !== currentEtag
      ) {
        return { modified: false, etag: currentEtag };
      }

      values.set(key, clone(value));
      const etag = nextEtag();
      etags.set(key, etag);

      return { modified: true, etag };
    },

    async delete(key) {
      values.delete(key);
      etags.delete(key);
    },

    dump(key) {
      return clone(values.get(key) ?? null);
    }
  };
}

test("V115C desvincular WhatsApp conserva Plus, consumo y acceso Web", async () => {
  const store = memoryStore();

  const wa =
    await resolverOCrearUsuarioPorIdentidad({
      tipo: "whatsapp",
      valor: "5218115774235",
      fecha: NOW,
      store
    });

  await vincularIdentidadUsuario({
    userId: wa.user_id,
    tipo: "web",
    valor: "web_v115_unlink",
    fecha: NOW,
    store
  });

  await sincronizarSuscripcionUsuario({
    userId: wa.user_id,
    subscription: {
      provider: "paypal",
      status: "authorized",
      subscription_id: "I-V115-UNLINK"
    },
    source: "test-v115",
    fecha: NOW,
    store
  });

  const reservation =
    await reservarConsultaMensual({
      userId: wa.user_id,
      requestId: "v115-unlink-1",
      channel: "whatsapp",
      fecha: NOW,
      store
    });

  await completarConsultaMensual({
    userId: wa.user_id,
    periodo: reservation.periodo,
    requestId: "v115-unlink-1",
    fecha: NOW,
    store
  });

  const before =
    await obtenerEstadoUsoMensual({
      userId: wa.user_id,
      fecha: NOW,
      store
    });

  const result =
    await desvincularIdentidadUsuario({
      userId: wa.user_id,
      tipo: "whatsapp",
      valor: "5218115774235",
      fecha: NOW,
      store
    });

  assert.equal(result.unlinked, true);

  const oldPhone =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "whatsapp",
      valor: "5218115774235",
      store
    });

  assert.equal(oldPhone, null);

  const web =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "web",
      valor: "web_v115_unlink",
      store
    });

  assert.equal(web.user_id, wa.user_id);

  const plan =
    await obtenerPlanUsuario({
      userId: wa.user_id,
      store
    });

  assert.equal(plan, "plus");

  const after =
    await obtenerEstadoUsoMensual({
      userId: wa.user_id,
      fecha: NOW,
      store
    });

  assert.equal(after.user_id, wa.user_id);
  assert.equal(after.usadas, before.usadas);
  assert.equal(after.limite, 50);

  const subscription =
    await obtenerSuscripcionUsuario({
      userId: wa.user_id,
      fecha: NOW,
      store
    });

  assert.equal(subscription.subscription_id, "I-V115-UNLINK");
  assert.equal(subscription.plan_actual, "plus");

  const tombstone =
    store.dump("account-v1:identity:whatsapp:528115774235");

  assert.equal(tombstone.user_id, null);
  assert.equal(tombstone.status, "unlinked");
  assert.equal(tombstone.previous_user_id, wa.user_id);
});

test("V115C no permite dejar una cuenta sin ninguna identidad de acceso", async () => {
  const store = memoryStore();

  const wa =
    await resolverOCrearUsuarioPorIdentidad({
      tipo: "whatsapp",
      valor: "5213312345678",
      fecha: NOW,
      store
    });

  await assert.rejects(
    () =>
      desvincularIdentidadUsuario({
        userId: wa.user_id,
        tipo: "whatsapp",
        valor: "5213312345678",
        fecha: NOW,
        store
      }),
    /única identidad de acceso/
  );

  const stillLinked =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "whatsapp",
      valor: "5213312345678",
      store
    });

  assert.equal(stillLinked.user_id, wa.user_id);
});

test("V115C cambiar número conserva user_id, Plus y contador y revoca el anterior", async () => {
  const store = memoryStore();

  const wa =
    await resolverOCrearUsuarioPorIdentidad({
      tipo: "whatsapp",
      valor: "5218122222222",
      fecha: NOW,
      store
    });

  await vincularIdentidadUsuario({
    userId: wa.user_id,
    tipo: "web",
    valor: "web_v115_change",
    fecha: NOW,
    store
  });

  await sincronizarSuscripcionUsuario({
    userId: wa.user_id,
    subscription: {
      provider: "mercadopago",
      status: "authorized",
      preapproval_id: "MP-V115-CHANGE"
    },
    source: "test-v115",
    fecha: NOW,
    store
  });

  const reservation =
    await reservarConsultaMensual({
      userId: wa.user_id,
      requestId: "v115-change-1",
      channel: "web",
      fecha: NOW,
      store
    });

  await completarConsultaMensual({
    userId: wa.user_id,
    periodo: reservation.periodo,
    requestId: "v115-change-1",
    fecha: NOW,
    store
  });

  const result =
    await cambiarNumeroWhatsAppUsuario({
      userId: wa.user_id,
      numeroAnterior: "5218122222222",
      numeroNuevo: "5218133333333",
      fecha: NOW,
      store
    });

  assert.equal(result.changed, true);
  assert.equal(result.user_id, wa.user_id);

  const oldPhone =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "whatsapp",
      valor: "5218122222222",
      store
    });

  assert.equal(oldPhone, null);

  const newPhone =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "whatsapp",
      valor: "5218133333333",
      store
    });

  assert.equal(newPhone.user_id, wa.user_id);

  const web =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "web",
      valor: "web_v115_change",
      store
    });

  assert.equal(web.user_id, wa.user_id);

  const state =
    await obtenerEstadoUsoMensual({
      userId: wa.user_id,
      fecha: NOW,
      store
    });

  assert.equal(state.plan, "plus");
  assert.equal(state.usadas, 1);
  assert.equal(state.limite, 50);
});

test("V115C número nuevo ocupado no fusiona ni modifica cuentas", async () => {
  const store = memoryStore();

  const accountA =
    await resolverOCrearUsuarioPorIdentidad({
      tipo: "whatsapp",
      valor: "5218144444444",
      fecha: NOW,
      store
    });

  await vincularIdentidadUsuario({
    userId: accountA.user_id,
    tipo: "web",
    valor: "web_v115_conflict",
    fecha: NOW,
    store
  });

  const accountB =
    await resolverOCrearUsuarioPorIdentidad({
      tipo: "whatsapp",
      valor: "5218155555555",
      fecha: NOW,
      store
    });

  const result =
    await cambiarNumeroWhatsAppUsuario({
      userId: accountA.user_id,
      numeroAnterior: "5218144444444",
      numeroNuevo: "5218155555555",
      fecha: NOW,
      store
    });

  assert.equal(result.changed, false);
  assert.equal(result.conflict, "identity_in_use");

  const oldA =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "whatsapp",
      valor: "5218144444444",
      store
    });

  const stillB =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "whatsapp",
      valor: "5218155555555",
      store
    });

  assert.equal(oldA.user_id, accountA.user_id);
  assert.equal(stillB.user_id, accountB.user_id);
  assert.notEqual(accountA.user_id, accountB.user_id);
});

test("V115C una identidad revocada puede reclamarse solo de forma explícita", async () => {
  const store = memoryStore();

  const wa =
    await resolverOCrearUsuarioPorIdentidad({
      tipo: "whatsapp",
      valor: "5218166666666",
      fecha: NOW,
      store
    });

  await vincularIdentidadUsuario({
    userId: wa.user_id,
    tipo: "web",
    valor: "web_v115_relink",
    fecha: NOW,
    store
  });

  await desvincularIdentidadUsuario({
    userId: wa.user_id,
    tipo: "whatsapp",
    valor: "5218166666666",
    fecha: NOW,
    store
  });

  const detached =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "whatsapp",
      valor: "5218166666666",
      store
    });

  assert.equal(detached, null);

  await vincularIdentidadUsuario({
    userId: wa.user_id,
    tipo: "whatsapp",
    valor: "5218166666666",
    fecha: NOW,
    store
  });

  const relinked =
    await resolverUsuarioExistentePorIdentidad({
      tipo: "whatsapp",
      valor: "5218166666666",
      store
    });

  assert.equal(relinked.user_id, wa.user_id);
});