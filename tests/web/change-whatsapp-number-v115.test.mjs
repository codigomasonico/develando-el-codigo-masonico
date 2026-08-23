import assert from "node:assert/strict";
import test from "node:test";
import { CARTES_PLUS_QUERY_LIMIT } from "../../core/ai/config.mjs";

import {
  completarCambioNumeroWhatsApp,
  completarVinculacionConWhatsApp,
  iniciarCambioNumeroWhatsApp,
  iniciarVinculacionWeb,
  obtenerEstadoVinculacionWeb,
  obtenerEstadoUsoMensual,
  resolverOCrearUsuarioPorIdentidad,
  resolverUsuarioExistentePorIdentidad,
  sincronizarSuscripcionUsuario
} from "../../core/ai/lib-cartes-account.mjs";

const NOW =
  new Date("2026-08-17T16:00:00.000Z");

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
      return clone(
        values.get(key) ?? null
      );
    },

    async getWithMetadata(key) {
      return {
        data: clone(
          values.get(key) ?? null
        ),
        etag:
          etags.get(key) || null
      };
    },

    async setJSON(
      key,
      value,
      options = {}
    ) {
      const exists =
        values.has(key);

      const currentEtag =
        etags.get(key) || null;

      if (
        options.onlyIfNew &&
        exists
      ) {
        return {
          modified: false,
          etag: currentEtag
        };
      }

      if (
        Object.prototype.hasOwnProperty.call(
          options,
          "onlyIfMatch"
        ) &&
        options.onlyIfMatch !==
          currentEtag
      ) {
        return {
          modified: false,
          etag: currentEtag
        };
      }

      values.set(
        key,
        clone(value)
      );

      const etag =
        nextEtag();

      etags.set(
        key,
        etag
      );

      return {
        modified: true,
        etag
      };
    },

    async delete(key) {
      values.delete(key);
      etags.delete(key);
    },

    dump(key) {
      return clone(
        values.get(key) ?? null
      );
    }
  };
}

async function linkedPlusAccount(store) {
  const wa =
    await resolverOCrearUsuarioPorIdentidad({
      tipo: "whatsapp",
      valor: "5218111111111",
      fecha: NOW,
      store
    });

  await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_v115e2_change",
    fecha: NOW,
    store
  });

  const link =
    await iniciarVinculacionWeb({
      webIdentity:
        "web_v115e2_change",
      fecha: NOW,
      store
    });

  await completarVinculacionConWhatsApp({
    code: link.code,
    whatsappUserId: wa.user_id,
    fecha: NOW,
    store
  });

  await sincronizarSuscripcionUsuario({
    userId: wa.user_id,
    subscription: {
      provider: "paypal",
      status: "authorized",
      subscription_id:
        "I-V115E2"
    },
    source: "test-v115e2",
    fecha: NOW,
    store
  });

  return wa.user_id;
}

test(
  "V115E2 genera CAMBIAR de 6 dígitos y conserva número actual mientras está pendiente",
  async () => {
    const store = memoryStore();
    const userId =
      await linkedPlusAccount(store);

    const request =
      await iniciarCambioNumeroWhatsApp({
        userId,
        fecha: NOW,
        store
      });

    assert.equal(
      request.status,
      "pending"
    );

    assert.match(
      request.instruction,
      /^CAMBIAR \d{6}$/
    );

    const oldPhone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218111111111",
        store
      });

    assert.equal(
      oldPhone.user_id,
      userId
    );
  }
);

