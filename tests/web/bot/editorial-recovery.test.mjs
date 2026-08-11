import { strict as assert } from "node:assert";
import fs from "node:fs";
import { stabilizeEditorialAnswer } from "../../../core/ai/editorial-recovery.mjs";
import { validateAndNormalizeAnswer } from "../../../core/ai/validator.mjs";
import { evaluateCase } from "./assertions.mjs";

const tests = JSON.parse(fs.readFileSync(new URL("./set_pruebas_v4.json", import.meta.url), "utf8"));
const canonicalIds = new Set([
  "GLO-002", "TER-001", "TER-002", "TER-003", "TER-004", "TER-005",
  "HIS-001", "HIS-002", "HIS-003", "HIS-004", "HIS-005",
  "JUR-001", "JUR-002", "JUR-003", "CAL-001"
]);

let checked = 0;
for (const test of tests.filter((item) => canonicalIds.has(item.id))) {
  const stabilized = stabilizeEditorialAnswer(test.pregunta, "");
  assert.equal(stabilized.handled, true, `No se estabilizó ${test.id}: ${test.pregunta}`);

  const validation = validateAndNormalizeAnswer(stabilized.answer);
  assert.equal(validation.ok, true, `Respuesta canónica rechazada ${test.id}: ${validation.warnings.join(", ")}`);

  const result = evaluateCase(test, {
    answer: validation.text,
    meta: {
      route: "ia",
      sources: [{ type: "glosario", id: "canonical", title: "Banco editorial" }]
    }
  }, 200);

  assert.deepEqual(result.fallos, [], `${test.id} falló: ${result.fallos.join(" | ")}`);
  checked += 1;
}

console.log(`Pruebas canónicas deterministas: ${checked}/${checked} aprobadas`);
