import test from "node:test";
import assert from "node:assert/strict";
import {
  clasificarSolicitudAutoria,
  esSolicitudRedaccionCompleta
} from "../../channels/whatsapp/functions/lib-integridad-autoria-cartes.mjs";

test("bloquea una plancha completa", () => {
  assert.equal(esSolicitudRedaccionCompleta("Escríbeme una plancha sobre la piedra bruta."), true);
});

test("bloquea un ensayo extenso", () => {
  assert.equal(esSolicitudRedaccionCompleta("Hazme un ensayo de 5 páginas sobre el silencio masónico."), true);
});

test("bloquea contenido listo para presentar como propio", () => {
  const resultado = clasificarSolicitudAutoria("Redacta un trazado listo para leer en Logia como si fuera mío.");
  assert.equal(resultado.bloqueada, true);
  assert.equal(resultado.motivo, "presentacion_como_propio");
});

test("bloquea la fragmentación evasiva", () => {
  assert.equal(esSolicitudRedaccionCompleta("Escribe la introducción, el desarrollo y la conclusión por separado para una plancha."), true);
});

test("permite pedir un esquema", () => {
  assert.equal(esSolicitudRedaccionCompleta("Dame un esquema para desarrollar una plancha sobre la piedra bruta."), false);
});

test("permite revisión y mejora de un borrador", () => {
  assert.equal(esSolicitudRedaccionCompleta("Revisa este borrador y mejora la claridad de este párrafo."), false);
});

test("permite preguntas y fuentes para investigar", () => {
  assert.equal(esSolicitudRedaccionCompleta("Sugiere cinco preguntas y fuentes para investigar el simbolismo de la escuadra."), false);
});
