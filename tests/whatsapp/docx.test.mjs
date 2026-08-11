import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analizarDocxCartes, esNombreDocx } from "../../channels/whatsapp/functions/lib-docx-cartes.mjs";

test("reconoce únicamente nombres .docx", () => {
  assert.equal(esNombreDocx("trabajo.docx"), true);
  assert.equal(esNombreDocx("TRABAJO.DOCX"), true);
  assert.equal(esNombreDocx("trabajo.doc"), false);
  assert.equal(esNombreDocx("trabajo.pdf"), false);
});

test("extrae texto y páginas declaradas de un DOCX", async () => {
  const buffer = await readFile(new URL("./fixtures/documento-prueba.docx", import.meta.url));
  const resultado = analizarDocxCartes(buffer);
  assert.equal(resultado.paginas, 3);
  assert.match(resultado.texto, /La Cámara de Reflexiones/);
  assert.match(resultado.texto, /Texto de prueba para Cartes/);
  assert.ok(resultado.palabras >= 7);
});

test("rechaza archivos que no son DOCX válidos", () => {
  assert.throws(() => analizarDocxCartes(Buffer.from("no es un zip")), /dañado|compatible/);
});
