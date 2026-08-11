import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  crearRegistroSeguroDocumento,
  procesarDocumentoTemporal,
  revisarDocumentoSeguro
} from "../../channels/whatsapp/functions/lib-documento-seguro-cartes.mjs";

test("sobrescribe la copia temporal después de procesarla", async () => {
  const original = Buffer.from("contenido sensible");
  let referenciaTemporal;

  const resultado = await procesarDocumentoTemporal(original, async (temporal) => {
    referenciaTemporal = temporal;
    assert.equal(temporal.toString(), "contenido sensible");
    return "ok";
  });

  assert.equal(resultado, "ok");
  assert.ok(referenciaTemporal.every((byte) => byte === 0));
  assert.equal(original.toString(), "contenido sensible");
});

test("sobrescribe la copia temporal aunque el procesamiento falle", async () => {
  let referenciaTemporal;

  await assert.rejects(
    procesarDocumentoTemporal(Buffer.from("secreto"), async (temporal) => {
      referenciaTemporal = temporal;
      throw new Error("fallo controlado");
    }),
    /fallo controlado/
  );

  assert.ok(referenciaTemporal.every((byte) => byte === 0));
});

test("revisa el DOCX sin devolver su texto original", async () => {
  const buffer = await readFile(new URL("./fixtures/documento-revision-segura.docx", import.meta.url));
  const resultado = await revisarDocumentoSeguro(buffer);

  assert.equal(resultado.documentoEliminado, true);
  assert.equal(resultado.paginas, 3);
  assert.ok(Array.isArray(resultado.observaciones));
  assert.equal(Object.hasOwn(resultado, "texto"), false);
});

test("el registro seguro no expone contenido ni nombre de archivo", () => {
  const registro = crearRegistroSeguroDocumento({
    exito: true,
    paginas: 3,
    codigo: "REVISION_OK",
    nombre: "trabajo-secreto.docx",
    texto: "contenido privado"
  });

  assert.deepEqual(registro, {
    tipo: "revision_documento",
    exito: true,
    paginas: 3,
    codigo: "REVISION_OK"
  });
});
