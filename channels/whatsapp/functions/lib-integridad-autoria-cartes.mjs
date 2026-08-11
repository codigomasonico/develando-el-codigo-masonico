const VERBOS_REDACCION = /\b(?:escribe|escríbeme|redacta|redáctame|haz|hazme|elabora|elabórame|crea|créame|prepara|prepárame|desarrolla|desarróllame|genera|genérame|arma|ármame)\b/i;
const ENTREGABLE_COMPLETO = /\b(?:plancha|trazado|ensayo|trabajo(?:\s+mas[oó]nico)?|discurso|ponencia|exposici[oó]n|documento|art[ií]culo|monograf[ií]a|tesis)\b/i;
const LISTO_PARA_PRESENTAR = /\b(?:list[oa]\s+para\s+(?:presentar|leer|entregar)|para\s+presentar(?:lo|la)?|para\s+leer(?:lo|la)?\s+en\s+logia|como\s+si\s+fuera\s+m[ií][oa]|que\s+parezca\s+m[ií][oa]|para\s+entregar)\b/i;
const EXTENSION_SIGNIFICATIVA = /\b(?:\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:p[aá]ginas?|cuartillas?)\b/i;
const SECCIONES_PARA_ARMAR = /\b(?:introducci[oó]n|desarrollo|conclusi[oó]n)\b.*\b(?:por\s+separado|complet[oa]|para\s+una\s+(?:plancha|trazado|ensayo|trabajo))\b/i;
const AYUDA_PERMITIDA = /\b(?:esquema|[ií]ndice|preguntas?|fuentes?|bibliograf[ií]a|ideas?|argumentos?|estructura|gu[ií]a|orientaci[oó]n|revisa|revisar|corrige|corregir|mejora|mejorar|retroalimentaci[oó]n|comentarios?|observaciones?|borrador|p[aá]rrafo|fragmento)\b/i;

export function clasificarSolicitudAutoria(texto) {
  const consulta = String(texto || "").trim();
  if (!consulta) return { bloqueada: false, motivo: null };

  const pideRedaccion = VERBOS_REDACCION.test(consulta);
  const pideEntregable = ENTREGABLE_COMPLETO.test(consulta);
  const pideUsoComoPropio = LISTO_PARA_PRESENTAR.test(consulta);
  const pideExtension = EXTENSION_SIGNIFICATIVA.test(consulta);
  const pidePorPartes = SECCIONES_PARA_ARMAR.test(consulta);
  const pideApoyo = AYUDA_PERMITIDA.test(consulta);

  if (pideUsoComoPropio && (pideRedaccion || pideEntregable)) {
    return { bloqueada: true, motivo: "presentacion_como_propio" };
  }

  if (pideRedaccion && pideEntregable && (pideExtension || !pideApoyo)) {
    return { bloqueada: true, motivo: "redaccion_completa" };
  }

  if (pidePorPartes && pideRedaccion) {
    return { bloqueada: true, motivo: "fragmentacion_evasiva" };
  }

  return { bloqueada: false, motivo: null };
}

export function esSolicitudRedaccionCompleta(texto) {
  return clasificarSolicitudAutoria(texto).bloqueada;
}
