import { inflateRawSync } from "node:zlib";

const FIRMA_EOCD = 0x06054b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_LOCAL = 0x04034b50;
const MAX_DOCX_BYTES = 8 * 1024 * 1024;

export function analizarDocxCartes(bufferEntrada) {
  const buffer = Buffer.isBuffer(bufferEntrada)
    ? bufferEntrada
    : Buffer.from(bufferEntrada || []);

  if (!buffer.length) {
    throw new Error("El documento está vacío.");
  }
  if (buffer.length > MAX_DOCX_BYTES) {
    throw new Error("El documento supera el tamaño máximo permitido.");
  }

  const entradas = leerEntradasZip(buffer);
  const documentoXml = leerEntradaTexto(entradas, "word/document.xml");
  if (!documentoXml) {
    throw new Error("El archivo no contiene un documento Word válido.");
  }

  const texto = extraerTextoDocumento(documentoXml);
  const appXml = leerEntradaTexto(entradas, "docProps/app.xml");
  const paginas = obtenerPaginas(appXml, documentoXml);

  return {
    texto,
    paginas,
    caracteres: texto.length,
    palabras: texto ? texto.split(/\s+/).filter(Boolean).length : 0
  };
}

export function esNombreDocx(nombre) {
  return String(nombre || "").trim().toLowerCase().endsWith(".docx");
}

function leerEntradasZip(buffer) {
  const eocd = buscarFirmaDesdeFinal(buffer, FIRMA_EOCD);
  if (eocd < 0) throw new Error("El archivo Word está dañado o no es compatible.");

  const total = buffer.readUInt16LE(eocd + 10);
  const offsetCentral = buffer.readUInt32LE(eocd + 16);
  const entradas = new Map();
  let cursor = offsetCentral;

  for (let i = 0; i < total; i += 1) {
    if (buffer.readUInt32LE(cursor) !== FIRMA_CENTRAL) {
      throw new Error("La estructura interna del documento no es válida.");
    }

    const metodo = buffer.readUInt16LE(cursor + 10);
    const tamanoComprimido = buffer.readUInt32LE(cursor + 20);
    const tamanoOriginal = buffer.readUInt32LE(cursor + 24);
    const nombreLongitud = buffer.readUInt16LE(cursor + 28);
    const extraLongitud = buffer.readUInt16LE(cursor + 30);
    const comentarioLongitud = buffer.readUInt16LE(cursor + 32);
    const offsetLocal = buffer.readUInt32LE(cursor + 42);
    const nombre = buffer
      .subarray(cursor + 46, cursor + 46 + nombreLongitud)
      .toString("utf8");

    entradas.set(nombre, {
      metodo,
      tamanoComprimido,
      tamanoOriginal,
      offsetLocal
    });

    cursor += 46 + nombreLongitud + extraLongitud + comentarioLongitud;
  }

  return { buffer, entradas };
}

function leerEntradaTexto(zip, nombre) {
  const meta = zip.entradas.get(nombre);
  if (!meta) return "";

  const { buffer } = zip;
  if (buffer.readUInt32LE(meta.offsetLocal) !== FIRMA_LOCAL) {
    throw new Error("El documento contiene una entrada interna inválida.");
  }

  const nombreLongitud = buffer.readUInt16LE(meta.offsetLocal + 26);
  const extraLongitud = buffer.readUInt16LE(meta.offsetLocal + 28);
  const inicio = meta.offsetLocal + 30 + nombreLongitud + extraLongitud;
  const comprimido = buffer.subarray(inicio, inicio + meta.tamanoComprimido);

  let contenido;
  if (meta.metodo === 0) contenido = comprimido;
  else if (meta.metodo === 8) contenido = inflateRawSync(comprimido);
  else throw new Error("El documento usa una compresión no compatible.");

  if (meta.tamanoOriginal && contenido.length !== meta.tamanoOriginal) {
    throw new Error("El documento no pudo leerse completamente.");
  }

  return contenido.toString("utf8");
}

function extraerTextoDocumento(xml) {
  return xml
    .replace(/<w:tab\b[^>]*\/>/gi, "\t")
    .replace(/<w:br\b[^>]*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function obtenerPaginas(appXml, documentoXml) {
  const declaradas = String(appXml || "").match(/<Pages>(\d+)<\/Pages>/i);
  if (declaradas && Number(declaradas[1]) > 0) return Number(declaradas[1]);

  const saltos = String(documentoXml || "").match(
    /<w:br\b[^>]*w:type=["']page["'][^>]*\/>/gi
  );
  return Math.max(1, (saltos?.length || 0) + 1);
}

function buscarFirmaDesdeFinal(buffer, firma) {
  const minimo = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minimo; i -= 1) {
    if (buffer.readUInt32LE(i) === firma) return i;
  }
  return -1;
}
