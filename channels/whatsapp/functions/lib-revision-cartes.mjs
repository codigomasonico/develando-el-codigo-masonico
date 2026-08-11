const PALABRAS_TRANSICION = [
  "además", "sin embargo", "por tanto", "por lo tanto", "en cambio",
  "finalmente", "primero", "segundo", "por otra parte", "en conclusión"
];

const MARCADORES_CITA = [
  /“[^”]{20,}”/g,
  /"[^"]{20,}"/g,
  /\([^)]*\b(?:19|20)\d{2}[^)]*\)/g,
  /\[[0-9]+\]/g
];

export function revisarTrabajoMasonico(textoEntrada) {
  const texto = normalizarTexto(textoEntrada);
  if (texto.length < 120) {
    throw new Error("El documento no contiene texto suficiente para una revisión útil.");
  }

  const parrafos = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const oraciones = texto.split(/(?<=[.!?])\s+/).map((o) => o.trim()).filter(Boolean);
  const palabras = texto.split(/\s+/).filter(Boolean);
  const titulos = parrafos.filter(esTituloProbable);

  const observaciones = [];
  evaluarEstructura({ texto, parrafos, titulos, observaciones });
  evaluarClaridad({ oraciones, parrafos, observaciones });
  evaluarCoherencia({ texto, parrafos, observaciones });
  evaluarContenido({ texto, palabras, parrafos, observaciones });
  const propiedadIntelectual = evaluarPropiedadIntelectual({ texto, observaciones });

  if (!observaciones.length) {
    observaciones.push({
      categoria: "Valoración general",
      nivel: "fortaleza",
      hallazgo: "El documento presenta una estructura comprensible y una redacción consistente.",
      recomendacion: "Conserva la organización actual y realiza una última lectura en voz alta antes de presentarlo."
    });
  }

  return {
    resumen: {
      palabras: palabras.length,
      parrafos: parrafos.length,
      oraciones: oraciones.length,
      titulos: titulos.length
    },
    propiedadIntelectual,
    observaciones,
    textoWhatsApp: construirRespuestaRevision(observaciones)
  };
}

export function construirRespuestaRevision(observaciones) {
  const items = observaciones.slice(0, 8).map((item, indice) => {
    return `${indice + 1}. ${item.categoria}\n${item.hallazgo}\nRecomendación: ${item.recomendacion}`;
  });

  return items.join("\n\n");
}

function evaluarEstructura({ texto, parrafos, titulos, observaciones }) {
  if (parrafos.length < 3) {
    observaciones.push({
      categoria: "Estructura",
      nivel: "mejora",
      hallazgo: "El contenido está concentrado en pocos bloques y puede resultar difícil de seguir.",
      recomendacion: "Divide el trabajo en introducción, desarrollo y cierre, usando párrafos separados para cada idea principal."
    });
  }

  const tieneCierre = /\b(conclusi[oó]n|reflexi[oó]n final|para concluir|en s[ií]ntesis)\b/i.test(texto);
  if (!tieneCierre) {
    observaciones.push({
      categoria: "Estructura",
      nivel: "mejora",
      hallazgo: "No se identifica con claridad un cierre que recupere la idea principal.",
      recomendacion: "Agrega un párrafo final que sintetice lo aprendido y explique su significado personal o masónico."
    });
  }

  if (titulos.length === 0 && parrafos.length >= 7) {
    observaciones.push({
      categoria: "Estructura",
      nivel: "sugerencia",
      hallazgo: "El trabajo es extenso y no presenta divisiones visibles.",
      recomendacion: "Considera incorporar subtítulos breves para orientar la lectura sin fragmentar demasiado el discurso."
    });
  }
}

function evaluarClaridad({ oraciones, parrafos, observaciones }) {
  const largas = oraciones.filter((o) => contarPalabras(o) > 38);
  if (largas.length >= Math.max(2, Math.ceil(oraciones.length * 0.2))) {
    observaciones.push({
      categoria: "Claridad",
      nivel: "mejora",
      hallazgo: "Varias oraciones son extensas y reúnen demasiadas ideas.",
      recomendacion: "Separa las oraciones más largas y procura desarrollar una idea principal por oración."
    });
  }

  const parrafosLargos = parrafos.filter((p) => contarPalabras(p) > 180);
  if (parrafosLargos.length) {
    observaciones.push({
      categoria: "Claridad",
      nivel: "mejora",
      hallazgo: "Hay párrafos demasiado extensos para una lectura fluida.",
      recomendacion: "Divide cada párrafo largo en dos o más bloques, agrupando las ideas por tema."
    });
  }

  const muletillas = encontrarRepeticiones(parrafos.join(" "));
  if (muletillas.length) {
    observaciones.push({
      categoria: "Claridad",
      nivel: "sugerencia",
      hallazgo: `Se repiten con frecuencia expresiones como ${muletillas.slice(0, 3).join(", ")}.`,
      recomendacion: "Sustituye algunas repeticiones o elimina las que no aporten precisión al argumento."
    });
  }
}

