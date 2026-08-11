import { getStore } from "@netlify/blobs";
import { obtenerPeriodoMensual } from "./lib-uso-cartes.mjs";
import { obtenerEstadoPaquetes } from "./lib-paquetes-revisiones.mjs";

export const LIMITE_REVISIONES_INCLUIDAS = 5;
const PREFIJO = "revisiones-v1";
const AUTORIZACION_MS = 30 * 60 * 1000;

export function getRevisionesStore() {
  return getStore({ name: "cartes-whatsapp", consistency: "strong" });
}

function telefonoLimpio(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function claveUso(periodo, telefono) {
  return `${PREFIJO}:uso:${periodo}:${telefonoLimpio(telefono)}`;
}
function claveAutorizacion(telefono) {
  return `${PREFIJO}:autorizacion:${telefonoLimpio(telefono)}`;
}

export const VERSION_AUTORIZACION_REVISION = "2026-07-30";

export async function guardarAutorizacionRevision({ telefono, messageId = "", fecha = new Date(), store = getRevisionesStore() }) {
  const tel = telefonoLimpio(telefono);
  if (!tel) throw new Error("Teléfono inválido.");
  const valor = { version: 2, telefono: tel, message_id_aceptacion: String(messageId || ""), version_autorizacion: VERSION_AUTORIZACION_REVISION, autorizada_at: fecha.toISOString(), expires_at: new Date(fecha.getTime() + AUTORIZACION_MS).toISOString() };
  await store.setJSON(claveAutorizacion(tel), valor);
  return valor;
}

export async function leerAutorizacionRevision({ telefono, fecha = new Date(), store = getRevisionesStore() }) {
  const valor = await store.get(claveAutorizacion(telefono), { type: "json", consistency: "strong" });
  if (!valor?.expires_at || Date.parse(valor.expires_at) <= fecha.getTime()) {
    if (valor) await store.delete(claveAutorizacion(telefono));
    return null;
  }
  return valor;
}

export async function eliminarAutorizacionRevision({ telefono, store = getRevisionesStore() }) {
  await store.delete(claveAutorizacion(telefono));
}

export async function obtenerEstadoRevisiones({ telefono, fecha = new Date(), store = getRevisionesStore(), paquetesStore = store }) {
  const periodo = obtenerPeriodoMensual(fecha);
  const registro = await store.get(claveUso(periodo, telefono), { type: "json", consistency: "strong" });
  const usadas = Array.isArray(registro?.revisiones) ? registro.revisiones.filter(x => x?.estado === "completada").length : 0;
  const adicionales = await obtenerEstadoPaquetes({ telefono, fecha, store: paquetesStore });
  const limite = LIMITE_REVISIONES_INCLUIDAS + adicionales.revisiones_adicionales;
  return { periodo, limite, incluidas: LIMITE_REVISIONES_INCLUIDAS, adicionales: adicionales.revisiones_adicionales, paquetes: adicionales.paquetes, fecha_fin_adicionales: adicionales.fecha_fin, usadas, disponibles: Math.max(0, limite - usadas) };
}

export async function reservarRevision({ telefono, messageId, fecha = new Date(), store = getRevisionesStore() }) {
  const estado = await obtenerEstadoRevisiones({ telefono, fecha, store });
  if (estado.disponibles <= 0) return { ...estado, permitida: false };
  const clave = claveUso(estado.periodo, telefono);
  const actual = await store.get(clave, { type: "json", consistency: "strong" }) || { revisiones: [] };
  if (actual.revisiones.some(x => x.message_id === messageId)) return { ...estado, permitida: false, duplicada: true };
  actual.revisiones.push({ message_id: messageId, estado: "pendiente", reserved_at: fecha.toISOString() });
  await store.setJSON(clave, actual);
  return { ...estado, permitida: true, duplicada: false };
}

export async function completarRevision({ telefono, periodo, messageId, fecha = new Date(), store = getRevisionesStore() }) {
  const clave = claveUso(periodo, telefono);
  const actual = await store.get(clave, { type: "json", consistency: "strong" });
  const item = actual?.revisiones?.find(x => x.message_id === messageId);
  if (!item) return false;
  item.estado = "completada";
  item.completed_at = fecha.toISOString();
  await store.setJSON(clave, actual);
  return true;
}

export async function liberarRevision({ telefono, periodo, messageId, store = getRevisionesStore() }) {
  const clave = claveUso(periodo, telefono);
  const actual = await store.get(clave, { type: "json", consistency: "strong" });
  if (!actual?.revisiones) return false;
  const antes = actual.revisiones.length;
  actual.revisiones = actual.revisiones.filter(x => !(x.message_id === messageId && x.estado !== "completada"));
  if (actual.revisiones.length === antes) return false;
  await store.setJSON(clave, actual);
  return true;
}
