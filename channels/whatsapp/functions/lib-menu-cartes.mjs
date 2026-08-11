import { TEXTOS_CARTES, completarTextoCartes } from "./lib-textos-cartes.mjs";

export const MENU_IDS = Object.freeze({
  PRINCIPAL: "menu_principal",
  CONVERSAR: "menu_conversar",
  PLUS_INFO: "menu_plus_info",
  SUSCRIBIR: "menu_suscribirme",
  MI_SUSCRIPCION: "menu_mi_suscripcion",
  AYUDA: "menu_ayuda",
  LEGAL: "menu_legal",
  VOLVER: "menu_volver",
  SUSCRIBIR_MP: "suscribir_mercadopago",
  SUSCRIBIR_PAYPAL: "suscribir_paypal",
  SUSCRIPCION_ESTADO: "suscripcion_estado",
  SUSCRIPCION_CANCELAR: "suscripcion_cancelar",
  SUSCRIPCION_PROBLEMA: "suscripcion_problema",
  AYUDA_SUSCRIPCION: "ayuda_suscripcion",
  AYUDA_PAGO: "ayuda_pago",
  AYUDA_CONTACTO: "ayuda_contacto",
  CANCELAR_CONFIRMAR: "cancelar_confirmar",
  CANCELAR_CONSERVAR: "cancelar_conservar",
  REVISION_INICIAR: "revision_iniciar",
  REVISION_AUTORIZAR: "revision_autorizar",
  REVISION_RECHAZAR: "revision_rechazar",
  TERMINOS_ACEPTAR: "terminos_aceptar",
  TERMINOS_RECHAZAR: "terminos_rechazar",
  PAQUETE_COMPRAR: "paquete_comprar"
});

const COMANDOS_MENU = new Set([
  "menu",
  "inicio",
  "ayuda",
  "opciones",
  "hola",
  "buenas",
  "buen dia",
  "buenas tardes",
  "buenas noches",
  "hola quiero conocer a cartes"
]);

const COMANDOS_CANCELAR = new Set([
  "cancelar cartes plus",
  "cancelar suscripcion",
  "cancelar mi suscripcion",
  "darme de baja",
  "dar de baja cartes plus"
]);

const COMANDOS_REVISION = new Set(["revisar documento", "revisar trabajo", "revision de documento"]);
const COMANDOS_PAQUETE = new Set(["comprar revisiones", "comprar paquete", "revisiones adicionales"]);

const COMANDOS_ESTADO = new Set([
  "suscripcion",
  "mi suscripcion",
  "estado de mi suscripcion",
  "ver mi suscripcion"
]);

