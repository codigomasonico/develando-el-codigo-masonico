import test from "node:test";
import assert from "node:assert/strict";

import glossary from "../../core/knowledge/01_GLOSARIO_MASONICO.json" with { type: "json" };
import { resolveDirectAnswer } from "../../core/ai/direct-answer.mjs";
import { retrieveLocalKnowledge } from "../../core/ai/knowledge.mjs";

test("V135 - glosario ampliado conserva estructura y unicidad", () => {
  assert.equal(glossary.schema_version, "2.1.0");
  assert.ok(Array.isArray(glossary.entries));
  assert.ok(glossary.entries.length > 500);
  assert.equal(new Set(glossary.entries.map((item) => item.id)).size, glossary.entries.length);
  assert.equal(
    new Set(glossary.entries.map((item) => String(item.term || "").toLowerCase())).size,
    glossary.entries.length
  );
  assert.equal(glossary.distinctions.length, 13);
  assert.equal(glossary.reaa_degrees.length, 33);
});

test("V135 - Gran Logia tiene entrada propia y no cae en Obediencia", () => {
  const result = resolveDirectAnswer("¿Qué es una Gran Logia?");
  assert.equal(result.handled, true);
  assert.equal(result.source, "glosario");
  assert.deepEqual(result.items, ["Gran Logia"]);

  const obediencia = glossary.entries.find((item) => item.term === "Obediencia");
  assert.ok(obediencia);
  assert.equal(obediencia.aliases.includes("gran logia"), false);
  assert.equal(obediencia.aliases.includes("gran oriente"), false);
});

test("V135 - una entrada canónica gana frente a un alias equivalente", () => {
  const result = resolveDirectAnswer("¿Qué es el Volumen de la Ley Sagrada?");
  assert.equal(result.handled, true);
  assert.deepEqual(result.items, ["Volumen de la Ley Sagrada"]);
});

test("V135 - términos nuevos del glosario responden directamente", () => {
  const result = resolveDirectAnswer("¿Qué es la acacia?");
  assert.equal(result.handled, true);
  assert.equal(result.source, "glosario");
  assert.deepEqual(result.items, ["Acacia"]);
});

test("V135 - distinciones conceptuales llegan al conocimiento local", () => {
  const items = retrieveLocalKnowledge(
    "¿Cuál es la diferencia entre regularidad y reconocimiento?"
  );

  assert.ok(
    items.some(
      (item) =>
        item.type === "distincion" &&
        /REGULARIDAD.*RECONOCIMIENTO/i.test(item.title)
    )
  );
});

test("V135 - grados REAA quedan disponibles para recuperación contextual", () => {
  const items = retrieveLocalKnowledge("¿Qué significa el grado 18 del REAA?");

  assert.ok(
    items.some(
      (item) =>
        item.type === "grado_reaa" &&
        item.title.startsWith("18°")
    )
  );
});

test("V135 - se preserva la definición editorial existente de Masonería", () => {
  const entry = glossary.entries.find((item) => item.term === "Masonería");
  assert.equal(
    entry.definition,
    "Tradición iniciática, filosófica y asociativa organizada en logias, con diversidad de ritos, obediencias y jurisdicciones. No posee una autoridad universal única."
  );
});
