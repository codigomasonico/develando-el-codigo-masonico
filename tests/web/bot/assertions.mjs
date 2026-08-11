export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”«»]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function includesNormalized(text, expected) {
  return normalizeText(text).includes(normalizeText(expected));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Determina si un término prohibido aparece como afirmación propia del asistente.
 * No falla cuando la palabra se cita, se niega o se reproduce para corregir la
 * premisa del usuario. Esto evita falsos positivos como:
 * “La idea de que son ‘inferiores’ es incorrecta”.
 */
function containsAffirmativeClaim(text, forbidden) {
  const nText = normalizeText(text);
  const nForbidden = normalizeText(forbidden);
  if (!nText.includes(nForbidden)) return false;

  const escaped = escapeRegExp(nForbidden);
  const occurrences = [...nText.matchAll(new RegExp(escaped, "gi"))];

  return occurrences.some((match) => {
    const index = match.index ?? 0;
    const before = nText.slice(Math.max(0, index - 150), index);
    const after = nText.slice(index + nForbidden.length, index + nForbidden.length + 150);
    const context = `${before} ${nForbidden} ${after}`;

    // Cita literal o término metalingüístico.
    const quoted = new RegExp(`["']${escaped}["']`, "i").test(context);

    // Negación o refutación próxima, antes o después del término.
    const refutationMarkers = /\b(?:no|nunca|jamas|ni|falso|falsa|incorrecto|incorrecta|mito|simplificacion|premisa|afirmacion|idea|rechazar|niega|negar|carece|sin evidencia|no equivale|no significa|no fundamenta|no convierte)\b/i;
    const refutingContext = refutationMarkers.test(before.slice(-120)) || refutationMarkers.test(after.slice(0, 120));

    // Construcciones explícitas de corrección de premisa.
    const correctionPattern = new RegExp(
      `(?:premisa|idea|afirmacion|creencia|nocion)[^.!?]{0,90}${escaped}[^.!?]{0,90}(?:incorrect|fals|mito|no)` +
      `|${escaped}[^.!?]{0,90}(?:no\s+(?:es|son|implica|significa|equivale)|es\s+(?:incorrect|fals|un\s+mito))`,
      "i"
    );

    if (quoted || refutingContext || correctionPattern.test(context)) return false;

    // Para universales aislados (“todos”, “siempre”, “nunca”), solo falla si
    // forman una proposición afirmativa, no si aparecen en una pregunta citada.
    if (["todos", "siempre", "nunca"].includes(nForbidden)) {
      const affirmativeUniversal = new RegExp(`\b${escaped}\b\s+(?:los|las)?\s*[a-z]+\s+(?:son|creen|deben|hacen|controlan|adoran|pertenecen)\b`, "i");
      return affirmativeUniversal.test(context) && !refutingContext;
    }

    return true;
  });
}

function semanticRequirementSatisfied(_test, answer, expected) {
  if (includesNormalized(answer, expected)) return true;

  const text = normalizeText(answer);
  const key = normalizeText(expected);
  const alternatives = {
    "no existe una unica postura": [
      "no existe una creencia unica",
      "no hay una creencia unica",
      "no existe una doctrina unica",
      "no hay una postura unica",
      "es plural"
    ],
    "tradiciones": ["tradicion", "ritos", "obediencias", "jurisdicciones"],
    "no esta comprobado": [
      "no hay evidencia",
      "no existe evidencia",
      "no puede demostrarse",
      "no esta documentado",
      "no es un hecho historico comprobado",
      "no esta respaldado por evidencia",
      "no esta respaldada por evidencia",
      "carece de respaldo historico",
      "no hay continuidad institucional documentada"
    ],
    "evidencia": [
      "documentacion",
      "documental",
      "pruebas historicas",
      "hechos comprobables",
      "respaldo historico"
    ],
    "no hay evidencia": [
      "no existe evidencia",
      "sin evidencia",
      "no hay pruebas",
      "carece de evidencia",
      "no esta respaldado por evidencia",
      "no esta respaldada por evidencia",
      "teoria conspirativa sin pruebas"
    ],
    "depende": [
      "varia",
      "varian",
      "difiere",
      "difieren",
      "segun",
      "en algunas",
      "en otras",
      "no hay una regla unica"
    ],
    "obediencias": ["obediencia", "grandes logias", "orientes"],
    "obediencia": ["obediencias", "grandes logias", "orientes"],
    "jurisdiccion": ["jurisdicciones", "marco jurisdiccional"],
    "jurisdicciones": ["jurisdiccion", "marcos jurisdiccionales"]
  };

  return (alternatives[key] || []).some((alt) => text.includes(normalizeText(alt)));
}

export function routeMatches(expected, payload) {
  const route = payload?.meta?.route || "";
  const source = payload?.meta?.source || "";
  const sources = Array.isArray(payload?.meta?.sources) ? payload.meta.sources : [];
  const hasKnowledgeType = (type) => sources.some((item) => item?.type === type);

  const allowed = {
    directa_catalogo: route === "directa" && source === "catalogo",
    directa_glosario: route === "directa" && source === "glosario",
    directa_glosario_o_ia: (route === "directa" && source === "glosario") || route === "ia",
    directa_glosario_o_ia_con_glosario: (route === "directa" && source === "glosario") || (route === "ia" && hasKnowledgeType("glosario")),
    directa_catalogo_o_ia_con_catalogo: (route === "directa" && source === "catalogo") || (route === "ia" && hasKnowledgeType("catalogo")),
    ia_o_glosario: route === "ia" || (route === "directa" && source === "glosario"),
    ia: route === "ia",
    seguridad: route === "seguridad",
    fuera_de_tema: route === "fuera_de_tema"
  };
  return Boolean(allowed[expected]);
}

export function evaluateCase(test, payload, httpStatus = 200) {
  const failures = [];
  const answer = String(payload?.answer || "");

  if (httpStatus !== 200) failures.push(`HTTP esperado 200; recibido ${httpStatus}.`);
  if (payload?.error) failures.push(`La API devolvió error: ${payload.error}`);
  if (!answer.trim()) failures.push("La respuesta está vacía.");

  if (!routeMatches(test.ruta_esperada, payload)) {
    failures.push(`Ruta esperada “${test.ruta_esperada}”; recibida “${payload?.meta?.route || "sin ruta"}”${payload?.meta?.source ? ` / ${payload.meta.source}` : ""}.`);
  }

  for (const expected of test.debe_incluir || []) {
    if (!semanticRequirementSatisfied(test, answer, expected)) {
      failures.push(`No satisface el requisito semántico: “${expected}”.`);
    }
  }

  for (const forbidden of test.no_debe_incluir || []) {
    if (containsAffirmativeClaim(answer, forbidden)) {
      failures.push(`Incluye como afirmación contenido prohibido: “${forbidden}”.`);
    }
  }

  return {
    id: test.id,
    categoria: test.categoria,
    pregunta: test.pregunta,
    estado: failures.length ? "FALLIDO" : "APROBADO",
    rutaEsperada: test.ruta_esperada,
    rutaRecibida: payload?.meta?.route || null,
    fuenteRecibida: payload?.meta?.source || null,
    respuesta: answer,
    criterio: test.criterio,
    fallos: failures
  };
}
