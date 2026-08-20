import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  completarCambioNumeroWhatsApp,
  completarVinculacionConWhatsApp,
  desvincularWhatsAppUsuario,
  iniciarCambioNumeroWhatsApp,
  iniciarVinculacionWeb,
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

async function createLinkedAccount({
  store,
  phone,
  webIdentity,
  plus = false
}) {
  const wa =
    await resolverOCrearUsuarioPorIdentidad({
      tipo: "whatsapp",
      valor: phone,
      fecha: NOW,
      store
    });

  await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: webIdentity,
    fecha: NOW,
    store
  });

  const link =
    await iniciarVinculacionWeb({
      webIdentity,
      fecha: NOW,
      store
    });

  const done =
    await completarVinculacionConWhatsApp({
      code: link.code,
      whatsappUserId: wa.user_id,
      fecha: NOW,
      store
    });

  if (plus) {
    await sincronizarSuscripcionUsuario({
      userId: done.user_id,
      subscription: {
        provider: "paypal",
        status: "authorized",
        subscription_id:
          `I-${webIdentity}`
      },
      source: "test-v115f",
      fecha: NOW,
      store
    });
  }

  return done.user_id;
}

test(
  "V115F un número desvinculado no puede saltar a una cuenta Web nueva para obtener otra cuota gratuita",
  async () => {
    const store = memoryStore();

    const originalUserId =
      await createLinkedAccount({
        store,
        phone: "5218111000001",
        webIdentity:
          "web_v115f_original",
        plus: true
      });

    const originalBefore =
      await obtenerEstadoUsoMensual({
        userId: originalUserId,
        fecha: NOW,
        store
      });

    await desvincularWhatsAppUsuario({
      userId: originalUserId,
      fecha: NOW,
      store
    });

    const newWeb =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "web_v115f_newbrowser",
        fecha: NOW,
        store
      });

    assert.notEqual(
      newWeb.user_id,
      originalUserId
    );

    const newBefore =
      await obtenerEstadoUsoMensual({
        userId: newWeb.user_id,
        fecha: NOW,
        store
      });

    assert.equal(
      newBefore.plan,
      "gratuito"
    );

    assert.equal(
      newBefore.limite,
      5
    );

    const link =
      await iniciarVinculacionWeb({
        webIdentity:
          "web_v115f_newbrowser",
        fecha: NOW,
        store
      });

    const attempt =
      await completarVinculacionConWhatsApp({
        code: link.code,
        whatsappPhone:
          "5218111000001",
        fecha: NOW,
        store
      });

    assert.equal(
      attempt.linked,
      false
    );

    assert.equal(
      attempt.conflict,
      "identity_previous_account"
    );

    const tombstone =
      store.dump(
        "account-v1:identity:whatsapp:528111000001"
      );

    assert.equal(
      tombstone?.user_id,
      null
    );

    assert.equal(
      tombstone?.status,
      "unlinked"
    );

    assert.equal(
      tombstone?.previous_user_id,
      originalUserId
    );

    const originalWeb =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "web",
        valor: "web_v115f_original",
        store
      });

    const otherWeb =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "web",
        valor: "web_v115f_newbrowser",
        store
      });

    assert.equal(
      originalWeb.user_id,
      originalUserId
    );

    assert.equal(
      otherWeb.user_id,
      newWeb.user_id
    );

    const originalAfter =
      await obtenerEstadoUsoMensual({
        userId: originalUserId,
        fecha: NOW,
        store
      });

    const newAfter =
      await obtenerEstadoUsoMensual({
        userId: newWeb.user_id,
        fecha: NOW,
        store
      });

    assert.equal(
      originalAfter.plan,
      originalBefore.plan
    );

    assert.equal(
      originalAfter.limite,
      originalBefore.limite
    );

    assert.equal(
      originalAfter.usadas,
      originalBefore.usadas
    );

    assert.equal(
      newAfter.plan,
      newBefore.plan
    );

    assert.equal(
      newAfter.limite,
      newBefore.limite
    );

    assert.equal(
      newAfter.usadas,
      newBefore.usadas
    );
  }
);

