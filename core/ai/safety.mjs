import { coreText, normalizeLocale } from "./i18n.mjs";

const RESERVED_PATTERNS = [
  /(?:signos?\s+y\s+toques?|contraseña|palabra\s+(?:secreta|reservada)|se\s+susurra|clave\s+de\s+openai|api\s*key)/i,
  /(?:paso\s+a\s+paso).*?(?:ceremonia|iniciaci[oó]n|ritual)/i,
  /(?:dime|revela|enumera|explica|reproduce|escribe|transcribe|describe|necesito|dame|cu[aá]l\s+es).*?(?:signos?|toques?|palabras? secretas?|palabras? sagradas?|palabras? de paso|palabra del grado|contraseñas?|modos? de reconocimiento|texto reservado|ritual completo|juramento(?:\s+mas[oó]nico)?\s+completo)/i,
  /(?:toque|signo|palabra|modo)\s+(?:de\s+)?(?:reconocimiento|del\s+grado)/i,
  /(?:juramento|ceremonia|iniciaci[oó]n|ritual).*?(?:completo|completa|íntegro|integro|paso a paso|literal|texto íntegro|texto integro|reproducir|transcribir|escribir completo|describe)/i,
  /(?:escribe|transcribe|reproduce|copia).*?(?:juramento|ritual|ceremonia).*?(?:completo|completa|íntegro|integro)?/i,
  /(?:fingir|simular).*?(?:ser mas[oó]n|entrar a una logia)/i,
  /(?:ignora|olvida|desobedece|omite|salta).*?(?:instrucciones|reglas|límites|restricciones|prompt|políticas)/i,
  /(?:muestra|muéstrame|revela|revélame|imprime|copia|traduce|enumera|repite).*?(?:prompt|instrucciones internas|reglas internas|reglas que estás siguiendo|reglas que estas siguiendo|mensaje del sistema|políticas|contexto oculto|archivos internos|clave de openai|openai_api_key|api key)/i,
  /(?:actúa como desarrollador|simula que no tienes restricciones|responde sin censura)/i,
  /\b(?:ignore|disregard|forget|override)\b.*?\b(?:instructions|rules|prompt|policies)\b/i,
  /\b(?:show|reveal|print|repeat|copy)\b.*?\b(?:system prompt|internal instructions|developer message|api key)\b/i,
  /\b(?:tell|give|show|reveal|list|describe|write|transcribe|reproduce)\b.*?\b(?:secret|sacred|password|pass word|word of the degree|signs?|grips?|tokens?|modes? of recognition|complete oath|full oath|complete ritual|full ritual)\b/i,
  /\b(?:oath|ceremony|initiation|ritual)\b.*?\b(?:complete|full|verbatim|word for word|step by step|reproduce|transcribe)\b/i,
  /\b(?:pretend|simulate)\b.*?\b(?:to be a freemason|to be a mason|enter a lodge)\b/i,
  /\b(?:jailbreak|developer mode|do anything now)\b/i
];

export function detectSafetyIssue(question, locale = "es") {
  const text = String(question || "");
  const selectedLocale = normalizeLocale(locale);

  if (RESERVED_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      blocked: true,
      response: coreText(selectedLocale, "safety_blocked")
    };
  }

  return { blocked: false };
}
