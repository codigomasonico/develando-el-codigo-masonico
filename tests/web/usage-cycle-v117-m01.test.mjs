import test from "node:test";
import assert from "node:assert/strict";

import {
  completarConsultaMensual,
  liberarConsultaMensual,
  obtenerEstadoUsoMensual,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarSuscripcionUsuario
} from "../../core/ai/lib-cartes-account.mjs";

function memoryStore() {
  const data = new Map();
  let seq = 0;

  return {
    async get(key) {
      const e = data.get(key);
      return e
        ? structuredClone(e.data)
        : null;
    },

    async getWithMetadata(key) {
      const e = data.get(key);

      return e
        ? {
            data:
              structuredClone(e.data),
            etag: e.etag,
            metadata: {}
          }
        : null;
    },

    async setJSON(
      key,
      value,
      options = {}
    ) {
      const current =
        data.get(key);

      if (
        options.onlyIfNew &&
        current
      ) {
        return {
          modified: false
        };
      }

      if (
        options.onlyIfMatch &&
        (
          !current ||
          current.etag !==
            options.onlyIfMatch
        )
      ) {
        return {
          modified: false
        };
      }

      seq += 1;

      const etag =
        `"e-${seq}"`;

      data.set(
        key,
        {
          data:
            structuredClone(value),
          etag
        }
      );

      return {
        modified: true,
        etag
      };
    },

    seed(key, value) {
      seq += 1;

      data.set(
        key,
        {
          data:
            structuredClone(value),
          etag:
            `"e-${seq}"`
        }
      );
    }
  };
}

const DAY =
  24 * 60 * 60 * 1000;

test(
  "M01 gratuito no inicia ciclo al crear cuenta",
  async () => {
    const store =
      memoryStore();

    const now =
      new Date(
        "2026-08-19T12:00:00.000Z"
      );

    const user =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "m01_free_new",
        fecha: now,
        store
      });

    const state =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: now,
        store
      });

    assert.equal(
      state.cycle_start,
      null
    );

    assert.equal(
      state.disponibles,
      5
    );
  }
);

test(
  "M01 reserva liberada no inicia los 30 días",
  async () => {
    const store =
      memoryStore();

    const now =
      new Date(
        "2026-08-19T12:00:00.000Z"
      );

    const user =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "m01_free_filtered",
        fecha: now,
        store
      });

    await reservarConsultaMensual({
      userId: user.user_id,
      requestId: "filtered-1",
      fecha: now,
      store
    });

    await liberarConsultaMensual({
      userId: user.user_id,
      requestId: "filtered-1",
      fecha: now,
      store
    });

    const state =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: now,
        store
      });

    assert.equal(
      state.cycle_start,
      null
    );

    assert.equal(
      state.usadas,
      0
    );

    assert.equal(
      state.disponibles,
      5
    );
  }
);

test(
  "M01 primera respuesta válida inicia ciclo exacto de 30 días",
  async () => {
    const store =
      memoryStore();

    const now =
      new Date(
        "2026-08-19T12:00:00.000Z"
      );

    const user =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "whatsapp",
        valor: "5218111110101",
        fecha: now,
        store
      });

    const r =
      await reservarConsultaMensual({
        userId: user.user_id,
        requestId: "valid-1",
        fecha: now,
        store
      });

    await completarConsultaMensual({
      userId: user.user_id,
      periodo: r.periodo,
      requestId: "valid-1",
      fecha: now,
      store
    });

    const state =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: now,
        store
      });

    assert.equal(
      state.cycle_start,
      now.toISOString()
    );

    assert.equal(
      Date.parse(
        state.cycle_end
      ),
      now.getTime() +
        30 * DAY
    );

    assert.equal(
      state.usadas,
      1
    );
  }
);

test(
  "M01 gratuito conserva saldo antes de 30 días y reinicia al vencer",
  async () => {
    const store =
      memoryStore();

    const start =
      new Date(
        "2026-08-01T10:00:00.000Z"
      );

    const user =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "m01_free_30",
        fecha: start,
        store
      });

    const r =
      await reservarConsultaMensual({
        userId: user.user_id,
        requestId: "cycle-1",
        fecha: start,
        store
      });

    await completarConsultaMensual({
      userId: user.user_id,
      periodo: r.periodo,
      requestId: "cycle-1",
      fecha: start,
      store
    });

    const day29 =
      new Date(
        start.getTime() +
        29 * DAY
      );

    const before =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: day29,
        store
      });

    assert.equal(
      before.usadas,
      1
    );

    const day30 =
      new Date(
        start.getTime() +
        30 * DAY
      );

    const expired =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: day30,
        store
      });

    assert.equal(
      expired.usadas,
      0
    );

    assert.equal(
      expired.disponibles,
      5
    );

    assert.equal(
      expired.cycle_start,
      null
    );
  }
);

