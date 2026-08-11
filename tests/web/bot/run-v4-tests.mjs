import { resolveDirectAnswer } from "../../../core/ai/direct-answer.mjs";
import { validateAndNormalizeAnswer } from "../../../core/ai/validator.mjs";

const cases = [
  ["¿Tienen un episodio sobre la Cámara de Reflexiones?", "catalogo", /Cámara de Reflexiones/i],
  ["¿Qué es una obediencia?", "glosario", /obediencia/i],
  ["¿Qué significa rito?", "glosario", /rito/i]
];
let failed = 0;
for (const [question, source, expected] of cases) {
  const result = resolveDirectAnswer(question);
  if (!result.handled || result.source !== source || !expected.test(result.answer)) {
    failed += 1;
    console.error("FALLO", { question, result });
  } else console.log("OK", question, `→ ${result.source}`);
}
const corrected = validateAndNormalizeAnswer("En la simbólica masónica, la escuadra tiene valor.");
if (!corrected.ok || !/simbología masónica/i.test(corrected.text)) { failed += 1; console.error("FALLO terminología", corrected); }
else console.log("OK corrección terminológica");
if (failed) { console.error(`\n${failed} pruebas fallaron.`); process.exit(1); }
console.log("\nVersión 4: controles principales superados.");