function evaluarCoherencia({ texto, parrafos, observaciones }) {
  const transiciones = PALABRAS_TRANSICION.filter((t) => texto.toLowerCase().includes(t)).length;
  if (parrafos.length >= 5 && transiciones < 2) {
    observaciones.push({
      categoria: "Coherencia",
      nivel: "mejora",
      hallazgo: "Las ideas cambian de un párrafo a otro con pocas conexiones explícitas.",
      recomendacion: "Usa conectores para mostrar continuidad, contraste o consecuencia entre los apartados."
    });
  }

  const primeras = parrafos.map((p) => p.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
  const repetidas = primeras.filter((p, i) => p && primeras.indexOf(p) !== i);
  if (new Set(repetidas).size >= 2) {
    observaciones.push({
      categoria: "Coherencia",
      nivel: "sugerencia",
      hallazgo: "Varios párrafos comienzan de manera muy similar, lo que vuelve monótono el desarrollo.",
      recomendacion: "Varía el inicio de los párrafos y haz explícita la relación de cada uno con la idea anterior."
    });
  }
}

function evaluarContenido({ texto, palabras, parrafos, observaciones }) {
  const preguntas = (texto.match(/\?/g) || []).length;
  const primeraPersona = (texto.match(/\b(yo|me|mi|considero|comprendo|entiendo|reflexiono)\b/gi) || []).length;

  if (palabras.length > 500 && primeraPersona === 0) {
    observaciones.push({
      categoria: "Contenido",
      nivel: "sugerencia",
      hallazgo: "El trabajo desarrolla información, pero casi no muestra una reflexión personal del autor.",
      recomendacion: "Integra una interpretación propia que explique cómo comprendes el símbolo o tema tratado."
    });
  }

  if (preguntas > 5 && parrafos.length < 8) {
    observaciones.push({
      categoria: "Contenido",
      nivel: "mejora",
      hallazgo: "Se plantean varias preguntas sin suficiente desarrollo posterior.",
      recomendacion: "Selecciona las preguntas centrales y responde cada una con argumentos o ejemplos concretos."
    });
  }

  if (!/\b(ejemplo|por ejemplo|experiencia|aplicaci[oó]n|pr[aá]ctica)\b/i.test(texto) && palabras.length > 350) {
    observaciones.push({
      categoria: "Contenido",
      nivel: "sugerencia",
      hallazgo: "El desarrollo es principalmente conceptual y ofrece pocos ejemplos o aplicaciones.",
      recomendacion: "Añade un ejemplo, una experiencia o una aplicación práctica que acerque la reflexión al lector."
    });
  }
}

function evaluarPropiedadIntelectual({ texto, observaciones }) {
  const citas = MARCADORES_CITA.reduce((total, patron) => total + (texto.match(patron) || []).length, 0);
  const referencias = /\b(bibliograf[ií]a|referencias|fuentes)\b/i.test(texto);
  const urls = (texto.match(/https?:\/\/\S+/gi) || []).length;

  const requiereRevision = citas > 0 && !referencias && urls === 0;
  if (requiereRevision) {
    observaciones.push({
      categoria: "Propiedad intelectual",
      nivel: "advertencia",
      hallazgo: "El documento contiene citas o atribuciones aparentes, pero no se identifica una sección de fuentes o referencias.",
      recomendacion: "Confirma la procedencia de esos fragmentos y agrega las referencias necesarias. Esta observación es preventiva y no constituye un dictamen legal."
    });
  }

  return {
    requiereRevision,
    mensaje: requiereRevision
      ? "Encontré aspectos relacionados con citas, referencias o uso de contenido de terceros que conviene revisar."
      : "No encontré aspectos relevantes de atribución que requieran una observación adicional."
  };
}

function normalizarTexto(texto) {
  return String(texto || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function contarPalabras(texto) {
  return String(texto || "").trim().split(/\s+/).filter(Boolean).length;
}

function esTituloProbable(parrafo) {
  const limpio = parrafo.trim();
  const palabras = contarPalabras(limpio);
  if (palabras === 0 || palabras > 10) return false;
  if (/[.!?]$/.test(limpio)) return false;
  return limpio === limpio.toUpperCase() || /^[A-ZÁÉÍÓÚÑ][^.!?]{2,60}$/.test(limpio);
}

function encontrarRepeticiones(texto) {
  const ignorar = new Set(["para", "como", "pero", "este", "esta", "desde", "sobre", "entre", "porque", "cuando", "donde", "también", "más", "menos", "todo", "cada", "una", "unos", "unas", "del", "las", "los", "que", "con", "por"]);
  const conteo = new Map();
  for (const palabra of texto.toLowerCase().match(/[a-záéíóúñ]{4,}/g) || []) {
    if (ignorar.has(palabra)) continue;
    conteo.set(palabra, (conteo.get(palabra) || 0) + 1);
  }
  const umbral = Math.max(5, Math.ceil(contarPalabras(texto) / 80));
  return [...conteo.entries()]
    .filter(([, cantidad]) => cantidad >= umbral)
    .sort((a, b) => b[1] - a[1])
    .map(([palabra]) => `“${palabra}”`);
}