test(
  "M01 Plus usa next_payment_date como fin del ciclo",
  async () => {
    const store =
      memoryStore();

    const now =
      new Date(
        "2026-08-19T12:00:00.000Z"
      );

    const user =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "m01_plus_cycle",
        fecha: now,
        store
      });

    await sincronizarSuscripcionUsuario({
      userId: user.user_id,
      subscription: {
        provider: "paypal",
        status: "authorized",
        subscription_id:
          "I-M01-CYCLE",
        next_payment_date:
          "2026-09-10T12:00:00.000Z"
      },
      source: "test",
      fecha: now,
      store
    });

    const state =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: now,
        store
      });

    assert.equal(
      state.plan,
      "plus"
    );

    assert.equal(
      state.cycle_end,
      "2026-09-10T12:00:00.000Z"
    );

    assert.equal(
      state.cycle_start,
      "2026-08-10T12:00:00.000Z"
    );

    assert.equal(
      state.disponibles,
      50
    );
  }
);

test(
  "M01 renovación Plus inicia nuevo saldo de 50",
  async () => {
    const store =
      memoryStore();

    const aug =
      new Date(
        "2026-08-19T12:00:00.000Z"
      );

    const user =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "whatsapp",
        valor: "5218111110202",
        fecha: aug,
        store
      });

    await sincronizarSuscripcionUsuario({
      userId: user.user_id,
      subscription: {
        provider:
          "mercadopago",
        status:
          "authorized",
        preapproval_id:
          "MP-M01",
        next_payment_date:
          "2026-09-10T12:00:00.000Z"
      },
      source: "test",
      fecha: aug,
      store
    });

    const r =
      await reservarConsultaMensual({
        userId: user.user_id,
        requestId: "plus-1",
        fecha: aug,
        store
      });

    await completarConsultaMensual({
      userId: user.user_id,
      periodo: r.periodo,
      requestId: "plus-1",
      fecha: aug,
      store
    });

    const used =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: aug,
        store
      });

    assert.equal(
      used.usadas,
      1
    );

    const renewal =
      new Date(
        "2026-09-10T12:01:00.000Z"
      );

    await sincronizarSuscripcionUsuario({
      userId: user.user_id,
      subscription: {
        provider:
          "mercadopago",
        status:
          "authorized",
        preapproval_id:
          "MP-M01",
        next_payment_date:
          "2026-10-10T12:00:00.000Z"
      },
      source: "test",
      fecha: renewal,
      store
    });

    const renewed =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: renewal,
        store
      });

    assert.equal(
      renewed.usadas,
      0
    );

    assert.equal(
      renewed.disponibles,
      50
    );
  }
);

test(
  "M01 upgrade a Plus conserva consumo gratuito existente",
  async () => {
    const store =
      memoryStore();

    const now =
      new Date(
        "2026-08-19T12:00:00.000Z"
      );

    const user =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "m01_upgrade",
        fecha: now,
        store
      });

    const r =
      await reservarConsultaMensual({
        userId: user.user_id,
        requestId: "free-before-plus",
        fecha: now,
        store
      });

    await completarConsultaMensual({
      userId: user.user_id,
      periodo: r.periodo,
      requestId:
        "free-before-plus",
      fecha: now,
      store
    });

    await sincronizarSuscripcionUsuario({
      userId: user.user_id,
      subscription: {
        provider: "paypal",
        status: "authorized",
        subscription_id:
          "I-UPGRADE",
        next_payment_date:
          "2026-09-19T12:00:00.000Z"
      },
      source: "test",
      fecha: now,
      store
    });

    const state =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: now,
        store
      });

    assert.equal(
      state.limite,
      50
    );

    assert.equal(
      state.usadas,
      1
    );

    assert.equal(
      state.disponibles,
      49
    );
  }
);

test(
  "M01 migra usage-v2 sin borrar el consumo vigente",
  async () => {
    const store =
      memoryStore();

    const now =
      new Date(
        "2026-08-19T12:00:00.000Z"
      );

    const user =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "m01_legacy",
        fecha: now,
        store
      });

    store.seed(
      `usage-v2:2026-08:${user.user_id}`,
      {
        version: 2,
        user_id:
          user.user_id,
        periodo: "2026-08",
        consultas: [
          {
            request_id:
              "legacy-1",
            estado:
              "completada",
            plan:
              "gratuito",
            channel:
              "web",
            reserved_at:
              "2026-08-05T12:00:00.000Z",
            completed_at:
              "2026-08-05T12:00:01.000Z"
          }
        ]
      }
    );

    const state =
      await obtenerEstadoUsoMensual({
        userId: user.user_id,
        fecha: now,
        store
      });

    assert.equal(
      state.usadas,
      1
    );

    assert.equal(
      state.disponibles,
      4
    );

    assert.equal(
      state.cycle_start,
      "2026-08-05T12:00:01.000Z"
    );
  }
);