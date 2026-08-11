import { analizarDocxCartes } from "./lib-docx-cartes.mjs";
import { revisarTrabajoMasonico } from "./lib-revision-cartes.mjs";

const MAX_PAGINAS_REVISION = 5;

/**
 * Procesa un documento exclusivamente en memoria y elimina la copia binaria
 * temporal al terminar, tanto si el proceso concluye como si falla.
 * No guarda el archivo ni su contenido en disco, blobs, bases de datos o logs.
 */
export async function procesarDocumentoTemporal(bufferEntrada, tarea) {
  if (typeof tarea !== "function") {
    throw new TypeError("Se requiere una tarea para procesar el documento.");
  }

  const temporal = Buffer.from(bufferEntrada || []);

  try {
    return await tarea(temporal);
  } finally {
    temporal.fill(0);
  }
}

/**
 * Ejecuta el ciclo completo de lectura y revisión sin devolver ni conservar
 * el texto original. Solo entrega métricas y observaciones necesarias.
 */
export async function revisarDocumentoSeguro(bufferEntrada) {
  return procesarDocumentoTemporal(bufferEntrada, async (temporal) => {
    let documento = null;
    let revision = null;

    try {
      documento = analizarDocxCartes(temporal);

      if (documento.paginas > MAX_PAGINAS_REVISION) {
        const error = new Error("El documento supera el límite de 5 páginas por revisión.");
        error.codigo = "DOCUMENTO_MAS_5_PAGINAS";
        throw error;
      }

      revision = revisarTrabajoMasonico(documento.texto);

      return {
        paginas: documento.paginas,
        palabras: documento.palabras,
        caracteres: documento.caracteres,
        resumen: revision.resumen,
        propiedadIntelectual: revision.propiedadIntelectual,
        observaciones: revision.observaciones,
        textoWhatsApp: revision.textoWhatsApp,
        documentoEliminado: true
      };
    } finally {
      // Las referencias al texto se liberan al terminar. El archivo binario
      // temporal se sobrescribe en procesarDocumentoTemporal().
      if (documento) documento.texto = "";
      documento = null;
      revision = null;
    }
  });
}

/**
 * Produce metadatos mínimos y seguros para auditoría técnica. Nunca incluye
 * nombre de archivo, texto, observaciones ni contenido del documento.
 */
export function crearRegistroSeguroDocumento({ exito, paginas, codigo } = {}) {
  return {
    tipo: "revision_documento",
    exito: Boolean(exito),
    paginas: Number.isInteger(paginas) && paginas > 0 ? paginas : null,
    codigo: codigo ? String(codigo).slice(0, 60) : null
  };
}
