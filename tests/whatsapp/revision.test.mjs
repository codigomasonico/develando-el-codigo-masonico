import test from "node:test";
import assert from "node:assert/strict";
import {
  construirRespuestaRevision,
  revisarTrabajoMasonico
} from "../../channels/whatsapp/functions/lib-revision-cartes.mjs";

test("genera observaciones concretas de estructura y claridad", () => {
  const texto = `Introducción\n\nLa masonería propone un camino de estudio y reflexión que puede comprenderse desde distintos símbolos. Esta oración es deliberadamente muy extensa porque reúne demasiadas ideas al mismo tiempo y continúa agregando conceptos sin una pausa clara para comprobar que el análisis detecte problemas de claridad en el documento presentado por el usuario.\n\nEl símbolo permite pensar la experiencia iniciática.\n\nTambién permite pensar la experiencia iniciática.\n\nOtro aspecto permite pensar la experiencia iniciática.`;
  const resultado = revisarTrabajoMasonico(texto);
  assert.ok(resultado.observaciones.length >= 2);
  assert.ok(resultado.observaciones.some((o) => o.categoria === "Estructura"));
  assert.ok(resultado.textoWhatsApp.includes("Recomendación:"));
});

test("detecta de forma preventiva citas sin referencias", () => {
  const texto = `Introducción\n\n“Esta es una cita suficientemente extensa que requiere una atribución clara dentro del trabajo presentado”.\n\nEl análisis desarrolla el sentido del fragmento y propone una reflexión personal sobre su alcance simbólico.\n\nConclusión\n\nEn conclusión, la cita debe integrarse con una interpretación propia y una referencia adecuada.`;
  const resultado = revisarTrabajoMasonico(texto);
  assert.equal(resultado.propiedadIntelectual.requiereRevision, true);
  assert.ok(resultado.observaciones.some((o) => o.categoria === "Propiedad intelectual"));
});

test("no declara infracción cuando no encuentra señales", () => {
  const texto = `Introducción\n\nConsidero que el símbolo debe comprenderse desde la experiencia y no solo desde una definición. Por ejemplo, su significado cambia cuando se relaciona con una decisión personal.\n\nDesarrollo\n\nAdemás, esta lectura permite conectar el aprendizaje con la práctica cotidiana y mantener una voz propia.\n\nConclusión\n\nEn conclusión, comprendo el trabajo simbólico como una invitación a revisar mis actos.`;
  const resultado = revisarTrabajoMasonico(texto);
  assert.equal(resultado.propiedadIntelectual.requiereRevision, false);
});

test("rechaza contenido insuficiente", () => {
  assert.throws(() => revisarTrabajoMasonico("Texto breve"), /texto suficiente/i);
});

test("limita el formato de respuesta a observaciones concretas", () => {
  const observaciones = Array.from({ length: 12 }, (_, i) => ({
    categoria: `Categoría ${i + 1}`,
    hallazgo: "Hallazgo",
    recomendacion: "Recomendación"
  }));
  const respuesta = construirRespuestaRevision(observaciones);
  assert.ok(respuesta.includes("8. Categoría 8"));
  assert.ok(!respuesta.includes("9. Categoría 9"));
});
