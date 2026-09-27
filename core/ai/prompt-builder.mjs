import { SYSTEM_PROMPT } from "./prompt.mjs";
import { SYSTEM_PROMPT_EN } from "./prompt-en.mjs";
import { TERMINOLOGY_GUIDE } from "./terminology.mjs";
import { TERMINOLOGY_GUIDE_EN } from "./terminology-en.mjs";
import { normalizeLocale } from "./i18n.mjs";
import { topicInstruction } from "./router.mjs";
import { formatKnowledge } from "./knowledge.mjs";

export function buildInstructions({
  topic,
  knowledge,
  locale = "es",
  promptVersion,
  knowledgeVersion
}) {
  const selectedLocale = normalizeLocale(locale);
  const english = selectedLocale === "en";
  const systemPrompt = english ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT;
  const terminologyGuide = english ? TERMINOLOGY_GUIDE_EN : TERMINOLOGY_GUIDE;

  if (english) {
    return `${systemPrompt}

${terminologyGuide}

SPECIFIC INSTRUCTION FOR THIS QUESTION
${topicInstruction(topic, selectedLocale)}

LOCAL DOCUMENTARY CONTEXT
${formatKnowledge(knowledge, selectedLocale)}

RULES FOR USING THE CONTEXT
- The documentary context may be written in Spanish. Understand it and answer in natural English.
- Use the context only when relevant.
- Do not say that you queried a database.
- Do not invent sources or attributions.
- If the context is insufficient, state the uncertainty.

INTERNAL VERSION
Prompt ${promptVersion}. Knowledge ${knowledgeVersion}.`;
  }

  return `${systemPrompt}

${terminologyGuide}

INSTRUCCIÓN ESPECÍFICA PARA ESTA CONSULTA
${topicInstruction(topic, selectedLocale)}

CONTEXTO DOCUMENTAL LOCAL
${formatKnowledge(knowledge, selectedLocale)}

REGLAS PARA USAR EL CONTEXTO
- Utiliza el contexto solo cuando sea pertinente.
- No digas que consultaste una base de datos.
- No inventes fuentes ni atribuciones.
- Si el contexto no basta, expresa la incertidumbre.

VERSIÓN INTERNA
Prompt ${promptVersion}. Conocimiento ${knowledgeVersion}.`;
}
