import test from "node:test";
import assert from "node:assert/strict";
import { MENU_IDS } from "../../channels/whatsapp/functions/lib-menu-cartes.mjs";
import { crearSesionInicial, procesarEntradaLocal } from "../../channels/whatsapp/tools/simulador-logica.mjs";

test("un punto abre el menú sin consumir consulta", () => {
  const resultado = procesarEntradaLocal({ entrada: ".", sesion: crearSesionInicial() });
  assert.equal(resultado.consumioConsulta, false);
  assert.equal(resultado.sesion.consultasUsadas, 0);
  assert.equal(resultado.mensajes.at(-1).tipo, "menu");
  assert.equal(resultado.mensajes.at(-1).menu.button, "Menú");
});

test("texto aleatorio repetitivo abre el menú", () => {
  const resultado = procesarEntradaLocal({ entrada: "geeer", sesion: crearSesionInicial() });
  assert.equal(resultado.consumioConsulta, false);
  assert.equal(resultado.mensajes.at(-1).tipo, "menu");
});

test("Suscribirme inicia aceptación legal", () => {
  const resultado = procesarEntradaLocal({ id: MENU_IDS.SUSCRIBIR, sesion: crearSesionInicial() });
  assert.match(resultado.mensajes[0].contenido, /Términos de uso/);
});

test("aceptar términos muestra Mercado Pago y oculta PayPal", () => {
  const resultado = procesarEntradaLocal({ id: MENU_IDS.TERMINOS_ACEPTAR, sesion: crearSesionInicial() });
  const filas = resultado.mensajes[1].menu.sections.flatMap(section => section.rows);
  assert.ok(filas.some(row => row.title === "Mercado Pago"));
  assert.ok(!filas.some(row => row.title === "PayPal"));
});

test("usuario gratuito no recibe opción de cancelación", () => {
  const resultado = procesarEntradaLocal({ id: MENU_IDS.MI_SUSCRIPCION, sesion: crearSesionInicial() });
  assert.equal(resultado.mensajes.length, 1);
  assert.match(resultado.mensajes[0].contenido, /\*Cartes gratuito\*/);
  assert.match(resultado.mensajes[0].contenido, /\*0 de 5\*/);
});


test("rechaza redactar una plancha completa y consume una consulta", () => {
  const resultado = procesarEntradaLocal({
    entrada: "Escríbeme una plancha sobre la piedra bruta lista para presentar.",
    sesion: crearSesionInicial()
  });
  assert.equal(resultado.consumioConsulta, true);
  assert.equal(resultado.sesion.consultasUsadas, 1);
  assert.match(resultado.mensajes[0].contenido, /no puedo redactar por ti/i);
});

test("permite solicitar un esquema para desarrollar el trabajo", () => {
  const resultado = procesarEntradaLocal({
    entrada: "Dame un esquema para una plancha sobre la piedra bruta.",
    sesion: crearSesionInicial()
  });
  assert.equal(resultado.consumioConsulta, true);
  assert.match(resultado.mensajes[0].contenido, /Respuesta simulada/);
});
