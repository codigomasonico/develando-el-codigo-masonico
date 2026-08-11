import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAN_CARTES_GRATUITO,
  PLAN_CARTES_PLUS,
  completarConsultaMensual,
  determinarPlanCartes,
  liberarConsultaMensual,
  obtenerEstadoUsoMensual,
  obtenerPeriodoMensual,
  reservarConsultaMensual
} from "../../channels/whatsapp/functions/lib-uso-cartes.mjs";

function crearStoreMemoria() {
  const datos = new Map();
  let secuencia = 0;

  return {
    datos,
    async getWithMetadata(clave) {
      const entrada = datos.get(clave);
      if (!entrada) return null;
      return {
        data: structuredClone(entrada.data),
        etag: entrada.etag,
        metadata: {}
      };
    },
    async setJSON(clave, valor, opciones = {}) {
      const actual = datos.get(clave);

      if (opciones.onlyIfNew && actual) {
        return { modified: false };
      }

      if (opciones.onlyIfMatch && actual?.etag !== opciones.onlyIfMatch) {
        return { modified: false };
      }

      if (opciones.onlyIfMatch && !actual) {
        return { modified: false };
      }

      secuencia += 1;
      const etag = `\"etag-${secuencia}\"`;
      datos.set(clave, { data: structuredClone(valor), etag });
      return { modified: true, etag };
    }
  };
}

const TELEFONO = "5218115774235";
const JULIO = new Date("2026-07-15T18:00:00.000Z");

test("el periodo mensual se calcula con la zona horaria de Ciudad de México", () => {
  assert.equal(
    obtenerPeriodoMensual(new Date("2026-08-01T04:30:00.000Z")),
    "2026-07"
  );
  assert.equal(
    obtenerPeriodoMensual(new Date("2026-08-01T06:30:00.000Z")),
    "2026-08"
  );
});

test("solo una suscripción authorized habilita Cartes Plus", () => {
  assert.equal(determinarPlanCartes({ status: "authorized" }), PLAN_CARTES_PLUS);
  assert.equal(determinarPlanCartes({ status: "pending" }), PLAN_CARTES_GRATUITO);
  assert.equal(determinarPlanCartes({ status: "cancelled" }), PLAN_CARTES_GRATUITO);
  assert.equal(determinarPlanCartes(null), PLAN_CARTES_GRATUITO);
});

test("Cartes gratuito permite cinco consultas y bloquea la sexta", async () => {
  const store = crearStoreMemoria();

  for (let numero = 1; numero <= 5; numero += 1) {
    const reserva = await reservarConsultaMensual({
      telefono: TELEFONO,
      plan: PLAN_CARTES_GRATUITO,
      messageId: `mensaje-${numero}`,
      fecha: JULIO,
      store
    });
    assert.equal(reserva.permitida, true);
    await completarConsultaMensual({
      telefono: TELEFONO,
      periodo: reserva.periodo,
      messageId: `mensaje-${numero}`,
      fecha: JULIO,
      store
    });
  }

  const sexta = await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    messageId: "mensaje-6",
    fecha: JULIO,
    store
  });

  assert.equal(sexta.permitida, false);
  assert.equal(sexta.duplicada, false);
  assert.equal(sexta.usadas, 5);
  assert.equal(sexta.disponibles, 0);
});

test("un webhook duplicado no consume una segunda consulta", async () => {
  const store = crearStoreMemoria();
  const primera = await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    messageId: "wamid-duplicado",
    fecha: JULIO,
    store
  });
  const duplicada = await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    messageId: "wamid-duplicado",
    fecha: JULIO,
    store
  });

  assert.equal(primera.permitida, true);
  assert.equal(duplicada.permitida, false);
  assert.equal(duplicada.duplicada, true);
  assert.equal(duplicada.usadas, 1);
});

test("una consulta fallida libera la reserva y recupera el saldo", async () => {
  const store = crearStoreMemoria();
  const reserva = await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    messageId: "wamid-fallido",
    fecha: JULIO,
    store
  });

  assert.equal(
    await liberarConsultaMensual({
      telefono: TELEFONO,
      periodo: reserva.periodo,
      messageId: "wamid-fallido",
      fecha: JULIO,
      store
    }),
    true
  );

  const estado = await obtenerEstadoUsoMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    fecha: JULIO,
    store
  });

  assert.equal(estado.usadas, 0);
  assert.equal(estado.disponibles, 5);
});

