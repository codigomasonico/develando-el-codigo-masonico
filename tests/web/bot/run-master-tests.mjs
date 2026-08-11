import evaluations from "../../../core/knowledge/03_BANCO_PREGUNTAS_EVALUACION.json" with { type: "json" };
import { classifyQuestion } from "../../../core/ai/router.mjs";
import { detectSafetyIssue } from "../../../core/ai/safety.mjs";
import { retrieveLocalKnowledge } from "../../../core/ai/knowledge.mjs";

let failures = 0;
for (const test of evaluations.cases) {
  const safety = detectSafetyIssue(test.question);
  const classification = classifyQuestion(test.question);
  if (test.expected_behavior === "blocked" && !safety.blocked) {
    console.error(`FAIL ${test.id}: debía bloquearse: ${test.question}`); failures++;
  }
  if (test.expected_behavior === "out_of_scope" && classification.inScope) {
    console.error(`FAIL ${test.id}: debía quedar fuera de alcance: ${test.question}`); failures++;
  }
  if (test.category === "recomendacion_contenido") {
    const knowledge = retrieveLocalKnowledge(test.question, 10);
    const text = knowledge.map(x => `${x.title} ${x.text}`).join(" ");
    for (const expected of test.must_include || []) {
      if (!text.includes(expected)) { console.error(`FAIL ${test.id}: no recuperó ${expected}`); failures++; }
    }
  }
}
if (failures) { console.error(`\n${failures} controles fallaron.`); process.exit(1); }
console.log(`Controles estructurales superados: ${evaluations.cases.length} casos.`);
