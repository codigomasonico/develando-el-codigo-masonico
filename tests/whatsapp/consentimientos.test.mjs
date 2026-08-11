import test from "node:test";
import assert from "node:assert/strict";
import { guardarSolicitudAceptacionTerminos, registrarAceptacionTerminos, rechazarAceptacionTerminos, VERSION_TERMINOS_CARTES } from "../../channels/whatsapp/functions/lib-consentimientos-cartes.mjs";
import { guardarAutorizacionRevision, VERSION_AUTORIZACION_REVISION } from "../../channels/whatsapp/functions/lib-revisiones-cartes.mjs";

function memoria() {
  const data = new Map();
  return { data, async setJSON(k,v){data.set(k, structuredClone(v));}, async get(k){return data.get(k) ?? null;}, async delete(k){data.delete(k);} };
}

test("registra aceptación de términos con versiones, teléfono, fecha e IDs", async () => {
  const store=memoria(); const fecha=new Date("2026-07-30T12:00:00Z");
  await guardarSolicitudAceptacionTerminos({telefono:"+52 33 1234 5678",messageId:"wamid.solicitud",fecha,store});
  const r=await registrarAceptacionTerminos({telefono:"523312345678",messageId:"wamid.acepta",fecha:new Date("2026-07-30T12:01:00Z"),store});
  assert.equal(r.telefono,"523312345678"); assert.equal(r.message_id_solicitud,"wamid.solicitud"); assert.equal(r.message_id_aceptacion,"wamid.acepta"); assert.equal(r.version_terminos,VERSION_TERMINOS_CARTES); assert.equal(r.estado,"aceptado");
});

test("registra rechazo y no lo confunde con aceptación", async () => {
  const store=memoria();
  await guardarSolicitudAceptacionTerminos({telefono:"5233",messageId:"s1",store});
  const r=await rechazarAceptacionTerminos({telefono:"5233",messageId:"r1",store});
  assert.equal(r.estado,"rechazado"); assert.equal(r.message_id_respuesta,"r1");
});

test("autorización documental registra versión e identificador", async () => {
  const store=memoria();
  const r=await guardarAutorizacionRevision({telefono:"5233",messageId:"doc-acepta",fecha:new Date("2026-07-30T12:00:00Z"),store});
  assert.equal(r.version_autorizacion,VERSION_AUTORIZACION_REVISION); assert.equal(r.message_id_aceptacion,"doc-acepta"); assert.ok(r.autorizada_at); assert.ok(r.expires_at);
});
