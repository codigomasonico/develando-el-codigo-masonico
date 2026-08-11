import {
  cuentaCentralConfigurada,
  completarUsoCentral,
  liberarUsoCentral,
  obtenerUsoCentral,
  reservarUsoCentral,
  resolverUsuarioCentral,
  sincronizarPlanCentral
} from "./lib-cartes-account-client.mjs";
import {
  completarConsultaMensual as completarLocal,
  liberarConsultaMensual as liberarLocal,
  obtenerEstadoUsoMensual as estadoLocal,
  reservarConsultaMensual as reservarLocal
} from "./lib-uso-cartes.mjs";
import { resolverOCrearUsuarioPorIdentidad as resolverLocal } from "./lib-identidad-cartes.mjs";

export async function resolverUsuarioWhatsApp({ telefono }) {
  if (cuentaCentralConfigurada()) {
    return resolverUsuarioCentral({ identityType: "whatsapp", identityValue: telefono });
  }
  return resolverLocal({ tipo: "whatsapp", valor: telefono });
}

export async function sincronizarPlanUso({ userId, plan }) {
  if (cuentaCentralConfigurada()) {
    // CORE-005: la suscripción central es la fuente de verdad. Solo promovemos
    // registros legacy Plus; nunca degradamos un user_id central por un lookup
    // local incompleto o antiguo basado en teléfono.
    if (String(plan || "").toLowerCase() === "plus") {
      return sincronizarPlanCentral({ userId, plan: "plus" });
    }
    return obtenerUsoCentral({ userId });
  }
  return { user_id: userId, plan, legacy_local: true };
}

export async function obtenerEstadoUsoUnificado({ userId, telefono, plan }) {
  if (cuentaCentralConfigurada()) return obtenerUsoCentral({ userId });
  return estadoLocal({ telefono, plan });
}

export async function reservarConsultaUnificada({ userId, telefono, plan, requestId }) {
  if (cuentaCentralConfigurada()) return reservarUsoCentral({ userId, plan: null, requestId });
  return reservarLocal({ telefono, plan, messageId: requestId });
}

export async function completarConsultaUnificada({ userId, telefono, periodo, requestId }) {
  if (cuentaCentralConfigurada()) return completarUsoCentral({ userId, periodo, requestId });
  return completarLocal({ telefono, periodo, messageId: requestId });
}

export async function liberarConsultaUnificada({ userId, telefono, periodo, requestId }) {
  if (cuentaCentralConfigurada()) return liberarUsoCentral({ userId, periodo, requestId });
  return liberarLocal({ telefono, periodo, messageId: requestId });
}
