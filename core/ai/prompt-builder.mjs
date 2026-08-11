import { SYSTEM_PROMPT } from "./prompt.mjs";
import { TERMINOLOGY_GUIDE } from "./terminology.mjs";
import { topicInstruction } from "./router.mjs";
import { formatKnowledge } from "./knowledge.mjs";

export function buildInstructions({ topic, knowledge, promptVersion, knowledgeVersion }) {
  return `${SYSTEM_PROMPT}

${TERMINOLOGY_GUIDE}

INSTRUCCIÓN ESPECÍFICA PARA ESTA CONSULTA
${topicInstruction(topic)}

CONTEXTO DOCUMENTAL LOCAL
${formatKnowledge(knowledge)}

REGLAS PARA USAR EL CONTEXTO
- Utiliza el contexto solo cuando sea pertinente.
- No digas que consultaste una base de datos.
- No inventes fuentes ni atribuciones.
- Si el contexto no basta, expresa la incertidumbre.

VERSIÓN INTERNA
Prompt ${promptVersion}. Conocimiento ${knowledgeVersion}.`;
}
