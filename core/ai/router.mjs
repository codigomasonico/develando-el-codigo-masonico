function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TOPIC_PATTERNS = Object.freeze({
  controversia: /\b(?:secreta|secreto|secta|conspiracion|conspirativa|elite|poder|religion|satan|lucifer|ocultismo|oculta|anticristiana|gobierna el mundo)\b/,
  historia: /\b(?:historia|historico|historica|origen|origenes|siglo|constituciones|anderson|operativa|especulativa|gremio|gremios|1717|edad media|egipto)\b/,
  simbologia: /\b(?:simbolo|simbolos|simbologia|simbolismo|escuadra|compas|mandil|plomada|columna|columnas|luz|camara de reflexiones|piedra bruta|piedra cubica|templo|oriente|occidente|pilares|tres grandes luces|cadena de union|vitriol|gadu|gran arquitecto del universo)\b/,
  estructura: /\b(?:rito|ritual|ceremonia|grado|grados|cargo|cargos|obediencia|jurisdiccion|gran logia|logia|regularidad|reconocimiento|tenida|plancha|balustre|venerable maestro|aprendiz mason|companero mason|maestro mason|landmarks)\b/,
  filosofia: /\b(?:filosofia|filosofica|etica|moral|virtud|conciencia|libertad|tolerancia|fraternidad|corrupcion|autoritaria|contradicciones|mejor persona)\b/,
  proyecto: /\b(?:develando el codigo|podcast|episodio|episodios|sitio|libro|escuchar|contenido)\b/
});

const EXPLICIT_MASONIC_CONTEXT =
  /\b(?:masoneria|masonico|masonica|masonicos|masonicas|mason|masones|francmasoneria|francmason|francmasones|orden masonica|tradicion masonica)\b/;

const STRONG_MASONIC_TERMS =
  /\b(?:logia|gran logia|obediencia|tenida|balustre|venerable maestro|aprendiz mason|companero mason|maestro mason|masoneria operativa|masoneria especulativa|escuadra|compas|mandil|camara de reflexiones|piedra bruta|piedra cubica|tres grandes luces|gran arquitecto del universo|gadu|landmarks|vitriol|cadena de union|constituciones de anderson|1717)\b/;

const OUT_OF_SCOPE = [
  /\b(?:receta|pizza|futbol|apostar|apuestas|clima|pronostico del tiempo)\b/,
  /\b(?:comprar acciones|invertir dinero|recomendacion financiera|asesoria financiera)\b/,
  /\b(?:dolor de pecho|medicamento|medicina|que tomar|diagnostico medico|diagnostica|dieta medica)\b/,
  /\b(?:contrato legal|asesoria legal|necesito un abogado)\b/,
  /\b(?:hackear|hacke|programar en python|codigo malicioso)\b/,
  /\b(?:propaganda partidista|campana politica partidista)\b/,
  /\boriente medio\b/,
  /\bgrado(?:s)? de temperatura\b/,
  /\b(?:cuantos?|a cuantos?)\s+grados?\s+(?:hace|esta|estan|estamos)\b/,
  /\bgrados?\s+(?:celsius|centigrados|fahrenheit)\b/,
  /\bcargo(?:s)? (?:bancario|por sobregiro|en mi tarjeta)\b/,
  /\bcuanto cuesta la luz\b/
];

function hasRitualTriad(text) {
  const terms = ["rito", "ritual", "ceremonia"];
  return terms.filter((term) => new RegExp(`\\b${term}\\b`).test(text)).length >= 2;
}

function hasSymbolicQuestionContext(text) {
  return (
    /\b(?:representa|simboliza|significa|sentido)\b/.test(text) &&
    /\b(?:luz|oriente|occidente|columna|columnas|templo|pilares|plomada)\b/.test(text)
  );
}

function hasStructuralDegreeQuestionContext(text) {
  return (
    /\b(?:cuantos?|cuantas?)\s+grados?\s+hay\b/.test(text) ||
    /\b(?:cuantos?|cuantas?)\s+grados?\s+(?:existen|son|tiene|tienen)\b/.test(text) ||
    /\b(?:cuales|que)\s+(?:son\s+)?(?:los\s+)?grados?\b/.test(text)
  );
}

function hasMasonicContext(text) {
  return (
    EXPLICIT_MASONIC_CONTEXT.test(text) ||
    STRONG_MASONIC_TERMS.test(text) ||
    hasRitualTriad(text) ||
    hasSymbolicQuestionContext(text) ||
    hasStructuralDegreeQuestionContext(text)
  );
}

export function classifyQuestion(question) {
  const text = normalize(question);

  if (!text) {
    return { inScope: false, topic: "fuera_de_tema" };
  }

  if (OUT_OF_SCOPE.some((pattern) => pattern.test(text))) {
    return { inScope: false, topic: "fuera_de_tema" };
  }

  if (TOPIC_PATTERNS.proyecto.test(text)) {
    return { inScope: true, topic: "proyecto" };
  }

  if (!hasMasonicContext(text)) {
    return { inScope: false, topic: "fuera_de_tema" };
  }

  for (const topic of [
    "controversia",
    "historia",
    "simbologia",
    "estructura",
    "filosofia"
  ]) {
    if (TOPIC_PATTERNS[topic].test(text)) {
      return { inScope: true, topic };
    }
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
