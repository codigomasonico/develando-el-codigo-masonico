const TOPIC_PATTERNS = {
  historia: /histori|origen|siglo|constituciones|anderson|operativa|especulativa|gremios?|1717|edad media/i,
  simbologia: /símbol|simbol|escuadra|compás|mandil|columnas?|luz|cámara de reflexiones|piedra|templo|oriente|occidente|pilares/i,
  estructura: /rito|ritual|ceremonia|grado|cargo|obediencia|jurisdicción|gran logia|logia|regularidad|reconocimiento|tenida|plancha|venerable/i,
  filosofia: /filosof|ética|moral|virtud|conciencia|libertad|tolerancia|fraternidad|corrupción|autoritaria|contradicciones|mejor persona/i,
  controversia: /secreta|secta|conspir|élite|poder|religión|satan|lucifer|ocult|anticristiana|gobierna el mundo/i,
  proyecto: /develando el código|podcast|episodio|sitio|libro|escuchar|contenido sobre/i
};

const OUT_OF_SCOPE = /receta|pizza|fútbol|apostar|clima|pronóstico|acciones|comprar acciones|invertir|dolor de pecho|medicamento|medicina|qué tomar|que tomar|dolor|diagnostica|diagnóstico médico|propaganda|partido político|hacke|química|dieta|contrato legal|abogado|programar en python/i;

export function classifyQuestion(question) {
  const text = String(question || "");
  if (OUT_OF_SCOPE.test(text)) return { inScope: false, topic: "fuera_de_tema" };
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(text)) return { inScope: true, topic };
  }
  return { inScope: true, topic: "general" };
}

export function topicInstruction(topic) {
  const map = {
    historia: "Prioriza la diferencia entre evidencia documental, tradición y leyenda.",
    simbologia: "Presenta los significados como interpretaciones contextualizadas, no como verdades universales.",
    estructura: "Aclara que las prácticas dependen de rito, obediencia y jurisdicción.",
    filosofia: "Explica con lenguaje accesible y evita atribuir una doctrina única a toda la Masonería.",
    controversia: "Separa hechos verificables, simplificaciones y teorías sin evidencia, sin ridiculizar al usuario.",
    proyecto: "Solo atribuye contenidos al proyecto cuando estén incluidos en el contexto documental recibido.",
    general: "Responde con prudencia, precisión terminológica y honestidad intelectual."
  };
  return map[topic] || map.general;
}