test(
  "V115E2 verifica nuevo número y conserva user_id Plus, uso y vínculo Web",
  async () => {
    const store = memoryStore();
    const userId =
      await linkedPlusAccount(store);

    const before =
      await obtenerEstadoUsoMensual({
        userId,
        fecha: NOW,
        store
      });

    const linkBefore =
      await obtenerEstadoVinculacionWeb({
        webIdentity:
          "web_v115e2_change",
        fecha: NOW,
        store
      });

    assert.equal(
      linkBefore.linked,
      true
    );

    const request =
      await iniciarCambioNumeroWhatsApp({
        userId,
        fecha: NOW,
        store
      });

    const result =
      await completarCambioNumeroWhatsApp({
        code: request.code,
        whatsappPhone:
          "5218122222222",
        fecha: NOW,
        store
      });

    assert.equal(
      result.changed,
      true
    );

    assert.equal(
      result.user_id,
      userId
    );

    const oldPhone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218111111111",
        store
      });

    const newPhone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218122222222",
        store
      });

    assert.equal(
      oldPhone,
      null
    );

    assert.equal(
      newPhone.user_id,
      userId
    );

    const oldTombstone =
      store.dump(
        "account-v1:identity:whatsapp:528111111111"
      );

    assert.equal(
      oldTombstone?.user_id,
      null
    );

    assert.equal(
      oldTombstone?.status,
      "unlinked"
    );

    const after =
      await obtenerEstadoUsoMensual({
        userId,
        fecha: NOW,
        store
      });

    assert.equal(
      after.plan,
      "plus"
    );

    assert.equal(
      after.limite,
      CARTES_PLUS_QUERY_LIMIT
    );

    assert.equal(
      after.usadas,
      before.usadas
    );

    const linkAfter =
      await obtenerEstadoVinculacionWeb({
        webIdentity:
          "web_v115e2_change",
        fecha: NOW,
        store
      });

    assert.equal(
      linkAfter.linked,
      true
    );
  }
);

test(
  "V115E2 número nuevo ocupado bloquea sin modificar ninguna identidad",
  async () => {
    const store = memoryStore();
    const userId =
      await linkedPlusAccount(store);

    const other =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "whatsapp",
        valor: "5218133333333",
        fecha: NOW,
        store
      });

    assert.notEqual(
      other.user_id,
      userId
    );

    const request =
      await iniciarCambioNumeroWhatsApp({
        userId,
        fecha: NOW,
        store
      });

    const result =
      await completarCambioNumeroWhatsApp({
        code: request.code,
        whatsappPhone:
          "5218133333333",
        fecha: NOW,
        store
      });

    assert.equal(
      result.changed,
      false
    );

    assert.equal(
      result.conflict,
      "identity_in_use"
    );

    const oldPhone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218111111111",
        store
      });

    const occupied =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218133333333",
        store
      });

    assert.equal(
      oldPhone.user_id,
      userId
    );

    assert.equal(
      occupied.user_id,
      other.user_id
    );
  }
);

test(
  "V115E2 código expirado no cambia números",
  async () => {
    const store = memoryStore();
    const userId =
      await linkedPlusAccount(store);

    const request =
      await iniciarCambioNumeroWhatsApp({
        userId,
        fecha: NOW,
        store
      });

    const later =
      new Date(
        NOW.getTime() +
        11 * 60 * 1000
      );

    await assert.rejects(
      () =>
        completarCambioNumeroWhatsApp({
          code: request.code,
          whatsappPhone:
            "5218144444444",
          fecha: later,
          store
        }),
      /expiró/
    );

    const oldPhone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218111111111",
        store
      });

    assert.equal(
      oldPhone.user_id,
      userId
    );

    const newPhone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218144444444",
        store
      });

    assert.equal(
      newPhone,
      null
    );
  }
);

test(
  "V115E2 repetir código desde número nuevo es idempotente",
  async () => {
    const store = memoryStore();
    const userId =
      await linkedPlusAccount(store);

    const request =
      await iniciarCambioNumeroWhatsApp({
        userId,
        fecha: NOW,
        store
      });

    const first =
      await completarCambioNumeroWhatsApp({
        code: request.code,
        whatsappPhone:
          "5218155555555",
        fecha: NOW,
        store
      });

    assert.equal(
      first.changed,
      true
    );

    const second =
      await completarCambioNumeroWhatsApp({
        code: request.code,
        whatsappPhone:
          "5218155555555",
        fecha: NOW,
        store
      });

    assert.equal(
      second.changed,
      true
    );

    assert.equal(
      second.already_changed,
      true
    );

    assert.equal(
      second.user_id,
      userId
    );
  }
);