export function normalizarComando(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


export function esEntradaSinContenidoUtil(texto) {
  const original = String(texto || "").trim();
  if (!original) return true;

  const alfanumerico = original.replace(/[^\p{L}\p{N}]+/gu, "");
  if (!alfanumerico) return true;

  const normalizado = normalizarComando(original);
  if (!normalizado) return true;

  const palabras = normalizado.split(" ").filter(Boolean);
  if (palabras.length === 1 && /(.)\1{2,}/u.test(palabras[0])) return true;

  return false;
}

export function esComandoMenu(texto) {
  return COMANDOS_MENU.has(normalizarComando(texto));
}

export function esComandoCancelar(texto) {
  return COMANDOS_CANCELAR.has(normalizarComando(texto));
}

export function esComandoRevision(texto) {
  return COMANDOS_REVISION.has(normalizarComando(texto));
}

export function esComandoPaquete(texto) {
  return COMANDOS_PAQUETE.has(normalizarComando(texto));
}

export function esComandoEstadoSuscripcion(texto) {
  return COMANDOS_ESTADO.has(normalizarComando(texto));
}

export function esConfirmacionCancelacion(texto) {
  return ["si cancelar", "confirmar cancelacion"].includes(
    normalizarComando(texto)
  );
}

export function esConservacionSuscripcion(texto) {
  return ["no conservar", "conservar mi suscripcion"].includes(
    normalizarComando(texto)
  );
}

export function resolverOpcionNumericaMenu(texto) {
	const opciones = {
		"1": MENU_IDS.CONVERSAR,
		"2": MENU_IDS.PLUS_INFO,
		"3": MENU_IDS.SUSCRIBIR,
		"4": MENU_IDS.MI_SUSCRIPCION,
		"5": MENU_IDS.AYUDA,
		"6": MENU_IDS.LEGAL,
		"si acepto": MENU_IDS.TERMINOS_ACEPTAR,
		"no acepto": MENU_IDS.TERMINOS_RECHAZAR
	};
  return opciones[normalizarComando(texto)] || "";
}

export function extraerEntradaMensaje(mensaje) {
  if (mensaje?.type === "text") {
    return {
      tipo: "texto",
      id: null,
      texto: String(mensaje?.text?.body || "")
    };
  }

  if (mensaje?.type === "document") {
    return { tipo: "documento", id: null, texto: "", documento: { id: String(mensaje?.document?.id || ""), filename: String(mensaje?.document?.filename || ""), mime_type: String(mensaje?.document?.mime_type || "") } };
  }

  if (mensaje?.type === "interactive") {
    const respuesta =
      mensaje?.interactive?.list_reply ||
      mensaje?.interactive?.button_reply ||
      null;

    if (!respuesta?.id) return null;

    return {
      tipo: "seleccion",
      id: String(respuesta.id),
      texto: String(respuesta.title || "")
    };
  }

  return null;
}

export function construirMenuPrincipal() {
  return {
    header: "Cartes",
    body: TEXTOS_CARTES.SALUDO_MENU_PRINCIPAL,
    footer: TEXTOS_CARTES.PIE_MENU_PRINCIPAL,
    button: TEXTOS_CARTES.BOTON_MENU_PRINCIPAL,
    sections: [
      {
        title: TEXTOS_CARTES.TITULO_OPCIONES_PRINCIPALES,
        rows: [
          fila(MENU_IDS.CONVERSAR, "Conversar con Cartes", TEXTOS_CARTES.DESCRIPCION_CONVERSAR),
          fila(MENU_IDS.PLUS_INFO, "Conocer Cartes Plus", TEXTOS_CARTES.DESCRIPCION_CONOCER_PLUS),
          fila(MENU_IDS.SUSCRIBIR, "Suscribirme", TEXTOS_CARTES.DESCRIPCION_SUSCRIBIRME),
          fila(MENU_IDS.MI_SUSCRIPCION, "Mi suscripción", TEXTOS_CARTES.DESCRIPCION_MI_SUSCRIPCION),
          fila(MENU_IDS.AYUDA, "Ayuda y soporte", TEXTOS_CARTES.DESCRIPCION_AYUDA_SOPORTE),
          fila(MENU_IDS.LEGAL, "Privacidad y términos", TEXTOS_CARTES.DESCRIPCION_PRIVACIDAD_TERMINOS)
        ]
      }
    ]
  };
}

export function construirMenuSuscripcion({ paypalHabilitado = false } = {}) {
  const rows = [
    fila(
      MENU_IDS.SUSCRIBIR_MP,
      "Mercado Pago",
      TEXTOS_CARTES.DESCRIPCION_MERCADO_PAGO
    )
  ];

  if (paypalHabilitado) {
    rows.push(
      fila(
        MENU_IDS.SUSCRIBIR_PAYPAL,
        "PayPal",
        "Suscripción mensual mediante PayPal."
      )
    );
  }

  rows.push(fila(MENU_IDS.VOLVER, "Volver al menú", TEXTOS_CARTES.DESCRIPCION_VOLVER_MENU));

  return {
    header: "Suscribirme",
    body: TEXTOS_CARTES.ELEGIR_MEDIO_PAGO,
    footer: TEXTOS_CARTES.PIE_MENU_SUSCRIPCION,
    button: TEXTOS_CARTES.BOTON_ELEGIR_PAGO,
    sections: [{ title: TEXTOS_CARTES.TITULO_MEDIOS_PAGO, rows }]
  };
}

export function construirMenuMiSuscripcion({ resumen, cancelable, plusActivo = false }) {
  const rows = [
    fila(
      MENU_IDS.SUSCRIPCION_ESTADO,
      "Ver estado",
      TEXTOS_CARTES.DESCRIPCION_VER_ESTADO
    )
  ];

  if (plusActivo) {
    rows.push(
      fila(MENU_IDS.REVISION_INICIAR, "Revisar documento", TEXTOS_CARTES.DESCRIPCION_REVISAR_DOCUMENTO),
      fila(MENU_IDS.PAQUETE_COMPRAR, "Comprar revisiones", TEXTOS_CARTES.DESCRIPCION_COMPRAR_REVISIONES)
    );
  }

  if (cancelable) {
    rows.push(
      fila(
        MENU_IDS.SUSCRIPCION_CANCELAR,
        "Darme de baja",
        TEXTOS_CARTES.DESCRIPCION_DARME_BAJA
      )
    );
  }

  rows.push(
    fila(
      MENU_IDS.SUSCRIPCION_PROBLEMA,
      TEXTOS_CARTES.TITULO_DUDA_PAGO,
      TEXTOS_CARTES.DESCRIPCION_DUDA_PAGO
    ),
    fila(MENU_IDS.VOLVER, "Volver al menú", TEXTOS_CARTES.DESCRIPCION_VOLVER_MENU)
  );

  return {
    header: "Mi suscripción",
    body: String(resumen || TEXTOS_CARTES.SIN_SUSCRIPCION_ACTIVA),
    footer: TEXTOS_CARTES.SEGURIDAD_MI_SUSCRIPCION,
    button: TEXTOS_CARTES.BOTON_MENU_PRINCIPAL,
    sections: [{ title: TEXTOS_CARTES.SECCION_ADMINISTRACION, rows }]
  };
}

export function construirMenuAyuda() {
  return {
    header: "Ayuda y soporte",
    body: TEXTOS_CARTES.ENCABEZADO_MENU_AYUDA,
    footer: TEXTOS_CARTES.SEGURIDAD_AYUDA,
    button: TEXTOS_CARTES.BOTON_MENU_AYUDA,
    sections: [
      {
        title: TEXTOS_CARTES.SECCION_SOPORTE,
        rows: [
          fila(MENU_IDS.AYUDA_SUSCRIPCION, TEXTOS_CARTES.TITULO_AYUDA_SUSCRIPCION, TEXTOS_CARTES.DESCRIPCION_AYUDA_SUSCRIPCION),
          fila(MENU_IDS.AYUDA_PAGO, TEXTOS_CARTES.TITULO_AYUDA_PAGO, TEXTOS_CARTES.DESCRIPCION_AYUDA_PAGO),
          fila(MENU_IDS.AYUDA_CONTACTO, "Contactar soporte", TEXTOS_CARTES.DESCRIPCION_CONTACTAR_SOPORTE),
          fila(MENU_IDS.VOLVER, "Volver al menú", TEXTOS_CARTES.DESCRIPCION_VOLVER_MENU)
        ]
      }
    ]
  };
}

export function construirBotonesCancelacion({ fechaFin = "" } = {}) {
  const detalleFecha = fechaFin
    ? ` Conservarás el acceso hasta ${fechaFin}.`
    : "";

  return {
    body: fechaFin
      ? completarTextoCartes(TEXTOS_CARTES.CONFIRMAR_CANCELACION, { fecha_fin: fechaFin })
      : TEXTOS_CARTES.CONFIRMAR_CANCELACION_SIN_FECHA,
    footer: TEXTOS_CARTES.AVISO_CONFIRMAR_CANCELACION,
    buttons: [
      { id: MENU_IDS.CANCELAR_CONFIRMAR, title: TEXTOS_CARTES.BOTON_CONFIRMAR_CANCELACION },
      { id: MENU_IDS.CANCELAR_CONSERVAR, title: TEXTOS_CARTES.BOTON_CONSERVAR_SUSCRIPCION }
    ]
  };
}

export function esEstadoCancelable(status) {
  const normalizado = String(status || "").toLowerCase();
  return ["authorized", "paused", "pending"].includes(normalizado);
}

export function etiquetaEstado(status) {
  switch (String(status || "").toLowerCase()) {
    case "authorized":
      return "Activa";
    case "paused":
      return "Pausada";
    case "pending":
      return TEXTOS_CARTES.ESTADO_ACTIVACION_PENDIENTE;
    case "cancelled":
    case "canceled":
      return TEXTOS_CARTES.ESTADO_SUSCRIPCION_CANCELADA;
    default:
      return TEXTOS_CARTES.ESTADO_SIN_PLUS;
  }
}

function fila(id, title, description) {
  return { id, title, description };
}

export function construirBotonesAutorizacionRevision() {
  return { body: TEXTOS_CARTES.AUTORIZAR_DOCUMENTO, footer: TEXTOS_CARTES.PIE_AUTORIZACION_DOCUMENTO, buttons: [
    { id: MENU_IDS.REVISION_AUTORIZAR, title: TEXTOS_CARTES.BOTON_AUTORIZAR_REVISION },
    { id: MENU_IDS.REVISION_RECHAZAR, title: TEXTOS_CARTES.BOTON_RECHAZAR_REVISION }
  ] };
}

export function construirBotonesAceptacionTerminos({ texto, footer = TEXTOS_CARTES.PIE_ACEPTACION_LEGAL } = {}) {
  return { body: texto, footer, buttons: [
    { id: MENU_IDS.TERMINOS_ACEPTAR, title: TEXTOS_CARTES.BOTON_ACEPTAR_TERMINOS },
    { id: MENU_IDS.TERMINOS_RECHAZAR, title: TEXTOS_CARTES.BOTON_RECHAZAR_TERMINOS }
  ] };
}