test(
  "V115F el mismo previous_user_id sí puede recuperar su número sin cuota nueva",
  async () => {
    const store = memoryStore();

    const userId =
      await createLinkedAccount({
        store,
        phone: "5218111000002",
        webIdentity:
          "web_v115f_same",
        plus: true
      });

    const before =
      await obtenerEstadoUsoMensual({
        userId,
        fecha: NOW,
        store
      });

    await desvincularWhatsAppUsuario({
      userId,
      fecha: NOW,
      store
    });

    const link =
      await iniciarVinculacionWeb({
        webIdentity:
          "web_v115f_same",
        fecha: NOW,
        store
      });

    const done =
      await completarVinculacionConWhatsApp({
        code: link.code,
        whatsappPhone:
          "5218111000002",
        fecha: NOW,
        store
      });

    assert.equal(
      done.linked,
      true
    );

    assert.equal(
      done.relinked,
      true
    );

    assert.equal(
      done.user_id,
      userId
    );

    const after =
      await obtenerEstadoUsoMensual({
        userId,
        fecha: NOW,
        store
      });

    assert.equal(
      after.plan,
      before.plan
    );

    assert.equal(
      after.limite,
      before.limite
    );

    assert.equal(
      after.usadas,
      before.usadas
    );
  }
);

test(
  "V115F CAMBIAR bloquea un número tombstoned de otra cuenta",
  async () => {
    const store = memoryStore();

    const oldOwner =
      await createLinkedAccount({
        store,
        phone: "5218111000003",
        webIdentity:
          "web_v115f_oldowner"
      });

    await desvincularWhatsAppUsuario({
      userId: oldOwner,
      fecha: NOW,
      store
    });

    const current =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "whatsapp",
        valor: "5218111000004",
        fecha: NOW,
        store
      });

    const request =
      await iniciarCambioNumeroWhatsApp({
        userId: current.user_id,
        fecha: NOW,
        store
      });

    const attempt =
      await completarCambioNumeroWhatsApp({
        code: request.code,
        whatsappPhone:
          "5218111000003",
        fecha: NOW,
        store
      });

    assert.equal(
      attempt.changed,
      false
    );

    assert.equal(
      attempt.conflict,
      "identity_previous_account"
    );

    const currentPhone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218111000004",
        store
      });

    assert.equal(
      currentPhone.user_id,
      current.user_id
    );

    const tombstone =
      store.dump(
        "account-v1:identity:whatsapp:528111000003"
      );

    assert.equal(
      tombstone?.user_id,
      null
    );

    assert.equal(
      tombstone?.previous_user_id,
      oldOwner
    );
  }
);

test(
  "V115F CAMBIAR permite recuperar un número tombstoned del mismo user_id",
  async () => {
    const store = memoryStore();

    const original =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "whatsapp",
        valor: "5218111000005",
        fecha: NOW,
        store
      });

    const first =
      await iniciarCambioNumeroWhatsApp({
        userId: original.user_id,
        fecha: NOW,
        store
      });

    const changed =
      await completarCambioNumeroWhatsApp({
        code: first.code,
        whatsappPhone:
          "5218111000006",
        fecha: NOW,
        store
      });

    assert.equal(
      changed.changed,
      true
    );

    assert.equal(
      changed.user_id,
      original.user_id
    );

    const second =
      await iniciarCambioNumeroWhatsApp({
        userId: original.user_id,
        fecha: new Date(
          NOW.getTime() + 1000
        ),
        store
      });

    const restored =
      await completarCambioNumeroWhatsApp({
        code: second.code,
        whatsappPhone:
          "5218111000005",
        fecha: new Date(
          NOW.getTime() + 1000
        ),
        store
      });

    assert.equal(
      restored.changed,
      true
    );

    assert.equal(
      restored.user_id,
      original.user_id
    );

    const phone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218111000005",
        store
      });

    assert.equal(
      phone.user_id,
      original.user_id
    );
  }
);

test(
  "V115F WhatsApp informa conflictos de previous account sin éxito falso",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
          import.meta.url
        ),
        "utf8"
      );

    const matches =
      source.match(
        /identity_previous_account/g
      ) || [];

    assert.ok(
      matches.length >= 2
    );

    assert.match(
      source,
      /no puedo reasignarlo automáticamente/
    );

    assert.match(
      source,
      /Ninguna cuenta fue modificada/
    );
  }
);