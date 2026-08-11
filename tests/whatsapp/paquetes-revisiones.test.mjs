import assert from "node:assert/strict";
import test from "node:test";
import {
  construirReferenciaPaquete,
  extraerReferenciaPaquete,
  obtenerEstadoPaquetes,
  registrarPaquetePagado,
  resolverFechaFinPeriodo
} from "../../channels/whatsapp/functions/lib-paquetes-revisiones.mjs";
import { construirPayloadPaqueteRevisiones } from "../../channels/whatsapp/functions/lib-mercadopago.mjs";
import { obtenerEstadoRevisiones } from "../../channels/whatsapp/functions/lib-revisiones-cartes.mjs";
import { construirMenuMiSuscripcion, esComandoPaquete, MENU_IDS } from "../../channels/whatsapp/functions/lib-menu-cartes.mjs";

function storeMemoria() {
  const datos = new Map();
  return {
    async get(k) { return datos.has(k) ? structuredClone(datos.get(k)) : null; },
    async setJSON(k, v, options = {}) {
      if (options.onlyIfNew && datos.has(k)) return { modified: false };
      datos.set(k, structuredClone(v));
      return { modified: true };
    },
    async delete(k) { datos.delete(k); }
  };
}

test("crea una referencia trazable con teléfono y vencimiento", () => {
  const fecha = new Date("2026-07-30T12:00:00Z");
  const fechaFin = "2026-08-15T12:00:00Z";
  const referencia = construirReferenciaPaquete({ telefono: "5213312345678", fechaFin, entorno: "test", fecha });
  assert.deepEqual(extraerReferenciaPaquete(referencia), {
    entorno: "test", telefono: "5213312345678", fecha_fin: "2026-08-15T12:00:00.000Z", creada_at: fecha.toISOString()
  });
});

test("la preferencia cobra exactamente 99 MXN por 3 revisiones", () => {
  const payload = construirPayloadPaqueteRevisiones({ telefono: "5213312345678", fechaFin: "2026-08-15T12:00:00Z", entorno: "test" });
  assert.equal(payload.items[0].quantity, 1);
  assert.equal(payload.items[0].unit_price, 99);
  assert.equal(payload.items[0].currency_id, "MXN");
  assert.match(payload.external_reference, /^cartes-revisiones:test:5213312345678:/);
});

test("acredita hasta dos paquetes, evita duplicados y suma seis revisiones", async () => {
  const store = storeMemoria();
  const fecha = new Date("2026-07-30T12:00:00Z");
  const fechaFin = "2026-08-15T12:00:00Z";
  const primero = await registrarPaquetePagado({ telefono: "5213312345678", paymentId: "p1", fechaFin, fecha, store });
  assert.equal(primero.revisiones_adicionales, 3);
  const duplicado = await registrarPaquetePagado({ telefono: "5213312345678", paymentId: "p1", fechaFin, fecha, store });
  assert.equal(duplicado.duplicado, true);
  const segundo = await registrarPaquetePagado({ telefono: "5213312345678", paymentId: "p2", fechaFin, fecha, store });
  assert.equal(segundo.revisiones_adicionales, 6);
  const tercero = await registrarPaquetePagado({ telefono: "5213312345678", paymentId: "p3", fechaFin, fecha, store });
  assert.equal(tercero.limite_alcanzado, true);
  const estado = await obtenerEstadoPaquetes({ telefono: "5213312345678", fecha, store });
  assert.equal(estado.paquetes, 2);
});

test("las revisiones adicionales vencen al finalizar el periodo", async () => {
  const store = storeMemoria();
  await registrarPaquetePagado({ telefono: "5213312345678", paymentId: "p1", fechaFin: "2026-08-01T00:00:00Z", fecha: new Date("2026-07-30T12:00:00Z"), store });
  assert.equal((await obtenerEstadoPaquetes({ telefono: "5213312345678", fecha: new Date("2026-08-01T00:01:00Z"), store })).revisiones_adicionales, 0);
});

test("el saldo total aumenta de 5 a 8 y luego a 11", async () => {
  const store = storeMemoria();
  const fecha = new Date("2026-07-30T12:00:00Z");
  const fechaFin = "2026-08-15T12:00:00Z";
  await registrarPaquetePagado({ telefono: "5213312345678", paymentId: "p1", fechaFin, fecha, store });
  assert.equal((await obtenerEstadoRevisiones({ telefono: "5213312345678", fecha, store, paquetesStore: store })).disponibles, 8);
  await registrarPaquetePagado({ telefono: "5213312345678", paymentId: "p2", fechaFin, fecha, store });
  assert.equal((await obtenerEstadoRevisiones({ telefono: "5213312345678", fecha, store, paquetesStore: store })).disponibles, 11);
});

test("la compra aparece solo en Mi suscripción Plus", () => {
  const plus = construirMenuMiSuscripcion({ resumen: "Activa", cancelable: true, plusActivo: true });
  assert.ok(plus.sections[0].rows.some(x => x.id === MENU_IDS.PAQUETE_COMPRAR));
  const gratis = construirMenuMiSuscripcion({ resumen: "Gratis", cancelable: false, plusActivo: false });
  assert.equal(gratis.sections[0].rows.some(x => x.id === MENU_IDS.PAQUETE_COMPRAR), false);
  assert.equal(esComandoPaquete("Comprar revisiones"), true);
});

test("usa la siguiente fecha de cobro como vencimiento", () => {
  assert.equal(resolverFechaFinPeriodo({ next_payment_date: "2026-08-15T12:00:00Z" }, new Date("2026-07-30T12:00:00Z")), "2026-08-15T12:00:00.000Z");
});