test("una consulta completada no puede liberarse después", async () => {
  const store = crearStoreMemoria();
  const reserva = await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    messageId: "wamid-completado",
    fecha: JULIO,
    store
  });

  await completarConsultaMensual({
    telefono: TELEFONO,
    periodo: reserva.periodo,
    messageId: "wamid-completado",
    fecha: JULIO,
    store
  });

  assert.equal(
    await liberarConsultaMensual({
      telefono: TELEFONO,
      periodo: reserva.periodo,
      messageId: "wamid-completado",
      fecha: JULIO,
      store
    }),
    false
  );

  const estado = await obtenerEstadoUsoMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    fecha: JULIO,
    store
  });
  assert.equal(estado.usadas, 1);
});

test("al subir a Plus se conservan las consultas usadas y el límite aumenta a 50", async () => {
  const store = crearStoreMemoria();

  for (let numero = 1; numero <= 5; numero += 1) {
    const reserva = await reservarConsultaMensual({
      telefono: TELEFONO,
      plan: PLAN_CARTES_GRATUITO,
      messageId: `gratis-${numero}`,
      fecha: JULIO,
      store
    });
    await completarConsultaMensual({
      telefono: TELEFONO,
      periodo: reserva.periodo,
      messageId: `gratis-${numero}`,
      fecha: JULIO,
      store
    });
  }

  const plus = await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_PLUS,
    messageId: "plus-6",
    fecha: JULIO,
    store
  });

  assert.equal(plus.permitida, true);
  assert.equal(plus.limite, 50);
  assert.equal(plus.usadas, 6);
  assert.equal(plus.disponibles, 44);
});

test("Cartes Plus permite cincuenta consultas y bloquea la siguiente", async () => {
  const store = crearStoreMemoria();

  for (let numero = 1; numero <= 50; numero += 1) {
    const reserva = await reservarConsultaMensual({
      telefono: TELEFONO,
      plan: PLAN_CARTES_PLUS,
      messageId: `plus-${numero}`,
      fecha: JULIO,
      store
    });
    assert.equal(reserva.permitida, true);
    await completarConsultaMensual({
      telefono: TELEFONO,
      periodo: reserva.periodo,
      messageId: `plus-${numero}`,
      fecha: JULIO,
      store
    });
  }

  const numero51 = await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_PLUS,
    messageId: "plus-51",
    fecha: JULIO,
    store
  });

  assert.equal(numero51.permitida, false);
  assert.equal(numero51.usadas, 50);
  assert.equal(numero51.disponibles, 0);
});

test("el contador inicia en cero automáticamente al comenzar otro mes", async () => {
  const store = crearStoreMemoria();
  const reserva = await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    messageId: "julio-1",
    fecha: JULIO,
    store
  });
  await completarConsultaMensual({
    telefono: TELEFONO,
    periodo: reserva.periodo,
    messageId: "julio-1",
    fecha: JULIO,
    store
  });

  const agosto = await obtenerEstadoUsoMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    fecha: new Date("2026-08-15T18:00:00.000Z"),
    store
  });

  assert.equal(agosto.periodo, "2026-08");
  assert.equal(agosto.usadas, 0);
  assert.equal(agosto.disponibles, 5);
});

test("una reserva abandonada deja de consumir saldo después de diez minutos", async () => {
  const store = crearStoreMemoria();
  await reservarConsultaMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    messageId: "pendiente-antiguo",
    fecha: JULIO,
    store
  });

  const onceMinutosDespues = new Date(JULIO.getTime() + 11 * 60 * 1000);
  const estado = await obtenerEstadoUsoMensual({
    telefono: TELEFONO,
    plan: PLAN_CARTES_GRATUITO,
    fecha: onceMinutosDespues,
    store
  });

  assert.equal(estado.usadas, 0);
  assert.equal(estado.disponibles, 5);
});
