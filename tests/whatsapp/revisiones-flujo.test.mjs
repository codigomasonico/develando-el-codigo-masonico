import assert from "node:assert/strict";
import test from "node:test";
import {
  completarRevision, eliminarAutorizacionRevision, guardarAutorizacionRevision,
  leerAutorizacionRevision, obtenerEstadoRevisiones, reservarRevision
} from "../../channels/whatsapp/functions/lib-revisiones-cartes.mjs";
import { extraerEntradaMensaje, MENU_IDS, construirBotonesAutorizacionRevision, esComandoRevision } from "../../channels/whatsapp/functions/lib-menu-cartes.mjs";

function storeMemoria() {
  const datos = new Map();
  return {
    async get(k) { return datos.has(k) ? structuredClone(datos.get(k)) : null; },
    async setJSON(k,v) { datos.set(k, structuredClone(v)); return { modified: true }; },
    async delete(k) { datos.delete(k); }
  };
}

test("reconoce el comando y los botones de revisión", () => {
  assert.equal(esComandoRevision("Revisar documento"), true);
  const botones = construirBotonesAutorizacionRevision();
  assert.deepEqual(botones.buttons.map(x => x.id), [MENU_IDS.REVISION_AUTORIZAR, MENU_IDS.REVISION_RECHAZAR]);
});

test("extrae documentos entrantes de WhatsApp", () => {
  assert.deepEqual(extraerEntradaMensaje({ type: "document", document: { id: "media-1", filename: "trabajo.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } }), {
    tipo: "documento", id: null, texto: "", documento: { id: "media-1", filename: "trabajo.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
  });
});

test("la autorización expira y puede eliminarse", async () => {
  const store = storeMemoria();
  const fecha = new Date("2026-07-30T12:00:00Z");
  await guardarAutorizacionRevision({ telefono: "5218115774235", fecha, store });
  assert.ok(await leerAutorizacionRevision({ telefono: "5218115774235", fecha: new Date("2026-07-30T12:20:00Z"), store }));
  assert.equal(await leerAutorizacionRevision({ telefono: "5218115774235", fecha: new Date("2026-07-30T12:31:00Z"), store }), null);
  await eliminarAutorizacionRevision({ telefono: "5218115774235", store });
});

test("descuenta una revisión solo después de completarla", async () => {
  const store = storeMemoria();
  const fecha = new Date("2026-07-30T12:00:00Z");
  const reserva = await reservarRevision({ telefono: "5218115774235", messageId: "doc-1", fecha, store });
  assert.equal(reserva.permitida, true);
  assert.equal((await obtenerEstadoRevisiones({ telefono: "5218115774235", fecha, store })).disponibles, 5);
  await completarRevision({ telefono: "5218115774235", periodo: reserva.periodo, messageId: "doc-1", fecha, store });
  assert.equal((await obtenerEstadoRevisiones({ telefono: "5218115774235", fecha, store })).disponibles, 4);
});
