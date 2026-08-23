import { CARTES_FREE_QUERY_LIMIT, CARTES_PLUS_QUERY_LIMIT } from "../../../core/ai/config.mjs";
import {
  MENU_IDS,
  construirMenuPrincipal,
  construirMenuSuscripcion,
  esComandoMenu,
  esEntradaSinContenidoUtil
} from "../functions/lib-menu-cartes.mjs";
import { TEXTOS_CARTES } from "../functions/lib-textos-cartes.mjs";
import { clasificarSolicitudAutoria } from "../functions/lib-integridad-autoria-cartes.mjs";

function texto(tipo, contenido) {
  return { tipo, contenido };
}

export function crearSesionInicial() {
  return {
    plusActivo: false,
    consultasUsadas: 0,
    limiteConsultas: CARTES_FREE_QUERY_LIMIT
  };
}

export function construirResumenLocal(sesion) {
  const limite = sesion.plusActivo ? CARTES_PLUS_QUERY_LIMIT : CARTES_FREE_QUERY_LIMIT;
  const usadas = Number(sesion.consultasUsadas || 0);
  const disponibles = Math.max(0, limite - usadas);
  const plan = sesion.plusActivo ? "Cartes Plus" : "Cartes gratuito";
  const estado = sesion.plusActivo ? "Activo" : "Inactivo";

  return [
    `*Plan actual:* *${plan}*`,
    `*Estado de tu suscripción a Cartes Plus:* *${estado}*`,
    `*Consultas utilizadas en este periodo:* *${usadas} de ${limite}*`,
    `*Consultas disponibles:* *${disponibles}*`
  ].join("\n");
}

export function procesarEntradaLocal({ entrada = "", id = "", sesion = crearSesionInicial() }) {
  const estado = { ...crearSesionInicial(), ...sesion };
  estado.limiteConsultas = estado.plusActivo ? CARTES_PLUS_QUERY_LIMIT : CARTES_FREE_QUERY_LIMIT;
  const mensajes = [];
  let consumioConsulta = false;

  if (id === MENU_IDS.SUSCRIBIR) {
    mensajes.push(texto("texto", `${TEXTOS_CARTES.ACEPTAR_TERMINOS}\n\nTérminos de uso: /terminos.html\nAviso de privacidad: /privacy.html`));
    mensajes.push({
      tipo: "botones",
      botones: [
        { id: MENU_IDS.TERMINOS_ACEPTAR, titulo: TEXTOS_CARTES.BOTON_ACEPTAR_TERMINOS },
        { id: MENU_IDS.TERMINOS_RECHAZAR, titulo: TEXTOS_CARTES.BOTON_RECHAZAR_TERMINOS }
      ]
    });
    return { sesion: estado, mensajes, consumioConsulta };
  }

  if (id === MENU_IDS.TERMINOS_ACEPTAR) {
    mensajes.push(texto("texto", TEXTOS_CARTES.TERMINOS_ACEPTADOS));
    mensajes.push({ tipo: "menu", menu: construirMenuSuscripcion({ paypalHabilitado: false }) });
    return { sesion: estado, mensajes, consumioConsulta };
  }

  if (id === MENU_IDS.MI_SUSCRIPCION) {
    mensajes.push(texto("texto", construirResumenLocal(estado)));
    if (estado.plusActivo) {
      mensajes.push({ tipo: "botones", botones: [{ id: MENU_IDS.SUSCRIPCION_CANCELAR, titulo: "Darme de baja" }] });
    }
    return { sesion: estado, mensajes, consumioConsulta };
  }

  if (id === MENU_IDS.PLUS_INFO) {
    mensajes.push(texto("texto", TEXTOS_CARTES.CONOCER_CARTES_PLUS));
    return { sesion: estado, mensajes, consumioConsulta };
  }

  if (id === MENU_IDS.PRINCIPAL || esComandoMenu(entrada)) {
    mensajes.push({ tipo: "menu", menu: construirMenuPrincipal() });
    return { sesion: estado, mensajes, consumioConsulta };
  }

  if (esEntradaSinContenidoUtil(entrada)) {
    mensajes.push(texto("texto", TEXTOS_CARTES.ENTRADA_NO_RECONOCIDA));
    mensajes.push({ tipo: "menu", menu: construirMenuPrincipal() });
    return { sesion: estado, mensajes, consumioConsulta };
  }

  estado.consultasUsadas = Number(estado.consultasUsadas || 0) + 1;
  consumioConsulta = true;

  if (clasificarSolicitudAutoria(entrada).bloqueada) {
    mensajes.push(texto("texto", TEXTOS_CARTES.REDACCION_COMPLETA_NO_PERMITIDA));
    return { sesion: estado, mensajes, consumioConsulta };
  }

  mensajes.push(texto("texto", `Respuesta simulada para: ${String(entrada).trim()}`));
  return { sesion: estado, mensajes, consumioConsulta };
}
